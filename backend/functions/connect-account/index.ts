import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";
import {
  createConnectAccount,
  createAccountLink,
  retrieveAccount,
  StripeError,
  type Account,
} from "../_shared/stripe.ts";

/**
 * POST /connect-account
 * Creates (or reuses) a Stripe Express Connect account for the signed-in
 * creator and returns a hosted onboarding link.
 *
 * Body: { country?: string, refresh_url?: string, return_url?: string }
 * Returns: { url: string, account_id: string, payouts_enabled: boolean, details_submitted: boolean }
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
    const body = await req.json().catch(() => ({})) as {
      country?: string;
      refresh_url?: string;
      return_url?: string;
    };

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles")
      .select("id, email, stripe_account_id")
      .eq("id", user.userId)
      .maybeSingle();

    if (!profile) {
      return json({ error: "Profile not found" }, 404);
    }

    const country = body.country ?? "US";
    const baseUrl = Deno.env.get("SUPABASE_URL") ??
      "https://povme.supabase.co";
    const refreshUrl = body.refresh_url ?? `${baseUrl}/functions/v1/connect-account`;
    const returnUrl = body.return_url ?? `${baseUrl}/functions/v1/connect-account?done=1`;

    let accountId: string = profile.stripe_account_id as string;
    let account: Account | null = null;

    if (!accountId) {
      account = await createConnectAccount({
        email: profile.email ?? user.email ?? "",
        country,
        metadata_user_id: user.userId,
      });
      accountId = account.id;
    } else {
      account = await retrieveAccount(accountId);
    }

    const link = await createAccountLink({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
    });

    const payoutsEnabled = account.payouts_enabled ?? false;
    const detailsSubmitted = account.details_submitted ?? false;
    const accountStatus = payoutsEnabled ? "enabled" :
      detailsSubmitted ? "restricted" : "restricted";

    await admin.from("profiles").update({
      stripe_account_id: accountId,
      stripe_account_status: accountStatus,
      stripe_onboarding_url: link.url,
      stripe_payouts_enabled: payoutsEnabled,
      updated_at: new Date().toISOString(),
    }).eq("id", user.userId);

    return json({
      url: link.url,
      account_id: accountId,
      payouts_enabled: payoutsEnabled,
      details_submitted: detailsSubmitted,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (err instanceof StripeError) {
      console.error("[connect-account] Stripe error:", err.status, err.body);
      return json({ error: err.message }, err.status);
    }
    console.error("[connect-account] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
