import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";

/**
 * POST /request-payout
 * Creates a manual payout request (replaces Stripe Connect automatic payouts).
 *
 * Body: { amount?: number }  // if omitted, pays out full available balance
 * Returns: { request_id: string, amount: number, status: string }
 *
 * The platform processes the payout manually via the creator's saved handle
 * (PayPal/Venmo/CashApp/Zelle) and marks it paid in the admin queue.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({})) as { amount?: number };
    const admin = createAdminClient();

    const { data: profile } = await admin.from("profiles")
      .select("id, payout_method, payout_handle, payout_address, payout_network, payout_account_last4, payout_label, stripe_payouts_enabled, pending_payout, payout_balance, lifetime_earnings")
      .eq("id", user.userId)
      .maybeSingle();

    if (!profile) return json({ error: "Profile not found" }, 404);
    if (!profile.payout_method) {
      return json({ error: "Add a payout destination first (USDC, bank ACH, PayPal, Venmo, Cash App, or Zelle)" }, 400);
    }
    // P2P methods require a handle; crypto/bank require an address.
    const needsHandle = ["paypal", "venmo", "cashapp", "zelle"].includes(profile.payout_method);
    if (needsHandle && !profile.payout_handle) {
      return json({ error: "Add a payout handle first" }, 400);
    }
    if (!needsHandle && !profile.payout_address) {
      return json({ error: "Add a payout address first" }, 400);
    }
    if (!profile.stripe_payouts_enabled) {
      return json({ error: "Payouts not enabled — add a payout destination" }, 400);
    }

    // Available balance = payout_balance (accrued creator share, platform-managed)
    const available = Number(profile.payout_balance ?? 0);
    let amount: number;
    if (body.amount && body.amount > 0) {
      amount = Math.round(body.amount * 100) / 100;
      if (amount > available) {
        return json({ error: `Insufficient balance. Available: $${available.toFixed(2)}` }, 400);
      }
    } else {
      amount = Math.round(available * 100) / 100;
    }

    if (amount < 1) {
      return json({ error: "Minimum payout is $1.00" }, 400);
    }

    // Insert a payout request row — admin marks it paid after sending manually.
    // Snapshot the destination so the admin queue shows exactly where to send.
    const { data: reqRow, error: reqErr } = await admin.from("payout_requests").insert({
      creator_id: user.userId,
      amount,
      status: "requested",
      payout_method: profile.payout_method,
      payout_handle: profile.payout_handle,
      payout_address: profile.payout_address,
      payout_network: profile.payout_network,
      requested_at: new Date().toISOString(),
    }).select("id").single();
    if (reqErr) {
      console.error("[request-payout] insert:", reqErr.message);
      return json({ error: "Could not create payout request" }, 500);
    }

    // Reserve the funds by moving them from payout_balance to pending_payout
    await admin.from("profiles").update({
      payout_balance: Number(profile.payout_balance ?? 0) - amount,
      pending_payout: Number(profile.pending_payout ?? 0) + amount,
      updated_at: new Date().toISOString(),
    }).eq("id", user.userId);

    return json({
      request_id: reqRow.id,
      amount,
      status: "requested",
    });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: "Unauthorized" }, 401);
    console.error("[request-payout] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
