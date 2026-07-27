import { createAdminClient, corsHeaders, json } from "../_shared/auth.ts";
import {
  retrieveVerificationSession,
  retrieveAccount,
  retrieveCheckoutSession,
  retrievePaymentIntent,
  retrieveSubscription,
  retrieveInvoice,
  type VerificationSession,
  type Account,
  type CheckoutSession,
  type Subscription,
  type Invoice,
} from "../_shared/stripe.ts";
import { sendEmailInternal } from "../send-email/index.ts";

/** Best-effort receipt email — never blocks the webhook. */
async function emailReceipt(admin: ReturnType<typeof createAdminClient>, userId: string, subject: string, html: string): Promise<void> {
  try {
    const { data: profile } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle();
    const to = profile?.email;
    if (!to) return;
    await sendEmailInternal({ to, subject, html, template: "receipt", user_id: userId });
  } catch (err) {
    console.log("[stripe-webhook] emailReceipt skipped", err);
  }
}

/** Best-effort creator notification — never blocks the webhook. */
async function emailCreator(admin: ReturnType<typeof createAdminClient>, creatorId: string, subject: string, html: string): Promise<void> {
  try {
    const { data: profile } = await admin.from("profiles").select("email").eq("id", creatorId).maybeSingle();
    const to = profile?.email;
    if (!to) return;
    await sendEmailInternal({ to, subject, html, template: "creator_notice", user_id: creatorId });
  } catch (err) {
    console.log("[stripe-webhook] emailCreator skipped", err);
  }
}

/**
 * POST /stripe-webhook
 * Receives Stripe events for:
 *   - identity.verification_session.verified / requires_input (KYC)
 *   - account.updated (Connect onboarding)
 *   - checkout.session.completed (top-up / tip / PPV / subscription start)
 *   - payment_intent.succeeded (confirm PPV/tip transfers)
 *   - invoice.paid (recurring subscription renewal)
 *   - customer.subscription.deleted (subscription ended)
 *   - customer.subscription.updated (status changes)
 *   - payout.paid / payout.failed (creator withdrawals)
 *
 * Stripe signs webhook payloads with the webhook secret; we verify the
 * signature using the standard Stripe-Signature header.
 */

const TOLERANCE_SEC = 300;

async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  const parts = header.split(",");
  const tPart = parts.find((p) => p.startsWith("t="));
  if (!tPart) return false;
  const timestamp = Number(tPart.slice(2));
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SEC) {
    return false;
  }
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (signatures.length === 0) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = `${timestamp}.${payload}`;
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signed),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return signatures.includes(expected);
}

function reasonFromSession(session: VerificationSession): string | null {
  const err = session.last_verification_error;
  if (err && err.reason) return err.reason;
  return null;
}

