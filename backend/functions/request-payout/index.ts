import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";
import {
  retrieveBalance,
  createPayout,
  retrieveAccount,
  StripeError,
} from "../_shared/stripe.ts";

/**
 * POST /request-payout
 * Issues a real Stripe Payout on the creator's Connect Express account.
 *
 * Body: { amount?: number }  // dollars; if omitted, pays out full available balance
 * Returns: { payout_id: string, amount: number, status: string }
 *
 * Requirements:
 *   - Creator must have a Stripe Connect account (stripe_account_id)
 *   - Account must have payouts_enabled = true (onboarding complete, bank added)
 *   - Amount must be >= $1 and <= Stripe available balance
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({})) as { amount?: number };
    const admin = createAdminClient();

    const { data: profile } = await admin.from("profiles")
      .select(
        "id, stripe_account_id, stripe_payouts_enabled, stripe_account_status, payout_balance, pending_payout",
      )
      .eq("id", user.userId)
      .maybeSingle();

    if (!profile) return json({ error: "Profile not found" }, 404);

    const accountId = profile.stripe_account_id as string | null;
    if (!accountId) {
      return json({ error: "Connect a Stripe account first to receive payouts" }, 400);
    }
    if (!profile.stripe_payouts_enabled) {
      return json({ error: "Finish Stripe onboarding and add a bank account to withdraw" }, 400);
    }

    // Verify account status live (in case onboarding was completed recently)
    let account;
    try {
      account = await retrieveAccount(accountId);
    } catch (err) {
      if (err instanceof StripeError) {
        return json({ error: err.message }, err.status);
      }
      throw err;
    }
    if (!account.payouts_enabled) {
      // Sync status locally for next time
      await admin.from("profiles").update({
        stripe_payouts_enabled: false,
        stripe_account_status: account.details_submitted ? "restricted" : "restricted",
        updated_at: new Date().toISOString(),
      }).eq("id", user.userId);
      return json({ error: "Stripe onboarding incomplete — finish adding your bank details" }, 400);
    }

    // Pull the live available balance from Stripe (in cents)
    const bal = await retrieveBalance(accountId);
    const availableCents = bal.available?.[0]?.amount ?? 0;
    if (availableCents <= 0) {
      return json({
        error: `No available balance yet. Pending funds clear in 1–2 business days.`,
      }, 400);
    }

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

    // Issue the payout on the creator's Connect account
    const payout = await createPayout(
      {
        amount: amountCents,
        currency: "usd",
        method: "standard",
        metadata: { user_id: user.userId, requested_by: user.userId },
      },
      accountId,
    );

    // Record a local row so the webhook can reconcile status
    await admin.from("payouts").insert({
      creator_id: user.userId,
      amount: amountCents / 100,
      currency: "usd",
      method: "standard",
      status: payout.status,
      stripe_payout_id: payout.id,
      stripe_transfer_id: null,
      requested_at: new Date().toISOString(),
    });

    // Reserve the funds: move from payout_balance to pending_payout (local ledger mirror)
    await admin.from("profiles").update({
      payout_balance: Math.max(0, Number(profile.payout_balance ?? 0) - (amountCents / 100)),
      pending_payout: Number(profile.pending_payout ?? 0) + (amountCents / 100),
      updated_at: new Date().toISOString(),
    }).eq("id", user.userId);

    return json({
      payout_id: payout.id,
      amount: amountCents / 100,
      status: payout.status,
    });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: "Unauthorized" }, 401);
    if (err instanceof StripeError) {
      console.error("[request-payout] Stripe error:", err.status, err.body);
      return json({ error: err.message }, err.status);
    }
    console.error("[request-payout] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
