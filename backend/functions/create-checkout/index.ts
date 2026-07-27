import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";
import {
  createCheckoutSession,
  createCustomer,
  listCustomersByEmail,
  createProduct,
  createPrice,
  listPricesForProduct,
  StripeError,
  type CheckoutSession,
} from "../_shared/stripe.ts";

/**
 * POST /create-checkout
 * Creates a Stripe Checkout Session for any payment type:
 *   - "topup":  Add funds to fan wallet (platform keeps 0%, fan pays)
 *   - "tip":    One-time tip to a creator (80/20 split via application_fee)
 *   - "ppv":    Unlock a PPV episode or live stream (80/20 split)
 *   - "sub":    Monthly subscription to a creator (80/20 split, recurring)
 *
 * Body:
 *   { type: "topup"|"tip"|"ppv"|"sub",
 *     amount?: number,          // required for topup/tip/ppv (in USD dollars)
 *     creator_id?: string,      // required for tip/ppv/sub
 *     episode_id?: string,      // for ppv episode unlocks
 *     stream_id?: string,       // for ppv stream unlocks
 *     message?: string,         // optional tip message
 *     return_url: string,       // deep link back to the app
 *     cancel_url: string }
 *
 * Returns: { url: string, session_id: string }
 *
 * The 20% platform fee is applied via Stripe's application_fee_amount
 * (one-time) or application_fee_percent (subscriptions), and the
 * remaining 80% is transferred to the creator's Connect account
 * via transfer_data.destination at charge time.
 */

const PLATFORM_FEE_PERCENT = 20; // 20% take rate
const CURRENCY = "usd";

function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

