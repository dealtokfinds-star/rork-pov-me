import { createAdminClient, corsHeaders, json } from "../_shared/auth.ts";
import { verifyLsSignature, centsToDollars, type LSEvent } from "../_shared/lemonsqueezy.ts";
import { sendEmailInternal } from "../send-email/index.ts";

/**
 * POST /ls-webhook
 * Receives Lemon Squeezy webhook events for the Merchant of Record flow.
 * LS signs payloads with HMAC-SHA256 in the X-Signature header.
 *
 * Handled events (mapped to fan-payment actions):
 *   - order_created                    → one-time: PPV unlock, tip, wallet top-up
 *   - order_refunded                   → revoke access / reverse credit
 *   - subscription_created             → new subscriber activation
 *   - subscription_updated             → plan/price changes
 *   - subscription_cancelled           → end access at period end
 *   - subscription_expired             → subscription lapsed, revoke access
 *   - subscription_payment_success     → recurring renewal (keep access active)
 *   - subscription_payment_failed      → dunning, flag account
 *   - subscription_payment_refunded    → refund on a sub period
 *   - dispute_created / dispute_resolved → chargeback (admin alert)
 *
 * POVMe is the seller of record. Net proceeds land in the platform bank
 * account; the platform credits each creator's 80% share to the `payouts`
 * table (and to `payout_balance` on the profile) for weekly fulfillment.
 */

const PLATFORM_FEE_PERCENT = 20;

function feeAmount(gross: number): number {
  return Math.round(gross * PLATFORM_FEE_PERCENT) / 100;
}
function creatorShare(gross: number): number {
  return Math.round(gross * (100 - PLATFORM_FEE_PERCENT)) / 100;
}

/** Best-effort receipt email — never blocks the webhook. */
async function emailUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  subject: string,
  html: string,
): Promise<void> {
  try {
    const { data: profile } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle();
    const to = profile?.email;
    if (!to) return;
    await sendEmailInternal({ to, subject, html, template: "receipt", user_id: userId });
  } catch (err) {
    console.log("[ls-webhook] emailUser skipped", err);
  }
}

async function emailCreator(
  admin: ReturnType<typeof createAdminClient>,
  creatorId: string,
  subject: string,
  html: string,
): Promise<void> {
  try {
    const { data: profile } = await admin.from("profiles").select("email").eq("id", creatorId).maybeSingle();
    const to = profile?.email;
    if (!to) return;
    await sendEmailInternal({ to, subject, html, template: "creator_notice", user_id: creatorId });
  } catch (err) {
    console.log("[ls-webhook] emailCreator skipped", err);
  }
}

