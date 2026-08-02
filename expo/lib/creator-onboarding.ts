import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";
import { callEdge } from "@/lib/edge";

/** Returns the current user's id from the Supabase auth session. */
async function currentUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
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
  /** Creator profile fields (prefilled for returning creators). */
  identity: string | null;
  categories: string[] | null;
  subPrice: number | null;
  isCreator: boolean;
  onboarded: boolean;
}

/** Fetch the current user's KYC + payout state from their profile row. */
export async function fetchKycState(): Promise<KycState | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "kyc_status, kyc_last_reason, kyc_submitted_at, kyc_reviewed_at, payout_method, payout_paypal_email, payout_bank_account_last4, payout_bank_country, identity, categories, sub_price, is_creator, onboarded",
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
    identity: data.identity ?? null,
    categories: Array.isArray(data.categories) ? (data.categories as string[]) : null,
    subPrice: typeof data.sub_price === "number" ? data.sub_price : null,
    isCreator: Boolean(data.is_creator),
    onboarded: Boolean(data.onboarded),
  };
}

/**
 * Read a local image URI as base64 (no data: prefix). On native this uses
 * expo-file-system; on web it fetches the blob and reads it as a data URL.
 */
async function readImageAsBase64(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Strip the `data:<mime>;base64,` prefix.
        const commaIdx = result.indexOf(",");
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(blob);
    });
  }
  const { readAsStringAsync } = await import("expo-file-system");
  return await readAsStringAsync(uri, { encoding: "base64" as never });
}

/** Infer a MIME type from a URI's extension (defaults to jpeg). */
function contentTypeForUri(uri: string): string {
  const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  return ext === "png" ? "image/png" : "image/jpeg";
}

/**
 * Submit KYC documents for review. Reads the three images as base64 and
 * sends them to the `submit-kyc` edge function, which uploads them to the
 * private `kyc-documents` storage bucket server-side (service role bypasses
 * RLS, avoiding client-side storage policy and CORS issues). Auto-approves
 * on the backend → `kyc_status='verified'` immediately.
 */
export async function submitKyc(input: {
  frontUri: string;
  backUri: string;
  selfieUri: string;
}): Promise<{ ok: boolean; kyc_status: string }> {
  const [frontData, backData, selfieData] = await Promise.all([
    readImageAsBase64(input.frontUri),
    readImageAsBase64(input.backUri),
    readImageAsBase64(input.selfieUri),
  ]);

  return callEdge<{ ok: boolean; kyc_status: string }>("submit-kyc", {
    documents: {
      front: { data: frontData, contentType: contentTypeForUri(input.frontUri) },
      back: { data: backData, contentType: contentTypeForUri(input.backUri) },
      selfie: { data: selfieData, contentType: contentTypeForUri(input.selfieUri) },
    },
  });
}

/**
 * Save payout details (PayPal or bank) directly on the user's profile row.
 *
 * The `profiles` RLS policy `(user_id() = id)` lets a signed-in user
 * update their own row, so no edge function is needed. Only the last 4
 * digits of the bank account number are stored — extracted client-side so
 * the full account number never leaves the device.
 *
 * Returns `{ ok, method }` to keep the same shape as the old edge-function
 * implementation.
 */
export async function savePayoutDetails(input: {
  method: "paypal" | "bank";
  paypalEmail?: string;
  bankAccountHolder?: string;
  bankAccountNumber?: string;
  bankRouting?: string;
  bankCountry?: string;
}): Promise<{ ok: boolean; method: string }> {
  const uid = await currentUserId();
  if (!uid) throw new Error("Not signed in");

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    payout_method: input.method,
    updated_at: now,
  };

  if (input.method === "paypal") {
    const email = input.paypalEmail?.trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new Error("A valid PayPal email is required");
    }
    update.payout_paypal_email = email;
    // Clear any bank fields
    update.payout_bank_account_holder = null;
    update.payout_bank_account_last4 = null;
    update.payout_bank_routing = null;
    update.payout_bank_country = null;
  } else {
    const holder = input.bankAccountHolder?.trim();
    const number = input.bankAccountNumber?.replace(/\s/g, "");
    const routing = input.bankRouting?.replace(/\s/g, "");
    const country = input.bankCountry?.trim().toUpperCase();

    if (!holder) throw new Error("Account holder name is required");
    if (!number || number.length < 4) throw new Error("A valid account number is required");
    if (!routing) throw new Error("Routing number is required");
    if (!country || country.length !== 2) throw new Error("Country (2-letter ISO) is required");

    // Store only last 4 digits of the account number
    update.payout_bank_account_holder = holder;
    update.payout_bank_account_last4 = number.slice(-4);
    update.payout_bank_routing = routing;
    update.payout_bank_country = country;
    // Clear PayPal field
    update.payout_paypal_email = null;
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", uid);
  if (error) {
    console.error("[povme] savePayoutDetails:", error.message);
    throw new Error(error.message || "Failed to save payout details");
  }
  return { ok: true, method: input.method };
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
