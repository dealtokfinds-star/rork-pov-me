import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";

/**
 * POST /request-payout
 *
 * Platform-managed withdrawal. Stripe Connect is not available on this
 * platform account, so payouts run off the local ledger:
 *
 *   1. Fan payments settle to the platform Stripe account.
 *   2. The webhook credits the creator's 80% share to profiles.payout_balance.
 *   3. This endpoint moves the requested amount into pending_payout and files a
 *      row in payout_requests.
 *   4. The payouts team sends the money to the creator's saved destination and
 *      marks it paid (or failed, which refunds the balance) from the admin panel.
 *
 * Body: { amount?: number }  // dollars; omitted = full available balance
 * Returns: { request_id, amount, status, method, handle, eta }
 */

const MIN_PAYOUT = 25;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({})) as { amount?: number };
    const admin = createAdminClient();

    const { data: profile } = await admin.from("profiles")
      .select("id, kyc_status, payout_method, payout_handle, payout_balance, pending_payout, stripe_payouts_enabled")
      .eq("id", user.userId)
      .maybeSingle();

    if (!profile) return json({ error: "Profile not found" }, 404);

    const method = profile.payout_method as string | null;
    const handle = profile.payout_handle as string | null;

    if (!method || !handle) {
      return json({ error: "Add a payout destination first (PayPal, Cash App, Venmo, Zelle or bank)" }, 400);
    }
    if (profile.stripe_payouts_enabled === false) {
      return json({ error: "Payouts are on hold for this account. Contact support." }, 403);
    }
    if (profile.kyc_status !== "verified") {
      return json({ error: "Your ID review must be approved before you can withdraw" }, 403);
    }

    // Block duplicate open requests
    const { data: open } = await admin.from("payout_requests")
      .select("id")
      .eq("creator_id", user.userId)
      .in("status", ["pending", "processing"])
      .limit(1);

    if ((open?.length ?? 0) > 0) {
      return json({ error: "You already have a withdrawal in progress" }, 409);
    }

    const available = Number(profile.payout_balance ?? 0);
    const requested = body.amount && body.amount > 0 ? Number(body.amount) : available;
    const amount = Math.floor(requested * 100) / 100;

    if (amount < MIN_PAYOUT) {
      return json({ error: `Minimum withdrawal is $${MIN_PAYOUT.toFixed(2)}` }, 400);
    }
    if (amount > available) {
      return json({ error: `Insufficient balance. Available: $${available.toFixed(2)}` }, 400);
    }

    const { data: request, error: insertError } = await admin.from("payout_requests")
      .insert({
        creator_id: user.userId,
        amount,
        payout_method: method,
        payout_handle: handle,
        status: "pending",
        requested_at: new Date().toISOString(),
      })
      .select("id, amount, status, requested_at")
      .single();

    if (insertError || !request) {
      console.error("[request-payout] insert failed:", insertError?.message);
      return json({ error: "Could not file your withdrawal request" }, 500);
    }

    // Reserve the funds so they can't be requested twice.
    const { error: ledgerError } = await admin.from("profiles").update({
      payout_balance: Math.max(0, available - amount),
      pending_payout: Number(profile.pending_payout ?? 0) + amount,
      updated_at: new Date().toISOString(),
    }).eq("id", user.userId);

    if (ledgerError) {
      // Roll the request back so the ledger and the queue never diverge.
      await admin.from("payout_requests").delete().eq("id", request.id);
      console.error("[request-payout] ledger update failed:", ledgerError.message);
      return json({ error: "Could not reserve your balance — try again" }, 500);
    }

    return json({
      request_id: request.id,
      amount,
      status: "pending",
      method,
      handle,
      eta: "1–3 business days",
    });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: "Unauthorized" }, 401);
    console.error("[request-payout] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