/** Increment creator earnings + payout balance on the profile row. */
async function creditCreator(
  admin: ReturnType<typeof createAdminClient>,
  creatorId: string,
  share: number,
  now: string,
): Promise<void> {
  const { data: creator } = await admin.from("profiles")
    .select("lifetime_earnings, payout_balance")
    .eq("id", creatorId)
    .maybeSingle();
  if (creator) {
    await admin.from("profiles").update({
      lifetime_earnings: Number(creator.lifetime_earnings ?? 0) + share,
      payout_balance: Number(creator.payout_balance ?? 0) + share,
      updated_at: now,
    }).eq("id", creatorId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();
  const signature = req.headers.get("X-Signature");
  const ok = await verifyLsSignature(rawBody, signature);
  if (!ok) {
    return json({ error: "Invalid signature" }, 400);
  }

  let event: LSEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const eventName = event.meta?.event_name ?? "";
  const custom = event.meta?.custom_data ?? {};
  const userId = custom.user_id ?? null;
  const creatorId = custom.creator_id ?? null;
  const paymentType = custom.payment_type ?? null;
  const attrs = event.data?.attributes ?? {};
  const orderId = event.data?.id ?? "";

  try {
    // ================================================================
    //  order_created — one-time purchases (tip, ppv, topup)
    // ================================================================
    if (eventName === "order_created") {
      if (!userId) return json({ received: true });
      const gross = centsToDollars(attrs.total ?? 0);

      if (paymentType === "topup") {
        const { data: profile } = await admin.from("profiles")
          .select("wallet_balance").eq("id", userId).maybeSingle();
        const newBalance = Number(profile?.wallet_balance ?? 0) + gross;
        await admin.from("profiles").update({
          wallet_balance: Math.round(newBalance * 100) / 100,
          updated_at: now,
        }).eq("id", userId);
        await emailUser(admin, userId, `Wallet topped up — $${gross.toFixed(2)}`,
          `<p>Your POVMe wallet was topped up with <strong>$${gross.toFixed(2)}</strong>. New balance: <strong>$${newBalance.toFixed(2)}</strong>.</p>`);
        await admin.from("transactions").update({ status: "completed", updated_at: now })
          .eq("stripe_checkout_session_id", orderId);
      }

      else if (paymentType === "tip" && creatorId) {
        const share = creatorShare(gross);
        await admin.from("tips").insert({
          fan_id: userId,
          creator_id: creatorId,
          amount: gross,
          message: custom.message ?? null,
          episode_id: custom.episode_id ?? null,
          stream_id: custom.stream_id ?? null,
          stripe_checkout_session_id: orderId,
          status: "completed",
          platform_fee: feeAmount(gross),
          creator_payout: share,
        });
        await admin.from("transactions").update({ status: "completed", updated_at: now })
          .eq("stripe_checkout_session_id", orderId);
        await creditCreator(admin, creatorId, share, now);
        await emailCreator(admin, creatorId, `You received a $${gross.toFixed(2)} tip`,
          `<p>A fan tipped you <strong>$${gross.toFixed(2)}</strong>. Your 80% share: <strong>$${share.toFixed(2)}</strong>.</p>`);
      }

      else if (paymentType === "ppv" && creatorId) {
        const share = creatorShare(gross);
        await admin.from("unlocks").insert({
          fan_id: userId,
          episode_id: custom.episode_id ?? null,
          stream_id: custom.stream_id ?? null,
          price: gross,
          stripe_checkout_session_id: orderId,
          status: "completed",
          platform_fee: feeAmount(gross),
          creator_payout: share,
        });
        await admin.from("transactions").update({ status: "completed", updated_at: now })
          .eq("stripe_checkout_session_id", orderId);
        await creditCreator(admin, creatorId, share, now);
        await emailCreator(admin, creatorId, `PPV unlocked — $${gross.toFixed(2)}`,
          `<p>A fan unlocked your premium content for <strong>$${gross.toFixed(2)}</strong>. Your 80% share: <strong>$${share.toFixed(2)}</strong>.</p>`);
      }
    }

    // ================================================================
    //  order_refunded — reverse access / credit
    // ================================================================
    else if (eventName === "order_refunded") {
      if (!userId) return json({ received: true });
      const gross = centsToDollars(attrs.total ?? attrs.refunded ? attrs.total : 0);
      // Mark transaction refunded
      await admin.from("transactions").update({ status: "refunded", updated_at: now })
        .eq("stripe_checkout_session_id", orderId);
      // Reverse creator credit if this was a tip/ppv
      if (creatorId && (paymentType === "tip" || paymentType === "ppv")) {
        const share = creatorShare(gross);
        const { data: creator } = await admin.from("profiles")
          .select("lifetime_earnings, payout_balance").eq("id", creatorId).maybeSingle();
        if (creator) {
          await admin.from("profiles").update({
            lifetime_earnings: Math.max(0, Number(creator.lifetime_earnings ?? 0) - share),
            payout_balance: Math.max(0, Number(creator.payout_balance ?? 0) - share),
            updated_at: now,
          }).eq("id", creatorId);
        }
      }
    }

    // ================================================================
    //  subscription_created / subscription_payment_success → activate sub
    // ================================================================
    else if (eventName === "subscription_created" || eventName === "subscription_payment_success") {
      if (!userId || !creatorId) return json({ received: true });
      const gross = centsToDollars(attrs.total ?? 0);
      const share = creatorShare(gross);
      const renewsAt = attrs.renews_at ?? null;

      // Upsert subscription row (use ls_subscription_id as the unique key)
      const { data: existing } = await admin.from("subscriptions")
        .select("id").eq("stripe_subscription_id", orderId).maybeSingle();

      if (existing) {
        await admin.from("subscriptions").update({
          active: true,
          status: "active",
          renews_at: renewsAt,
          price: gross,
          updated_at: now,
        }).eq("id", existing.id);
      } else {
        await admin.from("subscriptions").insert({
          fan_id: userId,
          creator_id: creatorId,
          active: true,
          status: "active",
          price: gross,
          stripe_subscription_id: orderId,
          stripe_customer_id: String(attrs.customer_id ?? ""),
          started_at: attrs.created_at ?? now,
          renews_at: renewsAt,
        });
      }

      // Credit creator (initial + renewal)
      await creditCreator(admin, creatorId, share, now);

      // Record transaction
      await admin.from("transactions").insert({
        user_id: userId,
        creator_id: creatorId,
        amount: gross,
        kind: "sub",
        label: eventName === "subscription_created" ? "Subscription (new)" : "Subscription renewal",
        status: "completed",
        stripe_checkout_session_id: orderId,
        currency: attrs.currency ?? "usd",
        platform_fee: feeAmount(gross),
        creator_payout: share,
      });

      if (eventName === "subscription_created") {
        await emailCreator(admin, creatorId, `New subscriber — $${gross.toFixed(2)}/mo`,
          `<p>You have a new subscriber paying <strong>$${gross.toFixed(2)}/mo</strong>. Your 80% share: <strong>$${share.toFixed(2)}/mo</strong>.</p>`);
      }
    }

    // ================================================================
    //  subscription_updated / subscription_plan_changed
    // ================================================================
    else if (eventName === "subscription_updated" || eventName === "subscription_plan_changed") {
      if (!userId || !creatorId) return json({ received: true });
      const gross = centsToDollars(attrs.total ?? 0);
      const isActive = attrs.status === "active" || attrs.status === "on_trial";
      await admin.from("subscriptions").update({
        active: isActive,
        status: attrs.status ?? "active",
        price: gross,
        renews_at: attrs.renews_at ?? null,
        updated_at: now,
      }).eq("stripe_subscription_id", orderId);
    }

    // ================================================================
    //  subscription_cancelled / subscription_expired → end access
    // ================================================================
    else if (eventName === "subscription_cancelled" || eventName === "subscription_expired") {
      await admin.from("subscriptions").update({
        active: false,
        status: eventName === "subscription_expired" ? "expired" : "canceled",
        canceled_at: now,
        renews_at: attrs.ends_at ?? null,
        updated_at: now,
      }).eq("stripe_subscription_id", orderId);
    }

    // ================================================================
    //  subscription_payment_failed → dunning
    // ================================================================
    else if (eventName === "subscription_payment_failed") {
      await admin.from("subscriptions").update({
        status: "past_due",
        updated_at: now,
      }).eq("stripe_subscription_id", orderId);
      if (userId) {
        await emailUser(admin, userId, "Subscription payment failed",
          `<p>Your POVMe subscription payment failed. Update your payment method to keep access.</p>`);
      }
    }

    // ================================================================
    //  subscription_payment_refunded → reverse credit
    // ================================================================
    else if (eventName === "subscription_payment_refunded") {
      if (creatorId) {
        const gross = centsToDollars(attrs.total ?? 0);
        const share = creatorShare(gross);
        const { data: creator } = await admin.from("profiles")
          .select("lifetime_earnings, payout_balance").eq("id", creatorId).maybeSingle();
        if (creator) {
          await admin.from("profiles").update({
            lifetime_earnings: Math.max(0, Number(creator.lifetime_earnings ?? 0) - share),
            payout_balance: Math.max(0, Number(creator.payout_balance ?? 0) - share),
            updated_at: now,
          }).eq("id", creatorId);
        }
      }
    }

    // ================================================================
    //  dispute_created / dispute_resolved → admin alert (best-effort)
    // ================================================================
    else if (eventName === "dispute_created" || eventName === "dispute_resolved") {
      try {
        const { data: admins } = await admin.from("profiles")
          .select("email").eq("is_admin", true).limit(5);
        const subject = eventName === "dispute_created" ? "Chargeback opened" : "Chargeback resolved";
        const html = `<p>A chargeback was ${eventName === "dispute_created" ? "opened" : "resolved"} for order ${orderId}.</p>`;
        for (const a of admins ?? []) {
          if (a.email) await sendEmailInternal({ to: a.email, subject, html, template: "admin_notice", user_id: userId ?? "" }).catch(() => {});
        }
      } catch { /* best-effort */ }
    }

    // Unhandled events (subscription_paused, subscription_resumed, etc.) — acknowledge.

    return json({ received: true, event: eventName });
  } catch (err) {
    console.error("[ls-webhook] processing error:", err);
    return json({ error: "Webhook processing failed" }, 500);
  }
});
