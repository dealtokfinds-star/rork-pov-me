import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";

/**
 * POST /creator-payout-details
 * Body: {
 *   method: "paypal" | "bank",
 *   paypal_email?: string,            // required if method === "paypal"
 *   bank_account_holder?: string,     // required if method === "bank"
 *   bank_account_number?: string,     // required if method === "bank" (last-4 stored only)
 *   bank_routing?: string,            // required if method === "bank"
 *   bank_country?: string,            // required if method === "bank" (ISO 2-letter)
 * }
 *
 * Saves the creator's payout details on their profile row. The platform uses
 * these to fulfill weekly payouts (bank transfer or PayPal) of the creator's
 * 80% share. Full bank account numbers are never stored — only the last 4
 * digits, which the client extracts before sending.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({})) as {
      method?: "paypal" | "bank";
      paypal_email?: string;
      bank_account_holder?: string;
      bank_account_number?: string;
      bank_routing?: string;
      bank_country?: string;
    };

    if (!body.method || (body.method !== "paypal" && body.method !== "bank")) {
      return json({ error: "method must be 'paypal' or 'bank'" }, 400);
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      payout_method: body.method,
      updated_at: now,
    };

    if (body.method === "paypal") {
      const email = body.paypal_email?.trim().toLowerCase();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return json({ error: "A valid PayPal email is required" }, 400);
      }
      update.payout_paypal_email = email;
      // Clear any bank fields
      update.payout_bank_account_holder = null;
      update.payout_bank_account_last4 = null;
      update.payout_bank_routing = null;
      update.payout_bank_country = null;
    } else {
      const holder = body.bank_account_holder?.trim();
      const number = body.bank_account_number?.replace(/\s/g, "");
      const routing = body.bank_routing?.replace(/\s/g, "");
      const country = body.bank_country?.trim().toUpperCase();

      if (!holder) return json({ error: "Account holder name is required" }, 400);
      if (!number || number.length < 4) return json({ error: "A valid account number is required" }, 400);
      if (!routing) return json({ error: "Routing number is required" }, 400);
      if (!country || country.length !== 2) return json({ error: "Country (2-letter ISO) is required" }, 400);

      // Store only last 4 digits of the account number
      update.payout_bank_account_holder = holder;
      update.payout_bank_account_last4 = number.slice(-4);
      update.payout_bank_routing = routing;
      update.payout_bank_country = country;
      // Clear PayPal field
      update.payout_paypal_email = null;
    }

    const { error } = await admin.from("profiles").update(update).eq("id", user.userId);
    if (error) {
      console.error("[creator-payout-details] update error:", error.message);
      return json({ error: "Failed to save payout details" }, 500);
    }

    return json({ ok: true, method: body.method });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    console.error("[creator-payout-details] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
