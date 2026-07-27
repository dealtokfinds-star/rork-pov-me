import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";

import { supabase } from "@/lib/supabase";

/** Returns the current user's id from the stored Rork Auth JWT (sub claim). */
async function currentUserId(): Promise<string | null> {
  const token = await SecureStore.getItemAsync("access_token");
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * KYC / verification client (self-attestation + ID upload + admin review).
 *
 * Replaces Stripe Identity. The creator confirms legal name + DOB, uploads a
 * photo of their government ID to the private `verification` bucket, and an
 * admin reviews it in the trust & safety queue. Payouts use a separate manual
 * flow (PayPal/Venmo/CashApp/Zelle handle) — see updatePayoutHandle.
 */

export type KycStatus = "unverified" | "pending" | "verified" | "failed";
export type PayoutMethod = "paypal" | "venmo" | "cashapp" | "zelle";

export interface KycState {
  kycStatus: KycStatus;
  kycLastReason: string | null;
  legalName: string | null;
  dateOfBirth: string | null;
  payoutMethod: PayoutMethod | null;
  payoutHandle: string | null;
  payoutsEnabled: boolean;
  hasUploadedId: boolean;
}

export const PAYOUT_METHODS: Array<{ id: PayoutMethod; label: string; hint: string }> = [
  { id: "paypal", label: "PayPal", hint: "Email or PayPal.me link" },
  { id: "venmo", label: "Venmo", hint: "@username or phone" },
  { id: "cashapp", label: "Cash App", hint: "$cashtag" },
  { id: "zelle", label: "Zelle", hint: "Email or phone" },
];

async function authHeader(): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const FUNCTIONS_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

/** Fetch the current user's KYC + payout state from their profile row. */
export async function fetchKycState(): Promise<KycState | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "kyc_status, kyc_last_reason, legal_name, date_of_birth, payout_method, payout_handle, stripe_payouts_enabled",
    )
    .eq("id", uid)
    .maybeSingle();

  if (error) {
    console.error("[povme] fetchKycState:", error.message);
    throw error;
  }
  if (!data) return null;

  // Also check if there's an uploaded ID doc
  const { data: docs } = await supabase
    .from("verification_docs")
    .select("id")
    .eq("user_id", uid)
    .limit(1);

  return {
    kycStatus: (data.kyc_status ?? "unverified") as KycStatus,
    kycLastReason: data.kyc_last_reason ?? null,
    legalName: data.legal_name ?? null,
    dateOfBirth: data.date_of_birth ?? null,
    payoutMethod: (data.payout_method ?? null) as PayoutMethod | null,
    payoutHandle: data.payout_handle ?? null,
    payoutsEnabled: data.stripe_payouts_enabled ?? false,
    hasUploadedId: (docs?.length ?? 0) > 0,
  };
}

/** Pick a photo of the creator's government ID from the camera/library. */
export async function pickIdPhoto(
  source: "camera" | "library" = "camera",
): Promise<string | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return null;
    return result.assets[0].base64!;
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return null;
  return result.assets[0].base64!;
}

/**
 * Upload an ID photo (base64) to the private verification bucket and return
 * the storage path. Files are stored under {uid}/id-{timestamp}.jpg so RLS
 * scopes them to the owner.
 */
export async function uploadIdPhoto(base64: string): Promise<string> {
  const uid = await currentUserId();
  if (!uid) throw new Error("Not signed in");
  const path = `${uid}/id-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("verification")
    .upload(path, decode(base64), {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (error) {
    console.error("[povme] uploadIdPhoto:", error.message);
    throw error;
  }
  return path;
}

/** Decode a base64 string to a Uint8Array (RN has no atob for binary). */
function decode(base64: string): Uint8Array {
  const clean = base64.replace(/\s/g, "");
  const len = Math.floor(clean.length * 3) / 4;
  const bytes = new Uint8Array(len);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup: Record<string, number> = {};
  for (let i = 0; i < chars.length; i++) lookup[chars[i]] = i;
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = lookup[clean[i]] ?? 0;
    const c1 = lookup[clean[i + 1]] ?? 0;
    const c2 = lookup[clean[i + 2]] ?? 0;
    const c3 = lookup[clean[i + 3]] ?? 0;
    if (p < len) bytes[p++] = (c0 << 2) | (c1 >> 4);
    if (p < len) bytes[p++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (p < len) bytes[p++] = ((c2 & 3) << 6) | c3;
  }
  return bytes;
}

/**
 * Submit verification: self-attestation (legal name + DOB) + uploaded ID path.
 * Sets kyc_status to 'pending' and queues the doc for admin review.
 */
export async function submitVerification(input: {
  legalName: string;
  dateOfBirth: string; // YYYY-MM-DD
  storagePath: string;
  docType?: string;
}): Promise<{ ok: boolean; status: string }> {
  const headers = await authHeader();
  const res = await fetch(`${FUNCTIONS_URL}/functions/v1/submit-verification`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      legal_name: input.legalName,
      date_of_birth: input.dateOfBirth,
      storage_path: input.storagePath,
      doc_type: input.docType ?? "government_id",
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { error?: string })?.error ?? `Verification failed (${res.status})`;
    throw new Error(message);
  }
  return data as { ok: boolean; status: string };
}

/** Create a signed URL to view a verification doc (admin review). */
export async function createSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("verification")
    .createSignedUrl(path, 60);
  if (error) {
    console.error("[povme] createSignedUrl:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/**
 * Save the creator's payout handle (PayPal/Venmo/CashApp/Zelle).
 * Replaces Stripe Connect hosted onboarding.
 */
export async function updatePayoutHandle(input: {
  method: PayoutMethod;
  handle: string;
}): Promise<{ ok: boolean }> {
  const headers = await authHeader();
  const res = await fetch(`${FUNCTIONS_URL}/functions/v1/update-payout-handle`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      payout_method: input.method,
      payout_handle: input.handle,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { error?: string })?.error ?? `Save failed (${res.status})`;
    throw new Error(message);
  }
  return data as { ok: boolean };
}

/** Poll the profile row until KYC resolves or timeout. */
export async function pollKycStatus(timeoutMs = 120_000): Promise<KycState | null> {
  const start = Date.now();
  const interval = 4000;
  while (Date.now() - start < timeoutMs) {
    const state = await fetchKycState();
    if (state && (state.kycStatus === "verified" || state.kycStatus === "failed")) {
      return state;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return fetchKycState();
}

/**
 * Mark the signed-in user as a creator with their identity, categories, and
 * subscription price. Called after verification + payout setup complete.
 */
export async function publishCreatorProfile(input: {
  identity: string;
  categories: string[];
  subPrice: number;
  location?: string;
  bio?: string;
}): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error("Not signed in");
  const { error } = await supabase.from("profiles").update({
    is_creator: true,
    identity: input.identity,
    categories: input.categories,
    sub_price: input.subPrice,
    onboarded: true,
    location: input.location ?? null,
    bio: input.bio ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", uid);
  if (error) {
    console.error("[povme] publishCreatorProfile:", error.message);
    throw error;
  }
}
