import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

/**
 * POVMe payments client.
 *
 * Calls Supabase Edge Functions to create Stripe Checkout Sessions,
 * then opens the hosted checkout in the system browser (mobile) or
 * a popup (web). After payment, Stripe redirects back to the app
 * via the deep link, and the webhook updates the database.
 *
 * Payment types:
 *   - topup:  Add funds to wallet
 *   - tip:    One-time tip to a creator
 *   - ppv:    Unlock a pay-per-view episode or stream
 *   - sub:    Monthly subscription to a creator
 */

const FUNCTIONS_URL = process.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL!;
const PROJECT_ID = process.env.EXPO_PUBLIC_PROJECT_ID!;

export type PaymentType = "topup" | "tip" | "ppv" | "sub";

export interface CreateCheckoutParams {
  type: PaymentType;
  amount?: number;
  creator_id?: string;
  episode_id?: string;
  stream_id?: string;
  message?: string;
}

export interface CheckoutResult {
  url: string;
  session_id: string;
}

export interface CheckoutOpenResult {
  success: boolean;
  session_id?: string;
  error?: string;
}

async function getAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync("access_token");
}

function buildReturnUrl(path: string): string {
  // Deep link back to the app after checkout
  if (Platform.OS === "web") {
    return `${window.location.origin}${path}`;
  }
  return `rork-${PROJECT_ID}://${path}`;
}

/**
 * Create a Stripe Checkout Session via the create-checkout edge function.
 */
export async function createCheckoutSession(
  params: CreateCheckoutParams,
): Promise<CheckoutResult> {
  const token = await getAuthToken();
  if (!token) throw new Error("Not authenticated");

  const returnUrl = buildReturnUrl("/payment/success");
  const cancelUrl = buildReturnUrl("/payment/cancel");

  const response = await fetch(`${FUNCTIONS_URL}/create-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...params,
      return_url: returnUrl,
      cancel_url: cancelUrl,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Checkout failed (${response.status})`);
  }

  const data = (await response.json()) as CheckoutResult;
  return data;
}

/**
 * Create a checkout session and open it in the browser.
 * Returns whether the user completed the payment successfully.
 *
 * On mobile, uses expo-web-browser's openAuthSessionAsync so the
 * redirect returns to the app. On web, opens a popup window.
 */
export async function openCheckout(
  params: CreateCheckoutParams,
): Promise<CheckoutOpenResult> {
  try {
    const { url, session_id } = await createCheckoutSession(params);

    if (Platform.OS === "web") {
      const popup = window.open(url, "_blank", "width=480,height=720");
      if (!popup) {
        return { success: false, error: "Popup blocked — allow popups to pay" };
      }
      // On web we can't reliably detect completion; return the session id
      // so the caller can poll or show a "complete your payment" state.
      return { success: true, session_id };
    }

    const result = await WebBrowser.openAuthSessionAsync(
      url,
      `rork-${PROJECT_ID}://payment/success`,
    );

    if (result.type === "success") {
      return { success: true, session_id };
    }
    return { success: false, session_id, error: "Payment cancelled" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment failed";
    console.error("[povme] openCheckout:", message);
    return { success: false, error: message };
  }
}

/**
 * Cancel a subscription via the cancel-subscription edge function.
 */
export async function cancelSubscription(
  creatorId: string,
): Promise<{ active: boolean; canceled_at: string | null; renews_at: string | null }> {
  const token = await getAuthToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${FUNCTIONS_URL}/cancel-subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ creator_id: creatorId }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Cancel failed (${response.status})`);
  }

  return response.json();
}

/**
 * Fetch the creator's Stripe Connect balance and payout history.
 */
export interface CreatorBalance {
  available: number;
  pending: number;
  instant_available: number;
  payouts: Array<{
    id: string;
    amount: number;
    status: string;
    arrival_date: string | null;
    method: string;
  }>;
  payouts_enabled: boolean;
  lifetime_earnings: number;
  pending_payout: number;
  /** LS-mode label, e.g. "PayPal · you@example.com" or "Bank · ••••1234 (US)". Null in Stripe mode. */
  payout_method?: string | null;
  /** LS-mode label string (PayPal/bank details) or "Stripe Connect" in legacy mode. */
  payout_method_label?: string | null;
}

export async function fetchCreatorBalance(): Promise<CreatorBalance> {
  const token = await getAuthToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${FUNCTIONS_URL}/creator-balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to load balance (${response.status})`);
  }

  return response.json();
}

/**
 * Request a payout to the creator's linked bank account.
 */
export async function requestPayout(
  amount?: number,
): Promise<{
  payout_id: string;
  amount: number;
  status: string;
  arrival_date: string | null;
}> {
  const token = await getAuthToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${FUNCTIONS_URL}/request-payout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ amount }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Payout failed (${response.status})`);
  }

  return response.json();
}
