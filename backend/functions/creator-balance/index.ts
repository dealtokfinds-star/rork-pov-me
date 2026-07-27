import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";

/**
 * GET /creator-balance
 *
 * Returns the creator's platform ledger balance + withdrawal history.
 * Stripe Connect is not used (Connect is not enabled on the platform Stripe
 * account), so balances come from profiles.payout_balance / pending_payout,
 * which the Stripe webhook credits on every fan payment.
 *
 * Returns: {
 *   available, pending, instant_available,
 *   payouts: Array<{ id, amount, status, arrival_date, method }>,
 *   payouts_enabled, payout_method, payout_handle,
 *   lifetime_earnings, pending_payout, account_status, minimum_payout
 * }
 */

const MIN_PAYOUT = 25;

const LABELS: Record<string, string> = {
  paypal: "PayPal",
  cashapp: "Cash App",
  venmo: "Venmo",
  zelle: "Zelle",
  bank: "Bank transfer",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const admin = createAdminClient();

    const { data: profile } = await admin.from("profiles")
      .select(
        "id, kyc_status, payout_method, payout_handle, stripe_payouts_enabled, lifetime_earnings, pending_payout, payout_balance",
      )
      .eq("id", user.userId)
      .maybeSingle();

    if (!profile) return json({ error: "Profile not found" }, 404);

    const { data: requests } = await admin.from("payout_requests")
      .select("id, amount, status, requested_at, processed_at, payout_method, admin_note")
      .eq("creator_id", user.userId)
      .order("requested_at", { ascending: false })
      .limit(15);

    const payouts = (requests ?? []).map((r) => ({
      id: r.id as string,
      amount: Number(r.amount ?? 0),
      status: (r.status as string) ?? "pending",
      arrival_date: (r.processed_at as string | null) ?? (r.requested_at as string | null),
      method: LABELS[(r.payout_method as string) ?? ""] ?? "Manual",
      note: (r.admin_note as string | null) ?? null,
    }));

    const method = profile.payout_method as string | null;
    const available = Number(profile.payout_balance ?? 0);
    const pending = Number(profile.pending_payout ?? 0);
    const verified = profile.kyc_status === "verified";
    const notHeld = profile.stripe_payouts_enabled !== false;

    return json({
      available,
      pending,
      instant_available: available,
      payouts,
      payouts_enabled: Boolean(method) && verified && notHeld,
      payout_method: method,
      payout_label: method ? (LABELS[method] ?? method) : null,
      payout_handle: (profile.payout_handle as string | null) ?? null,
      lifetime_earnings: Number(profile.lifetime_earnings ?? 0),
      pending_payout: pending,
      account_status: method ? (verified ? "ready" : "awaiting_review") : "missing",
      minimum_payout: MIN_PAYOUT,
      onboarding_url: null,
    });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: "Unauthorized" }, 401);
    console.error("[creator-balance] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
