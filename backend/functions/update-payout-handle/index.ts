import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";

/**
 * POST /update-payout-handle
 * Saves the creator's manual payout handle (PayPal/Venmo/CashApp/Zelle).
 * Replaces Stripe Connect hosted onboarding.
 *
 * Body: { payout_method: string, payout_handle: string }
 * Returns: { ok: true }
 */
const ALLOWED_METHODS = ["paypal", "venmo", "cashapp", "zelle"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({})) as {
      payout_method?: string;
      payout_handle?: string;
    };

    const method = (body.payout_method ?? "").toLowerCase().trim();
    const handle = (body.payout_handle ?? "").trim();

    if (!ALLOWED_METHODS.includes(method)) {
      return json({ error: `Method must be one of: ${ALLOWED_METHODS.join(", ")}` }, 400);
    }
    if (handle.length < 3) {
      return json({ error: "Payout handle is too short" }, 400);
    }
    if (handle.length > 120) {
      return json({ error: "Payout handle is too long" }, 400);
    }

    const admin = createAdminClient();
    const { error } = await admin.from("profiles").update({
      payout_method: method,
      payout_handle: handle,
      stripe_payouts_enabled: true, // manual payouts are "enabled" once a handle is set
      stripe_account_status: "manual",
      updated_at: new Date().toISOString(),
    }).eq("id", user.userId);
    if (error) {
      console.error("[update-payout-handle] error:", error.message);
      return json({ error: "Could not save payout handle" }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: "Unauthorized" }, 401);
    console.error("[update-payout-handle] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
