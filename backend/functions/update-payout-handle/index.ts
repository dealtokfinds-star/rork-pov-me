import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";

/**
 * POST /update-payout-handle
 *
 * Saves the creator's payout destination. This replaces Stripe Connect, which
 * requires a separate Connect signup on the platform's Stripe account
 * (dashboard.stripe.com/connect) that is not enabled.
 *
 * Instead POVMe runs a platform-managed ledger: fan payments settle to the
 * platform Stripe account, the creator's 80% share accrues in
 * profiles.payout_balance, and withdrawals are sent to the destination saved
 * here by the payouts team.
 *
 * Body: { method: "paypal" | "cashapp" | "venmo" | "zelle" | "bank", handle: string, account_name?: string }
 * Returns: { ok: true, payout_method: string, payout_handle: string }
 */

const METHODS = ["paypal", "cashapp", "venmo", "zelle", "bank"] as const;
type Method = (typeof METHODS)[number];

const LABELS: Record<Method, string> = {
  paypal: "PayPal",
  cashapp: "Cash App",
  venmo: "Venmo",
  zelle: "Zelle",
  bank: "Bank transfer",
};

/** Validate the handle format for a given payout rail. */
function validateHandle(method: Method, raw: string): string | null {
  const handle = raw.trim();
  if (handle.length < 3) return null;

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handle);
  const isPhone = /^\+?[0-9][0-9\s\-().]{7,}$/.test(handle);

  switch (method) {
    case "paypal":
      return isEmail || isPhone ? handle : null;
    case "zelle":
      return isEmail || isPhone ? handle : null;
    case "cashapp": {
      const tag = handle.startsWith("$") ? handle : `$${handle}`;
      return /^\$[A-Za-z0-9_]{1,20}$/.test(tag) ? tag : null;
    }
    case "venmo": {
      const tag = handle.startsWith("@") ? handle : `@${handle}`;
      return /^@[A-Za-z0-9_\-]{2,30}$/.test(tag) ? tag : null;
    }
    case "bank": {
      // Routing/account digits, e.g. "021000021 / 000123456789"
      const digits = handle.replace(/\D/g, "");
      return digits.length >= 8 ? handle : null;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({})) as {
      method?: string;
      handle?: string;
      account_name?: string;
    };

    const method = (body.method ?? "").toLowerCase() as Method;
    if (!METHODS.includes(method)) {
      return json({ error: `Choose a payout method: ${METHODS.join(", ")}` }, 400);
    }

    const handle = validateHandle(method, body.handle ?? "");
    if (!handle) {
      return json({ error: `That doesn't look like a valid ${LABELS[method]} destination` }, 400);
    }

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles")
      .select("id, legal_name")
      .eq("id", user.userId)
      .maybeSingle();

    if (!profile) return json({ error: "Profile not found" }, 404);

    const accountName = (body.account_name ?? "").trim() || null;

    const { error } = await admin.from("profiles").update({
      payout_method: method,
      payout_handle: handle,
      payout_account_name: accountName ?? profile.legal_name ?? null,
      // Platform-managed payouts: enabled as soon as a destination is on file.
      stripe_payouts_enabled: true,
      stripe_account_status: "managed",
      updated_at: new Date().toISOString(),
    }).eq("id", user.userId);

    if (error) {
      // payout_account_name may not exist on older schemas — retry without it.
      const { error: retryError } = await admin.from("profiles").update({
        payout_method: method,
        payout_handle: handle,
        stripe_payouts_enabled: true,
        stripe_account_status: "managed",
        updated_at: new Date().toISOString(),
      }).eq("id", user.userId);
      if (retryError) {
        console.error("[update-payout-handle] update failed:", retryError.message);
        return json({ error: "Could not save payout destination" }, 500);
      }
    }

    return json({
      ok: true,
      payout_method: method,
      payout_label: LABELS[method],
      payout_handle: handle,
      payouts_enabled: true,
    });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: "Unauthorized" }, 401);
    console.error("[update-payout-handle] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
