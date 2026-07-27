import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";

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
 * KYC / Stripe Connect client.
 *
 * Talks to the `create-verification`, `connect-account`, and `stripe-webhook`
 * edge functions. Stripe Identity handles government ID + selfie liveness;
 * Stripe Connect (Express) handles creator payouts. Both are launched via
 * Stripe-hosted pages opened in an in-app browser session.
 */

export type KycStatus = "unverified" | "pending" | "verified" | "failed";
export type StripeAccountStatus = "none" | "restricted" | "enabled" | "rejected";

export interface KycState {
  kycStatus: KycStatus;
  kycSessionUrl: string | null;
  kycLastReason: string | null;
  stripeAccountId: string | null;
  stripeAccountStatus: StripeAccountStatus;
  stripePayoutsEnabled: boolean;
}

interface VerificationResponse {
  url: string;
  session_id: string;
  status: string;
}

interface ConnectResponse {
  url: string;
  account_id: string;
  payouts_enabled: boolean;
  details_submitted: boolean;
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Start a Stripe Identity verification session and open the hosted page.
 * The edge function stores the session id + URL on the profile row.
 */
export async function startIdentityVerification(returnUrl?: string): Promise<VerificationResponse> {
  const headers = await authHeader();
  const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-verification`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ return_url: returnUrl }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { error?: string })?.error ?? `Verification failed (${res.status})`;
    throw new Error(message);
  }
  return data as VerificationResponse;
}

/**
 * Create or reuse a Stripe Connect Express account and return a hosted
 * onboarding link. The edge function stores the account id + status.
 */
export async function startConnectOnboarding(input: {
  country?: string;
  refreshUrl?: string;
  returnUrl?: string;
}): Promise<ConnectResponse> {
  const headers = await authHeader();
  const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/connect-account`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      country: input.country,
      refresh_url: input.refreshUrl,
      return_url: input.returnUrl,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { error?: string })?.error ?? `Connect failed (${res.status})`;
    throw new Error(message);
  }
  return data as ConnectResponse;
}

const APP_SCHEME = process.env.EXPO_PUBLIC_PROJECT_ID
  ? `rork-${process.env.EXPO_PUBLIC_PROJECT_ID}`
  : "rork-app";

/** Open a Stripe hosted URL in an in-app browser session. Returns when closed. */
export async function openHostedPage(
  url: string,
): Promise<WebBrowser.WebBrowserAuthSessionResult> {
  return WebBrowser.openAuthSessionAsync(url, `${APP_SCHEME}://kyc-return`);
}

/** Fetch the current user's KYC + Connect state from their profile row. */
export async function fetchKycState(): Promise<KycState | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("kyc_status, kyc_session_url, kyc_last_reason, stripe_account_id, stripe_account_status, stripe_payouts_enabled")
    .eq("id", uid)
    .maybeSingle();

  if (error) {
    console.error("[povme] fetchKycState:", error.message);
    throw error;
  }
  if (!data) return null;
  return {
    kycStatus: (data.kyc_status ?? "unverified") as KycStatus,
    kycSessionUrl: data.kyc_session_url ?? null,
    kycLastReason: data.kyc_last_reason ?? null,
    stripeAccountId: data.stripe_account_id ?? null,
    stripeAccountStatus: (data.stripe_account_status ?? "none") as StripeAccountStatus,
    stripePayoutsEnabled: data.stripe_payouts_enabled ?? false,
  };
}

/**
 * Poll the profile row until KYC status resolves to verified/failed or timeout.
 * The stripe-webhook edge function updates the row asynchronously from Stripe.
 */
export async function pollKycStatus(timeoutMs = 120_000): Promise<KycState | null> {
  const start = Date.now();
  const interval = 3000;
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
 * subscription price. Called after both KYC and Connect complete.
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