function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set");
    return json({ error: "Webhook secret not configured" }, 500);
  }

  const payload = await req.text();
  const sigHeader = req.headers.get("Stripe-Signature");
  const ok = await verifyStripeSignature(payload, sigHeader, secret);
  if (!ok) {
    return json({ error: "Invalid signature" }, 400);
  }

  let event: { type: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const admin = createAdminClient();
  const obj = event.data?.object ?? {};
  const now = new Date().toISOString();

  try {
    // ================================================================
    //  KYC / Identity events
    // ================================================================
    if (event.type === "identity.verification_session.verified") {
      const session = await retrieveVerificationSession(obj.id as string);
      const userId = (session as unknown as { metadata?: { user_id?: string } }).metadata?.user_id;
      if (userId) {
        await admin.from("profiles").update({
          kyc_status: "verified",
          kyc_verified_at: now,
          kyc_last_reason: null,
          updated_at: now,
        }).eq("id", userId);
      }
    }

    else if (event.type === "identity.verification_session.requires_input") {
      const session = await retrieveVerificationSession(obj.id as string);
      const userId = (session as unknown as { metadata?: { user_id?: string } }).metadata?.user_id;
      if (userId) {
        const reason = reasonFromSession(session);
        await admin.from("profiles").update({
          kyc_status: "failed",
          kyc_last_reason: reason,
          updated_at: now,
        }).eq("id", userId);
        await emailReceipt(admin, userId, "Identity verification needs another look", `<p>Your identity verification couldn't be completed. Reason: ${reason ?? "unspecified"}. Please retry from your creator dashboard.</p>`);
      }
    }

    // ================================================================
    //  Connect account updated
    // ================================================================
    else if (event.type === "account.updated") {
      const account = await retrieveAccount(obj.id as string) as Account;
      const userId = (account as unknown as { metadata?: { user_id?: string } }).metadata?.user_id;
      const payoutsEnabled = account.payouts_enabled ?? false;
      const detailsSubmitted = account.details_submitted ?? false;
      const status = payoutsEnabled ? "enabled" : "restricted";
      if (userId) {
        await admin.from("profiles").update({
          stripe_account_id: account.id,
          stripe_account_status: status,
          stripe_payouts_enabled: payoutsEnabled,
          payout_connected: detailsSubmitted,
          updated_at: now,
        }).eq("id", userId);
      }
    }

    // ================================================================
    //  Checkout Session completed — top-up, tip, PPV, subscription start
    // ================================================================
    else if (event.type === "checkout.session.completed") {
      const session = await retrieveCheckoutSession(obj.id as string) as CheckoutSession;
      const meta = session.metadata ?? {};
      const userId = meta.user_id;
      const paymentType = meta.payment_type;
      if (!userId) return json({ received: true });

      const amountCents = session.amount_total ?? 0;
      const amountDollars = centsToDollars(amountCents);

      if (paymentType === "topup") {
        // Credit the fan's wallet balance
        const { data: profile } = await admin.from("profiles")
          .select("wallet_balance")
          .eq("id", userId)
          .maybeSingle();
        const newBalance = Number(profile?.wallet_balance ?? 0) + amountDollars;
        await admin.from("profiles").update({
          wallet_balance: Math.round(newBalance * 100) / 100,
          updated_at: now,
        }).eq("id", userId);
        await emailReceipt(admin, userId, `Wallet topped up — $${amountDollars.toFixed(2)}`, `<p>Your POVMe wallet was topped up with <strong>$${amountDollars.toFixed(2)}</strong>. New balance: <strong>$${newBalance.toFixed(2)}</strong>.</p>`);

        // Mark transaction completed
        await admin.from("transactions").update({
          status: "completed",
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent ?? null,
          updated_at: now,
        }).eq("stripe_checkout_session_id", session.id);
      }

      else if (paymentType === "tip" && meta.creator_id) {
        const creatorShare = amountDollars * 0.8;

        // Record the tip
        await admin.from("tips").insert({
          fan_id: userId,
          creator_id: meta.creator_id,
          amount: amountDollars,
          message: meta.message ?? null,
          episode_id: meta.episode_id ?? null,
          stream_id: meta.stream_id ?? null,
          stripe_payment_intent_id: session.payment_intent ?? null,
          stripe_checkout_session_id: session.id,
          status: "completed",
          platform_fee: amountDollars * 0.2,
          creator_payout: creatorShare,
        });

        // Mark transaction completed
        await admin.from("transactions").update({
          status: "completed",
          stripe_payment_intent_id: session.payment_intent ?? null,
          updated_at: now,
        }).eq("stripe_checkout_session_id", session.id);

        // When the creator hasn't connected Stripe Connect, the charge ran on
        // the platform account — credit their local payout_balance so they can
        // withdraw once onboarding is done. (When connected, Stripe handles the
        // transfer via transfer_data and we skip the local credit.)
        if (meta.platform_held === "true") {
          const { data: creator } = await admin.from("profiles")
            .select("lifetime_earnings, payout_balance")
            .eq("id", meta.creator_id)
            .maybeSingle();
          if (creator) {
            await admin.from("profiles").update({
              lifetime_earnings: Number(creator.lifetime_earnings ?? 0) + creatorShare,
              payout_balance: Number(creator.payout_balance ?? 0) + creatorShare,
              updated_at: now,
            }).eq("id", meta.creator_id);
          }
        }
        await emailCreator(admin, meta.creator_id, `You received a $${amountDollars.toFixed(2)} tip`, `<p>A fan tipped you <strong>$${amountDollars.toFixed(2)}</strong>. Your 80% share: <strong>$${creatorShare.toFixed(2)}</strong>.</p>`);
      }

      else if (paymentType === "ppv" && meta.creator_id) {
        const targetId = meta.episode_id ?? meta.stream_id;
        if (targetId) {
          const creatorShare = amountDollars * 0.8;

          // Record the unlock
          await admin.from("unlocks").insert({
            fan_id: userId,
            episode_id: meta.episode_id ?? null,
            stream_id: meta.stream_id ?? null,
            price: amountDollars,
            stripe_payment_intent_id: session.payment_intent ?? null,
            stripe_checkout_session_id: session.id,
            status: "completed",
            platform_fee: amountDollars * 0.2,
            creator_payout: creatorShare,
          });

          // Mark transaction completed
          await admin.from("transactions").update({
            status: "completed",
            stripe_payment_intent_id: session.payment_intent ?? null,
            updated_at: now,
          }).eq("stripe_checkout_session_id", session.id);

          // Credit creator earnings. When the creator has Stripe Connect, the
          // 80% share is transferred automatically via transfer_data and we
          // still keep a local mirror for the wallet UI. When platform_held,
          // this local credit is the source of truth until they connect.
          const { data: creator } = await admin.from("profiles")
            .select("lifetime_earnings, payout_balance, stripe_account_id")
            .eq("id", meta.creator_id)
            .maybeSingle();
          if (creator) {
            await admin.from("profiles").update({
              lifetime_earnings: Number(creator.lifetime_earnings ?? 0) + creatorShare,
              payout_balance: Number(creator.payout_balance ?? 0) + creatorShare,
              updated_at: now,
            }).eq("id", meta.creator_id);
            await emailCreator(admin, meta.creator_id, `PPV unlocked — $${amountDollars.toFixed(2)}`, `<p>A fan unlocked your premium content for <strong>$${amountDollars.toFixed(2)}</strong>. Your 80% share: <strong>$${creatorShare.toFixed(2)}</strong>.</p>`);
          }
        }
      }

      else if (paymentType === "sub" && meta.creator_id) {
        // Subscription row will be created/updated by customer.subscription.* events
        // Just mark the transaction completed
        await admin.from("transactions").update({
          status: "completed",
          stripe_payment_intent_id: session.payment_intent ?? null,
          updated_at: now,
        }).eq("stripe_checkout_session_id", session.id);
      }
    }

    // ================================================================
    //  Payment Intent succeeded — confirm transfers for tips/PPV
    // ================================================================
    else if (event.type === "payment_intent.succeeded") {
      const pi = await retrievePaymentIntent(obj.id as string);
      const meta = pi.metadata ?? {};
      // Transaction row is already updated in checkout.session.completed,
      // but if there's a pending one, mark it completed.
      await admin.from("transactions").update({
        status: "completed",
        stripe_payment_intent_id: pi.id,
        updated_at: now,
      }).eq("stripe_payment_intent_id", pi.id);
    }

    // ================================================================
    //  Invoice paid — recurring subscription renewal
    // ================================================================
    else if (event.type === "invoice.paid") {
      const invoice = await retrieveInvoice(obj.id as string) as Invoice;
      const meta = invoice.metadata ?? {};
      let userId = meta.user_id;
      let creatorId = meta.creator_id;
      let platformHeld = meta.platform_held === "true";

      // Fall back to the subscription's metadata if the invoice lacks it.
      if ((!userId || !creatorId) && invoice.subscription) {
        const sub = await retrieveSubscription(invoice.subscription) as Subscription;
        const subMeta = sub.metadata ?? {};
        userId = userId ?? subMeta.user_id;
        creatorId = creatorId ?? subMeta.creator_id;
        platformHeld = platformHeld || subMeta.platform_held === "true";
        if (subMeta.user_id && subMeta.creator_id) {
          // Update subscription renews_at
          await admin.from("subscriptions").update({
            active: true,
            status: "active",
            renews_at: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at: now,
          }).eq("stripe_subscription_id", sub.id);
        }
      }

      if (userId && creatorId) {
        const amountDollars = centsToDollars(invoice.amount_paid);
        const creatorShare = amountDollars * 0.8;

        // Record renewal transaction
        await admin.from("transactions").insert({
          user_id: userId,
          creator_id: creatorId,
          amount: amountDollars,
          kind: "sub",
          label: "Subscription renewal",
          status: "completed",
          stripe_payment_intent_id: invoice.payment_intent ?? null,
          currency: invoice.currency,
          platform_fee: amountDollars * 0.2,
          creator_payout: creatorShare,
        });

        // For platform-held subscriptions (creator not on Connect), credit the
        // creator's local payout_balance so they can withdraw once onboarded.
        if (platformHeld) {
          const { data: creator } = await admin.from("profiles")
            .select("lifetime_earnings, payout_balance")
            .eq("id", creatorId)
            .maybeSingle();
          if (creator) {
            await admin.from("profiles").update({
              lifetime_earnings: Number(creator.lifetime_earnings ?? 0) + creatorShare,
              payout_balance: Number(creator.payout_balance ?? 0) + creatorShare,
              updated_at: now,
            }).eq("id", creatorId);
          }
        }
      }
    }

    // ================================================================
    //  Subscription created/updated/deleted
    // ================================================================
    else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const sub = await retrieveSubscription(obj.id as string) as Subscription;
      const meta = sub.metadata ?? {};
      const userId = meta.user_id;
      const creatorId = meta.creator_id;
      if (!userId || !creatorId) return json({ received: true });

      const isActive = sub.status === "active" || sub.status === "trialing";
      const renewsAt = new Date(sub.current_period_end * 1000).toISOString();
      const priceAmount = sub.items.data[0]?.price?.unit_amount ?? 0;

      // Upsert subscription row
      const { data: existing } = await admin.from("subscriptions")
        .select("id")
        .eq("stripe_subscription_id", sub.id)
        .maybeSingle();

      if (existing) {
        await admin.from("subscriptions").update({
          active: isActive,
          status: sub.status,
          renews_at: renewsAt,
          price: centsToDollars(priceAmount),
          stripe_price_id: sub.items.data[0]?.price?.id ?? null,
          updated_at: now,
        }).eq("id", existing.id);
      } else {
        await admin.from("subscriptions").insert({
          fan_id: userId,
          creator_id: creatorId,
          active: isActive,
          status: sub.status,
          price: centsToDollars(priceAmount),
          stripe_subscription_id: sub.id,
          stripe_customer_id: sub.customer,
          stripe_price_id: sub.items.data[0]?.price?.id ?? null,
          started_at: new Date(sub.current_period_start * 1000).toISOString(),
          renews_at: renewsAt,
        });
      }
    }

    else if (event.type === "customer.subscription.deleted") {
      const sub = await retrieveSubscription(obj.id as string) as Subscription;
      await admin.from("subscriptions").update({
        active: false,
        status: "canceled",
        canceled_at: now,
        updated_at: now,
      }).eq("stripe_subscription_id", sub.id);
    }

    // ================================================================
    //  Payout events (creator withdrawals)
    // ================================================================
    else if (event.type === "payout.paid") {
      const payoutId = obj.id as string;
      await admin.from("payouts").update({
        status: "paid",
        processed_at: now,
      }).eq("stripe_payout_id", payoutId);

      // Reduce pending_payout on profile
      const { data: payout } = await admin.from("payouts")
        .select("creator_id, amount")
        .eq("stripe_payout_id", payoutId)
        .maybeSingle();
      if (payout) {
        const { data: profile } = await admin.from("profiles")
          .select("pending_payout, payout_balance")
          .eq("id", payout.creator_id)
          .maybeSingle();
        if (profile) {
          await admin.from("profiles").update({
            pending_payout: Math.max(0, Number(profile.pending_payout ?? 0) - Number(payout.amount)),
            payout_balance: Math.max(0, Number(profile.payout_balance ?? 0) - Number(payout.amount)),
            last_payout_at: now,
            updated_at: now,
          }).eq("id", payout.creator_id);
          await emailCreator(admin, payout.creator_id, `Payout sent — $${Number(payout.amount).toFixed(2)}`, `<p>Your payout of <strong>$${Number(payout.amount).toFixed(2)}</strong> has been sent to your bank account and should arrive within 1-2 business days.</p>`);
        }
      }
    }

    else if (event.type === "payout.failed") {
      const payoutId = obj.id as string;
      const failReason = (obj as { failure_reason?: string }).failure_reason ?? "Unknown error";
      await admin.from("payouts").update({
        status: "failed",
        failed_at: now,
        failure_reason: failReason,
      }).eq("stripe_payout_id", payoutId);
      const { data: payout } = await admin.from("payouts").select("creator_id, amount").eq("stripe_payout_id", payoutId).maybeSingle();
      if (payout) {
        await emailCreator(admin, payout.creator_id, `Payout failed — action needed`, `<p>Your payout of <strong>$${Number(payout.amount).toFixed(2)}</strong> failed. Reason: ${failReason}. Please update your bank details in your creator dashboard.</p>`);
      }
    }

    else {
      // Unhandled event type — acknowledge so Stripe doesn't retry.
    }

    return json({ received: true, type: event.type });
  } catch (err) {
    console.error("[stripe-webhook] processing error:", err);
    return json({ error: "Webhook processing failed" }, 500);
  }
});