function feeCents(amountCents: number): number {
  return Math.round((amountCents * PLATFORM_FEE_PERCENT) / 100);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({})) as {
      type: "topup" | "tip" | "ppv" | "sub";
      amount?: number;
      creator_id?: string;
      episode_id?: string;
      stream_id?: string;
      message?: string;
      return_url: string;
      cancel_url: string;
    };

    if (!body.type || !body.return_url || !body.cancel_url) {
      return json({ error: "Missing required fields" }, 400);
    }

    const admin = createAdminClient();

    // ---- Resolve or create the Stripe Customer for this fan ----
    const { data: profile } = await admin.from("profiles")
      .select("id, email, stripe_customer_id")
      .eq("id", user.userId)
      .maybeSingle();

    if (!profile) {
      return json({ error: "Profile not found" }, 404);
    }

    let customerId: string | null = profile.stripe_customer_id as string | null;

    if (!customerId) {
      const email = profile.email ?? user.email ?? "";
      const existing = await listCustomersByEmail(email);
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const customer = await createCustomer({
          email,
          name: user.name ?? undefined,
          metadata_user_id: user.userId,
        });
        customerId = customer.id;
      }
      await admin.from("profiles").update({
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      }).eq("id", user.userId);
    }

    // ---- Build metadata to track the payment through webhooks ----
    const metadata: Record<string, string> = {
      user_id: user.userId,
      payment_type: body.type,
    };
    if (body.creator_id) metadata.creator_id = body.creator_id;
    if (body.episode_id) metadata.episode_id = body.episode_id;
    if (body.stream_id) metadata.stream_id = body.stream_id;
    if (body.message) metadata.message = body.message.slice(0, 500);

    let session: CheckoutSession;

    // ================================================================
    //  WALLET TOP-UP  (fan pays, full amount credited to wallet)
    // ================================================================
    if (body.type === "topup") {
      const amount = body.amount ?? 0;
      if (amount < 5) {
        return json({ error: "Minimum top-up is $5" }, 400);
      }
      const amountCents = dollarsToCents(amount);

      session = await createCheckoutSession({
        mode: "payment",
        customer: customerId!,
        customer_email: profile.email ?? user.email ?? undefined,
        line_items: [{
          price_data: {
            currency: CURRENCY,
            unit_amount: amountCents,
            product_data: {
              name: "POVMe Wallet Top-up",
              description: `Add ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)} to your POVMe wallet`,
            },
          },
          quantity: 1,
        }],
        metadata: { ...metadata, wallet_amount: String(amountCents) },
        success_url: body.return_url,
        cancel_url: body.cancel_url,
      });
    }

    // ================================================================
    //  TIP  (one-time, 80/20 split to creator Connect account)
    // ================================================================
    else if (body.type === "tip") {
      const amount = body.amount ?? 0;
      if (amount < 1) {
        return json({ error: "Minimum tip is $1" }, 400);
      }
      if (!body.creator_id) {
        return json({ error: "creator_id required for tips" }, 400);
      }

      // Look up creator's Stripe Connect account
      const { data: creator } = await admin.from("profiles")
        .select("stripe_account_id, name, handle")
        .eq("id", body.creator_id)
        .maybeSingle();

      if (!creator?.stripe_account_id) {
        return json({ error: "Creator has not set up payouts" }, 400);
      }

      const amountCents = dollarsToCents(amount);
      const fee = feeCents(amountCents);

      session = await createCheckoutSession({
        mode: "payment",
        customer: customerId!,
        line_items: [{
          price_data: {
            currency: CURRENCY,
            unit_amount: amountCents,
            product_data: {
              name: `Tip to @${creator.handle ?? "creator"}`,
              description: body.message ?? "Support this creator",
              metadata: { creator_id: body.creator_id },
            },
          },
          quantity: 1,
        }],
        metadata,
        payment_intent_data: {
          application_fee_amount: fee,
          transfer_data: { destination: creator.stripe_account_id },
          metadata,
        },
        success_url: body.return_url,
        cancel_url: body.cancel_url,
      });
    }

    // ================================================================
    //  PPV UNLOCK  (one-time, 80/20 split, marks episode/stream unlocked)
    // ================================================================
    else if (body.type === "ppv") {
      const amount = body.amount ?? 0;
      if (amount < 0.99) {
        return json({ error: "Minimum unlock price is $0.99" }, 400);
      }
      if (!body.creator_id || (!body.episode_id && !body.stream_id)) {
        return json({ error: "creator_id and episode_id or stream_id required" }, 400);
      }

      const { data: creator } = await admin.from("profiles")
        .select("stripe_account_id, name, handle")
        .eq("id", body.creator_id)
        .maybeSingle();

      if (!creator?.stripe_account_id) {
        return json({ error: "Creator has not set up payouts" }, 400);
      }

      const amountCents = dollarsToCents(amount);
      const fee = feeCents(amountCents);

      // Determine label
      let productName = "Premium POV unlock";
      if (body.episode_id) {
        const { data: ep } = await admin.from("episodes")
          .select("title").eq("id", body.episode_id).maybeSingle();
        if (ep?.title) productName = `Unlock: ${ep.title}`;
      } else if (body.stream_id) {
        const { data: stream } = await admin.from("live_streams")
          .select("title").eq("id", body.stream_id).maybeSingle();
        if (stream?.title) productName = `Live unlock: ${stream.title}`;
      }

      session = await createCheckoutSession({
        mode: "payment",
        customer: customerId!,
        line_items: [{
          price_data: {
            currency: CURRENCY,
            unit_amount: amountCents,
            product_data: {
              name: productName,
              metadata: { creator_id: body.creator_id },
            },
          },
          quantity: 1,
        }],
        metadata,
        payment_intent_data: {
          application_fee_amount: fee,
          transfer_data: { destination: creator.stripe_account_id },
          metadata,
        },
        success_url: body.return_url,
        cancel_url: body.cancel_url,
      });
    }

    // ================================================================
    //  SUBSCRIPTION  (monthly recurring, 80/20 split)
    // ================================================================
    else if (body.type === "sub") {
      if (!body.creator_id) {
        return json({ error: "creator_id required for subscriptions" }, 400);
      }

      const { data: creator } = await admin.from("profiles")
        .select("stripe_account_id, name, handle, sub_price")
        .eq("id", body.creator_id)
        .maybeSingle();

      if (!creator?.stripe_account_id) {
        return json({ error: "Creator has not set up payouts" }, 400);
      }

      const price = Number(creator.sub_price ?? 9.99);
      const amountCents = dollarsToCents(price);

      // Find or create a recurring Price for this creator
      // We cache the Stripe price_id on the profile to avoid duplicates.
      let priceId: string | null = null;

      // Check if we already cached a price for this creator
      const { data: existingSub } = await admin.from("subscriptions")
        .select("stripe_price_id")
        .eq("creator_id", body.creator_id)
        .not("stripe_price_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (existingSub?.stripe_price_id) {
        priceId = existingSub.stripe_price_id;
      }

      if (!priceId) {
        // Create a Product + Price for this creator
        const product = await createProduct({
          name: `Subscribe to @${creator.handle ?? "creator"}`,
          description: `Monthly POV subscription to ${creator.name ?? creator.handle}`,
          metadata_creator_id: body.creator_id,
        });

        const priceObj = await createPrice({
          product: product.id,
          unit_amount: amountCents,
          currency: CURRENCY,
          recurring_interval: "month",
          metadata_creator_id: body.creator_id,
        });
        priceId = priceObj.id;
      }

      session = await createCheckoutSession({
        mode: "subscription",
        customer: customerId!,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata,
        subscription_data: {
          application_fee_percent: PLATFORM_FEE_PERCENT,
          metadata,
        },
        success_url: body.return_url,
        cancel_url: body.cancel_url,
      });
    }

    else {
      return json({ error: `Unknown payment type: ${body.type}` }, 400);
    }

    // ---- Record a pending transaction row so we can reconcile on webhook ----
    await admin.from("transactions").insert({
      user_id: user.userId,
      creator_id: body.creator_id ?? null,
      amount: body.amount ?? 0,
      kind: body.type === "topup" ? "topup" : body.type === "tip" ? "tip" : body.type === "ppv" ? "ppv" : "sub",
      label: body.type === "topup"
        ? "Wallet top-up (pending)"
        : body.type === "sub"
        ? `Subscription (pending)`
        : body.type === "ppv"
        ? "PPV unlock (pending)"
        : "Tip (pending)",
      stripe_checkout_session_id: session.id,
      status: "pending",
      currency: CURRENCY,
      platform_fee: body.type !== "topup" && body.amount ? feeCents(dollarsToCents(body.amount)) / 100 : 0,
      creator_payout: body.type !== "topup" && body.amount ? (dollarsToCents(body.amount) - feeCents(dollarsToCents(body.amount))) / 100 : 0,
    });

    return json({ url: session.url, session_id: session.id });
  } catch (err) {
    if (err instanceof AuthError) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (err instanceof StripeError) {
      console.error("[create-checkout] Stripe error:", err.status, err.body);
      return json({ error: err.message }, err.status);
    }
    console.error("[create-checkout] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
