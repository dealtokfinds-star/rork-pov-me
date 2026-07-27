import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";
import { retrieveBalance, retrieveAccount, StripeError } from "../_shared/stripe.ts";

/**
 * GET /creator-balance
 * Returns the creator's available balance from Stripe Connect,
 * pending balance, and recent payout history.
 *
 * Returns: {
 *   available: number,       // in USD (cents → dollars)
 *   pending: number,
 *   instant_available: number,
 *   payouts: Array<{ id, amount, status, arrival_date, method }>,
 *   payouts_enabled: boolean,
 *   lifetime_earnings: number,  // from profiles table
 *   pending_payout: number,     // from profiles table
 * }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const user = await requireAuth(req);
    const admin = createAdminClient();

    const { data: profile } = await admin.from("profiles")
      .select("id, stripe_account_id, stripe_payouts_enabled, lifetime_earnings, pending_payout, payout_balance")
      .eq("id", user.userId)
      .maybeSingle();

    if (!profile) {
      return json({ error: "Profile not found" }, 404);
    }

    if (!profile.stripe_account_id) {
      return json({
        available: 0,
        pending: 0,
        instant_available: 0,
        payouts: [],
        payouts_enabled: false,
        lifetime_earnings: Number(profile.lifetime_earnings ?? 0),
        pending_payout: Number(profile.pending_payout ?? 0),
      });
    }

    // Fetch balance from Stripe Connect account
    const balance = await retrieveBalance(profile.stripe_account_id);
    const availableUsd = (balance.available?.[0]?.amount ?? 0) / 100;
    const pendingUsd = (balance.pending?.[0]?.amount ?? 0) / 100;
    const instantUsd = (balance.instant_available?.[0]?.amount ?? 0) / 100;

    // Fetch recent payouts (last 10)
    const payoutsRes = await fetch(
      `https://api.stripe.com/v1/payouts?limit=10`,
      {
        headers: {
          Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
          "Stripe-Account": profile.stripe_account_id,
        },
      },
    );
    const payoutsData = await payoutsRes.json().catch(() => ({ data: [] }));
    const payouts = (payoutsData.data ?? []).map((p: Record<string, unknown>) => ({
      id: p.id,
      amount: (p.amount as number) / 100,
      status: p.status,
      arrival_date: p.arrival_date ? new Date((p.arrival_date as number) * 1000).toISOString() : null,
      method: p.method,
    }));

    return json({
      available: availableUsd,
      pending: pendingUsd,
      instant_available: instantUsd,
      payouts,
      payouts_enabled: profile.stripe_payouts_enabled ?? false,
      lifetime_earnings: Number(profile.lifetime_earnings ?? 0),
      pending_payout: Number(profile.pending_payout ?? 0),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (err instanceof StripeError) {
      console.error("[creator-balance] Stripe error:", err.status, err.body);
      return json({ error: err.message }, err.status);
    }
    console.error("[creator-balance] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
