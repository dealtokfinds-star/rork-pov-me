import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";

/**
 * GET /creator-balance
 * Returns the creator's platform-managed balance + payout history.
 * Replaces the Stripe Connect balance endpoint.
 *
 * Returns: {
 *   available: number,         // payout_balance (ready to withdraw)
 *   pending: number,           // pending_payout (in-flight payout requests)
 *   instant_available: number, // alias of available (compat)
 *   payouts: Array<{ id, amount, status, requested_at, payout_method }>,
 *   payouts_enabled: boolean,
 *   payout_method: string | null,
 *   payout_handle: string | null,
 *   lifetime_earnings: number,
 *   pending_payout: number,
 * }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const admin = createAdminClient();

    const { data: profile } = await admin.from("profiles")
      .select("id, payout_method, payout_handle, stripe_payouts_enabled, lifetime_earnings, pending_payout, payout_balance")
      .eq("id", user.userId)
      .maybeSingle();

    if (!profile) return json({ error: "Profile not found" }, 404);

    // Recent payout requests (this creator)
    const { data: payouts } = await admin.from("payout_requests")
      .select("id, amount, status, payout_method, requested_at, processed_at")
      .eq("creator_id", user.userId)
      .order("requested_at", { ascending: false })
      .limit(10);

    const list = (payouts ?? []).map((p: Record<string, unknown>) => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      arrival_date: p.processed_at ?? p.requested_at,
      method: p.payout_method ?? "manual",
    }));

    const available = Number(profile.payout_balance ?? 0);

    return json({
      available,
      pending: Number(profile.pending_payout ?? 0),
      instant_available: available,
      payouts: list,
      payouts_enabled: profile.stripe_payouts_enabled ?? false,
      payout_method: profile.payout_method ?? null,
      payout_handle: profile.payout_handle ?? null,
      lifetime_earnings: Number(profile.lifetime_earnings ?? 0),
      pending_payout: Number(profile.pending_payout ?? 0),
    });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: "Unauthorized" }, 401);
    console.error("[creator-balance] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
