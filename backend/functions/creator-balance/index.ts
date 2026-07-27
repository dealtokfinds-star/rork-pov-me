import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";
import { retrieveBalance, retrieveAccount, StripeError } from "../_shared/stripe.ts";
import { useLemonSqueezy } from "../_shared/lemonsqueezy.ts";

/**
 * GET /creator-balance
 * Returns the creator's available balance, pending balance, and recent
 * payout history.
 *
 * For Lemon Squeezy (MoR) mode: reads from the `payouts` table +
 * `payout_balance` / `pending_payout` / `lifetime_earnings` columns on the
 * profile (the platform credits the creator's 80% share on each webhook).
 *
 * For Stripe (legacy) mode: fetches the live Stripe Connect balance.
 *
 * Returns: {
 *   available: number,       // in USD
 *   pending: number,
 *   instant_available: number,
 *   payouts: Array<{ id, amount, status, arrival_date, method }>,
 *   payouts_enabled: boolean,
 *   lifetime_earnings: number,
 *   pending_payout: number,
 *   payout_method: string | null,   // "paypal" | "bank" (LS mode)
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
    const useLS = useLemonSqueezy();

    const { data: profile } = await admin.from("profiles")
      .select("id, stripe_account_id, stripe_payouts_enabled, lifetime_earnings, pending_payout, payout_balance, payout_method, payout_paypal_email, payout_bank_account_last4, payout_bank_country")
      .eq("id", user.userId)
      .maybeSingle();

    if (!profile) {
      return json({ error: "Profile not found" }, 404);
    }

    // ---- Lemon Squeezy path: read from our tables ----
    if (useLS || !profile.stripe_account_id) {
      const { data: payoutRows } = await admin.from("payouts")
        .select("id, amount, status, method, processed_at, requested_at")
        .eq("creator_id", user.userId)
        .order("requested_at", { ascending: false })
        .limit(10);

      const payouts = (payoutRows ?? []).map((p: Record<string, unknown>) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status ?? "pending",
        arrival_date: (p.processed_at as string) ?? (p.requested_at as string) ?? null,
        method: p.method ?? "platform_transfer",
      }));

      const hasPayoutDetails = !!profile.payout_method;
      return json({
        available: Number(profile.payout_balance ?? 0),
        pending: 0,
        instant_available: 0,
        payouts,
        payouts_enabled: hasPayoutDetails,
        lifetime_earnings: Number(profile.lifetime_earnings ?? 0),
        pending_payout: Number(profile.pending_payout ?? 0),
        payout_method: profile.payout_method ?? null,
        payout_method_label: profile.payout_method === "paypal"
          ? `PayPal · ${profile.payout_paypal_email ?? ""}`
          : profile.payout_method === "bank"
          ? `Bank · ••••${profile.payout_bank_account_last4 ?? ""} (${profile.payout_bank_country ?? ""})`
          : null,
      });
    }

    // ---- Stripe path (legacy) ----
    const balance = await retrieveBalance(profile.stripe_account_id);
    const availableUsd = (balance.available?.[0]?.amount ?? 0) / 100;
    const pendingUsd = (balance.pending?.[0]?.amount ?? 0) / 100;
    const instantUsd = (balance.instant_available?.[0]?.amount ?? 0) / 100;

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
      payout_method: null,
      payout_method_label: "Stripe Connect",
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
