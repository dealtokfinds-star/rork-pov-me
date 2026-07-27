import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";
import { createPayout, retrieveBalance, StripeError } from "../_shared/stripe.ts";

/**
 * POST /request-payout
 * Requests a payout from the creator's Stripe Connect balance to their
 * linked bank account. The payout amount is either specified or the full
 * available balance.
 *
 * Body: { amount?: number }  // if omitted, pays out full available balance
 * Returns: { payout_id: string, amount: number, status: string, arrival_date: string }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({})) as { amount?: number };
    const admin = createAdminClient();

    const { data: profile } = await admin.from("profiles")
      .select("id, stripe_account_id, stripe_payouts_enabled, pending_payout, payout_balance")
      .eq("id", user.userId)
      .maybeSingle();

    if (!profile) {
      return json({ error: "Profile not found" }, 404);
    }
    if (!profile.stripe_account_id) {
      return json({ error: "Connect account not set up" }, 400);
    }
    if (!profile.stripe_payouts_enabled) {
      return json({ error: "Payouts not enabled — complete onboarding first" }, 400);
    }

    // Get available balance from Stripe
    const balance = await retrieveBalance(profile.stripe_account_id);
    const availableCents = balance.available?.[0]?.amount ?? 0;

    let amountCents: number;
    if (body.amount && body.amount > 0) {
      amountCents = Math.round(body.amount * 100);
      if (amountCents > availableCents) {
        return json({
          error: `Insufficient balance. Available: $${(availableCents / 100).toFixed(2)}`,
        }, 400);
      }
    } else {
      amountCents = availableCents;
    }

    if (amountCents < 100) {
      return json({ error: "Minimum payout is $1.00" }, 400);
    }

    // Create the payout via Stripe
    const payout = await createPayout({
      amount: amountCents,
      currency: "usd",
      method: "standard",
      metadata: { user_id: user.userId },
    }, profile.stripe_account_id);

    // Record in payouts table
    await admin.from("payouts").insert({
      creator_id: user.userId,
      amount: amountCents / 100,
      status: "pending",
      stripe_payout_id: payout.id,
      method: "stripe_connect",
      currency: "usd",
      requested_at: new Date().toISOString(),
    });

    // Update profile pending payout
    await admin.from("profiles").update({
      pending_payout: Number(profile.pending_payout ?? 0) + (amountCents / 100),
      updated_at: new Date().toISOString(),
    }).eq("id", user.userId);

    return json({
      payout_id: payout.id,
      amount: amountCents / 100,
      status: payout.status,
      arrival_date: payout.arrival_date
        ? new Date(payout.arrival_date * 1000).toISOString()
        : null,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (err instanceof StripeError) {
      console.error("[request-payout] Stripe error:", err.status, err.body);
      return json({ error: err.message }, err.status);
    }
    console.error("[request-payout] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
