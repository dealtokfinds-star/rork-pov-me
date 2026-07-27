import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";
import { createPayout, retrieveBalance, StripeError } from "../_shared/stripe.ts";
import { useLemonSqueezy } from "../_shared/lemonsqueezy.ts";

/**
 * POST /request-payout
 * Requests a payout of the creator's available balance.
 *
 * For Lemon Squeezy (MoR) mode: creates a `payouts` row marked `requested`
 * for the admin to fulfill (weekly bank transfer / PayPal). No external API
 * call — the platform executes the transfer out-of-band and marks it paid
 * via the admin `fulfill_payout` action.
 *
 * For Stripe (legacy) mode: calls the Stripe Payouts API to send funds to
 * the creator's linked bank account.
 *
 * Body: { amount?: number }  // if omitted, pays out full available balance
 * Returns: { payout_id: string, amount: number, status: string, arrival_date: string | null }
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
    const useLS = useLemonSqueezy();
    const now = new Date().toISOString();

    const { data: profile } = await admin.from("profiles")
      .select("id, stripe_account_id, stripe_payouts_enabled, pending_payout, payout_balance, payout_method, payout_paypal_email, payout_bank_account_last4, payout_bank_account_holder, payout_bank_routing, payout_bank_country")
      .eq("id", user.userId)
      .maybeSingle();

    if (!profile) {
      return json({ error: "Profile not found" }, 404);
    }

    // ---- Lemon Squeezy path ----
    if (useLS || !profile.stripe_account_id) {
      if (!profile.payout_method) {
        return json({ error: "Add your payout details first (PayPal or bank)" }, 400);
      }

      const available = Number(profile.payout_balance ?? 0);
      let amount: number;
      if (body.amount && body.amount > 0) {
        amount = Math.round(body.amount * 100) / 100;
        if (amount > available) {
          return json({ error: `Insufficient balance. Available: $${available.toFixed(2)}` }, 400);
        }
      } else {
        amount = available;
      }

      if (amount < 1) {
        return json({ error: "Minimum payout is $1.00" }, 400);
      }

      // Insert a payout row marked 'requested' for admin fulfillment
      const { data: payoutRow, error } = await admin.from("payouts").insert({
        creator_id: user.userId,
        amount,
        status: "requested",
        method: profile.payout_method === "paypal" ? "paypal" : "bank_transfer",
        currency: "usd",
        requested_at: now,
      }).select("id").single();

      if (error || !payoutRow) {
        console.error("[request-payout] insert error:", error?.message);
        return json({ error: "Failed to create payout request" }, 500);
      }

      // Move the requested amount from payout_balance to pending_payout
      await admin.from("profiles").update({
        pending_payout: Number(profile.pending_payout ?? 0) + amount,
        payout_balance: Math.max(0, available - amount),
        updated_at: now,
      }).eq("id", user.userId);

      return json({
        payout_id: payoutRow.id,
        amount,
        status: "requested",
        arrival_date: null,
      });
    }

    // ---- Stripe path (legacy) ----
    if (!profile.stripe_payouts_enabled) {
      return json({ error: "Payouts not enabled — complete onboarding first" }, 400);
    }

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

    const payout = await createPayout({
      amount: amountCents,
      currency: "usd",
      method: "standard",
      metadata: { user_id: user.userId },
    }, profile.stripe_account_id);

    await admin.from("payouts").insert({
      creator_id: user.userId,
      amount: amountCents / 100,
      status: "pending",
      stripe_payout_id: payout.id,
      method: "stripe_connect",
      currency: "usd",
      requested_at: now,
    });

    await admin.from("profiles").update({
      pending_payout: Number(profile.pending_payout ?? 0) + (amountCents / 100),
      updated_at: now,
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
