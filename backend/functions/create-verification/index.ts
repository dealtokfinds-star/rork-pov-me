import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";
import { createVerificationSession, StripeError } from "../_shared/stripe.ts";

/**
 * POST /create-verification
 * Creates a Stripe Identity verification session for the signed-in user.
 * Stores the session id + hosted URL on the user's profile row.
 *
 * Body: { return_url?: string }
 * Returns: { url: string, session_id: string, status: string }
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
    const body = await req.json().catch(() => ({})) as { return_url?: string };
    const returnUrl = body.return_url ??
      `${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".functions.supabase.co")}/stripe-webhook`;

    const session = await createVerificationSession({
      metadata_user_id: user.userId,
      return_url: returnUrl,
    });

    const admin = createAdminClient();
    await admin.from("profiles").update({
      kyc_status: "pending",
      kyc_session_id: session.id,
      kyc_session_url: session.url,
      updated_at: new Date().toISOString(),
    }).eq("id", user.userId);

    return json({ url: session.url, session_id: session.id, status: session.status });
  } catch (err) {
    if (err instanceof AuthError) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (err instanceof StripeError) {
      console.error("[create-verification] Stripe error:", err.status, err.body);
      return json({ error: err.message }, err.status);
    }
    console.error("[create-verification] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
