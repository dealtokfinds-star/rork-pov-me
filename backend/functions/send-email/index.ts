import { createAdminClient, corsHeaders, json, requireAuth, AuthError } from "../_shared/auth.ts";

/**
 * POST /send-email
 * Body:
 *   {
 *     to: string,
 *     subject: string,
 *     html?: string,
 *     text?: string,
 *     template?: string,       // e.g. "receipt", "payout", "onboarding", "dm_digest"
 *     user_id?: string         // optional, for logging
 *   }
 *
 * Sends transactional email via Resend. Gracefully skips (returns ok with
 * status="skipped") when RESEND_API_KEY is not configured, so callers can
 * always invoke it without gating.
 *
 * Can be called by:
 *   - stripe-webhook (receipts, payout confirmations) — uses internal admin key
 *   - Other edge functions (onboarding, digests) — passes user JWT
 *   - The toolkit/CLI — passes x-admin-key
 */
const RESEND_API = "https://api.resend.com/emails";
const FROM = "POVMe <notifications@povme.app>";

interface SendEmailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  user_id?: string;
}

/** Internal helper used by other edge functions — no auth check. */
export async function sendEmailInternal(input: SendEmailInput): Promise<{ ok: boolean; resend_id?: string; skipped?: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.log("[send-email] RESEND_API_KEY not set — skipping email to", input.to);
    return { ok: true, skipped: true };
  }

  try {
    const resp = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: input.to,
        subject: input.subject,
        html: input.html ?? input.text ?? "",
        text: input.text ?? undefined,
      }),
    });

    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("[send-email] Resend error", resp.status, result);
      // Log failure
      if (input.user_id) {
        const admin = createAdminClient();
        await admin.from("email_log").insert({
          user_id: input.user_id,
          to_email: input.to,
          subject: input.subject,
          template: input.template ?? null,
          status: "failed",
          error: JSON.stringify(result).slice(0, 500),
        });
      }
      return { ok: false, error: "Resend API error" };
    }

    const resendId = (result as { id?: string }).id;

    // Log success
    if (input.user_id) {
      const admin = createAdminClient();
      await admin.from("email_log").insert({
        user_id: input.user_id,
        to_email: input.to,
        subject: input.subject,
        template: input.template ?? null,
        status: "sent",
        resend_id: resendId ?? null,
      });
    }

    return { ok: true, resend_id: resendId };
  } catch (err) {
    console.error("[send-email] error", err);
    return { ok: false, error: "Internal error" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Allow either a user JWT or an admin key (for webhook callers)
    const adminKey = req.headers.get("x-admin-key");
    const toolkitKey = Deno.env.get("EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY") ?? Deno.env.get("RORK_TOOLKIT_SECRET_KEY");
    const isAdminCaller = adminKey && toolkitKey && adminKey === toolkitKey;

    let inputUserId: string | undefined;

    if (!isAdminCaller) {
      try {
        const user = await requireAuth(req);
        inputUserId = user.userId;
      } catch {
        return json({ error: "Authentication required" }, 401);
      }
    }

    const body = await req.json() as SendEmailInput & { user_id?: string };
    if (!body.to || !body.subject) {
      return json({ error: "to and subject are required" }, 400);
    }

    // For admin callers, allow overriding user_id
    const userId = body.user_id ?? inputUserId;

    const result = await sendEmailInternal({
      to: body.to,
      subject: body.subject,
      html: body.html,
      text: body.text,
      template: body.template,
      user_id: userId,
    });

    return json(result, result.ok ? 200 : 500);
  } catch (err) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    console.error("[send-email] handler error", err);
    return json({ error: "Internal error" }, 500);
  }
});
