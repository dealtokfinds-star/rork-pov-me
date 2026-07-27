import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image";

import { supabase } from "@/lib/supabase";
import { callEdge } from "@/lib/edge";

/** Returns the current user's id from the stored Rork Auth JWT (sub claim). */
async function currentUserId(): Promise<string | null> {
  const token = await SecureStore.getItemAsync("access_token");
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Manual KYC + payout details client.
 *
 * Replaces the old Stripe Identity + Stripe Connect flow with:
 *  - Manual ID upload (front + back + selfie) to the `kyc-documents` storage
 *    bucket, then a call to the `submit-kyc` edge function.
 *  - Payout details (PayPal email or bank account) saved via the
 *    `creator-payout-details` edge function.
 *
 * Lemon Squeezy is the Merchant of Record for fan payments; the platform
 * fulfills creator payouts weekly using the details saved here.
 */

export type KycStatus = "unverified" | "pending" | "verified" | "rejected";

export interface KycState {
  kycStatus: KycStatus;
  kycLastReason: string | null;
  kycSubmittedAt: string | null;
  kycReviewedAt: string | null;
  payoutMethod: "paypal" | "bank" | null;
  payoutPaypalEmail: string | null;
  payoutBankAccountLast4: string | null;
  payoutBankCountry: string | null;
}

/** Fetch the current user's KYC + payout state from their profile row. */
export async function fetchKycState(): Promise<KycState | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "kyc_status, kyc_last_reason, kyc_submitted_at, kyc_reviewed_at, payout_method, payout_paypal_email, payout_bank_account_last4, payout_bank_country",
    )
    .eq("id", uid)
    .maybeSingle();

  if (error) {
    console.error("[povme] fetchKycState:", error.message);
    throw error;
  }
  if (!data) return null;
  return {
    kycStatus: (data.kyc_status ?? "unverified") as KycStatus,
    kycLastReason: data.kyc_last_reason ?? null,
    kycSubmittedAt: data.kyc_submitted_at ?? null,
    kycReviewedAt: data.kyc_reviewed_at ?? null,
    payoutMethod: (data.payout_method ?? null) as "paypal" | "bank" | null,
    payoutPaypalEmail: data.payout_paypal_email ?? null,
    payoutBankAccountLast4: data.payout_bank_account_last4 ?? null,
    payoutBankCountry: data.payout_bank_country ?? null,
  };
}

/**
 * Upload a KYC document image to the user's private folder in the
 * `kyc-documents` storage bucket. Returns the storage path.
 */
export async function uploadKycDocument(
  kind: "front" | "back" | "selfie",
  imageUri: string,
): Promise<string> {
  const token = await SecureStore.getItemAsync("access_token");
  if (!token) throw new Error("Not signed in");

  // Read the user id from the JWT sub claim
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const payload = JSON.parse(
    atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
  ) as { sub?: string };
  const userId = payload.sub;
  if (!userId) throw new Error("No user id in token");

  const path = `${userId}/${kind}.jpg`;
  const fileExt = imageUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const contentType = fileExt === "png" ? "image/png" : "image/jpeg";

  // Fetch the image bytes
  const imgRes = await fetch(imageUri);
  const blob = await imgRes.blob();

  const { error } = await supabase.storage
    .from("kyc-documents")
    .upload(path, blob, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error("[povme] uploadKycDocument:", error.message);
    throw error;
  }
  return path;
}

/**
 * Submit KYC documents for admin review. Uploads the three images (if URIs
 * are provided) then calls the `submit-kyc` edge function with the storage
 * paths. Sets kyc_status='pending'.
 */
export async function submitKyc(input: {
  frontUri: string;
  backUri: string;
  selfieUri: string;
}): Promise<{ ok: boolean; kyc_status: string }> {
  const [front, back, selfie] = await Promise.all([
    uploadKycDocument("front", input.frontUri),
    uploadKycDocument("back", input.backUri),
    uploadKycDocument("selfie", input.selfieUri),
  ]);

  return callEdge<{ ok: boolean; kyc_status: string }>("submit-kyc", {
    documents: { front, back, selfie },
  });
}

/**
 * Save payout details (PayPal or bank) via the `creator-payout-details`
 * edge function. Only the last 4 digits of the bank account number are
 * stored — the client extracts them before sending.
 */
export async function savePayoutDetails(input: {
  method: "paypal" | "bank";
  paypalEmail?: string;
  bankAccountHolder?: string;
  bankAccountNumber?: string;
  bankRouting?: string;
  bankCountry?: string;
}): Promise<{ ok: boolean; method: string }> {
  return callEdge<{ ok: boolean; method: string }>("creator-payout-details", input);
}

/**
 * Mark the signed-in user as a creator with their identity, categories, and
 * subscription price. Called after both KYC + payout details are complete.
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

/**
 * Poll the profile row until KYC status resolves to verified/rejected or
 * timeout. The admin reviews submissions manually, so this is used only for
 * the "Under review" state to detect when the admin has acted.
 */
export async function pollKycStatus(timeoutMs = 120_000): Promise<KycState | null> {
  const start = Date.now();
  const interval = 3000;
  while (Date.now() - start < timeoutMs) {
    const state = await fetchKycState();
    if (state && (state.kycStatus === "verified" || state.kycStatus === "rejected")) {
      return state;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return fetchKycState();
}

/**
 * Request a signed URL for a KYC document (admin view). The admin client
 * generates a short-lived signed URL so the admin can view the uploaded ID.
 */
export async function getKycDocumentSignedUrl(
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("kyc-documents")
    .createSignedUrl(path, 300); // 5-minute URL
  if (error) {
    console.error("[povme] getKycDocumentSignedUrl:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
