import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";
import { cancelSubscription, retrieveSubscription, StripeError } from "../_shared/stripe.ts";

/**
 * POST /cancel-subscription
 * Cancels a fan's subscription to a creator at the end of the current
 * billing period (Stripe's default cancel_at_period_end behavior).
 *
 * Body: { creator_id: string }
 * Returns: { active: boolean, canceled_at: string | null, renews_at: string | null }
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
    const body = await req.json().catch(() => ({})) as { creator_id?: string };

    if (!body.creator_id) {
      return json({ error: "creator_id is required" }, 400);
    }

    const admin = createAdminClient();

    // Find the active subscription row for this fan+creator
    const { data: sub, error: subErr } = await admin.from("subscriptions")
      .select("id, stripe_subscription_id, creator_id, fan_id, active, renews_at")
      .eq("fan_id", user.userId)
      .eq("creator_id", body.creator_id)
      .eq("active", true)
      .maybeSingle();

    if (subErr || !sub) {
      return json({ error: "No active subscription found" }, 404);
    }

    // If it's a Stripe subscription, cancel it there first
    let canceledAt: string | null = null;
    let renewsAt: string | null = null;

    if (sub.stripe_subscription_id) {
      const stripeSub = await cancelSubscription(sub.stripe_subscription_id);
      // Stripe cancel() sets cancel_at_period_end = true by default
      canceledAt = new Date().toISOString();
      renewsAt = stripeSub.current_period_end
        ? new Date(stripeSub.current_period_end * 1000).toISOString()
        : null;
    } else {
      // No Stripe sub (mock/local) — just mark inactive
      canceledAt = new Date().toISOString();
    }

    // Mark subscription inactive in DB
    await admin.from("subscriptions").update({
      active: false,
      status: "canceled",
      canceled_at: canceledAt,
      updated_at: new Date().toISOString(),
    }).eq("id", sub.id);

    // Record transaction
    await admin.from("transactions").insert({
      user_id: user.userId,
      creator_id: body.creator_id,
      amount: 0,
      kind: "sub",
      label: "Subscription canceled",
      status: "completed",
      currency: "usd",
    });

    return json({
      active: false,
      canceled_at: canceledAt,
      renews_at: renewsAt,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (err instanceof StripeError) {
      console.error("[cancel-subscription] Stripe error:", err.status, err.body);
      return json({ error: err.message }, err.status);
    }
    console.error("[cancel-subscription] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
