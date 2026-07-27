import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";
import { retrieveBalance, listPayouts, StripeError, type Payout } from "../_shared/stripe.ts";

/**
 * GET /creator-balance
 * Returns the creator's Stripe Connect balance + recent Stripe payouts.
 *
 * Pulls the live balance from Stripe (on the creator's Express account) so the
 * numbers reflect real funds, not just our local ledger. Falls back to the
 * platform-managed ledger (payout_balance / pending_payout) when the creator
 * has not finished Connect onboarding yet.
 *
 * Returns: {
 *   available: number,          // Stripe available balance (or local payout_balance)
 *   pending: number,            // Stripe pending balance (or local pending_payout)
 *   instant_available: number,  // Stripe instant_available (if any)
 *   payouts: Array<{ id, amount, status, arrival_date, method }>,
 *   payouts_enabled: boolean,   // account.payouts_enabled
 *   payout_method: string | null,  // "stripe" when connected
 *   payout_handle: string | null,  // last 4 of bank/debit card via payouts_enabled
 *   lifetime_earnings: number,
 *   pending_payout: number,     // alias of pending (compat with UI)
 *   account_status: string,     // restricted | enabled | missing
 *   onboarding_url: string | null, // hosted link if onboarding incomplete
 * }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const admin = createAdminClient();

    const { data: profile } = await admin.from("profiles")
      .select(
        "id, stripe_account_id, stripe_account_status, stripe_payouts_enabled, stripe_onboarding_url, lifetime_earnings, pending_payout, payout_balance",
      )
      .eq("id", user.userId)
      .maybeSingle();

    if (!profile) return json({ error: "Profile not found" }, 404);

    const accountId = profile.stripe_account_id as string | null;
    const payoutsEnabled = profile.stripe_payouts_enabled ?? false;

    // ---- No Connect account yet: fall back to the local ledger ----
    if (!accountId) {
      const available = Number(profile.payout_balance ?? 0);
      return json({
        available,
        pending: Number(profile.pending_payout ?? 0),
        instant_available: available,
        payouts: [],
        payouts_enabled: false,
        payout_method: null,
        payout_handle: null,
        lifetime_earnings: Number(profile.lifetime_earnings ?? 0),
        pending_payout: Number(profile.pending_payout ?? 0),
        account_status: "missing",
        onboarding_url: null,
      });
    }

    // ---- Live Stripe Connect balance ----
    let available = 0;
    let pending = Number(profile.pending_payout ?? 0);
    let instantAvailable = 0;
    let payouts: Array<{ id: string; amount: number; status: string; arrival_date: string | null; method: string }> = [];
    let accountStatus = profile.stripe_account_status ?? "restricted";

    try {
      const bal = await retrieveBalance(accountId);
      available = (bal.available?.[0]?.amount ?? 0) / 100;
      instantAvailable = (bal.instant_available?.[0]?.amount ?? 0) / 100;
      pending = (bal.pending?.[0]?.amount ?? 0) / 100;

      const recent = await listPayouts(accountId, 10);
      payouts = (recent.data ?? []).map((p: Payout) => ({
        id: p.id,
        amount: p.amount / 100,
        status: p.status,
        arrival_date: p.arrival_date ? new Date(p.arrival_date * 1000).toISOString() : null,
        method: p.method ?? "standard",
      }));
    } catch (err) {
      // If Stripe lookup fails (account restricted, etc.), fall back to local ledger
      console.error("[creator-balance] Stripe lookup failed:", err);
      available = Number(profile.payout_balance ?? 0);
      pending = Number(profile.pending_payout ?? 0);
    }

    return json({
      available,
      pending,
      instant_available: instantAvailable || available,
      payouts,
      payouts_enabled: payoutsEnabled,
      payout_method: payoutsEnabled ? "stripe" : null,
      payout_handle: payoutsEnabled ? "Stripe balance" : null,
      lifetime_earnings: Number(profile.lifetime_earnings ?? 0),
      pending_payout: pending,
      account_status: accountStatus,
      onboarding_url: profile.stripe_onboarding_url ?? null,
    });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: "Unauthorized" }, 401);
    if (err instanceof StripeError) {
      console.error("[creator-balance] Stripe error:", err.status, err.body);
      return json({ error: err.message }, err.status);
    }
    console.error("[creator-balance] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
