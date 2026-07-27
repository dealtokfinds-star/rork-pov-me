import { createAdminClient, corsHeaders, json } from "../_shared/auth.ts";

/**
 * POST /send-push
 * Body:
 *   { user_id: string, title: string, body: string, data?: object, x-admin-key?: string }
 *
 * Sends a push notification to all of a user's registered devices via the
 * Expo Push API. Intended to be called by other edge functions (webhooks) or
 * by the server. Requires the RORK_TOOLKIT_SECRET_KEY as x-admin-key header
 * to prevent clients from sending arbitrary pushes.
 */
const ADMIN_KEY = Deno.env.get("EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY") ?? Deno.env.get("RORK_TOOLKIT_SECRET_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const adminKey = req.headers.get("x-admin-key");
    if (!ADMIN_KEY || adminKey !== ADMIN_KEY) {
      return json({ error: "Forbidden: invalid admin key" }, 403);
    }

    const body = await req.json();
    const { user_id, title, body: messageBody, data } = body as {
      user_id?: string;
      title?: string;
      body?: string;
      data?: Record<string, unknown>;
    };

    if (!user_id || !title || !messageBody) {
      return json({ error: "user_id, title, and body are required" }, 400);
    }

    const admin = createAdminClient();
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", user_id);

    if (!tokens || tokens.length === 0) {
      return json({ ok: true, sent: 0, reason: "no_tokens" });
    }

    const messages = tokens.map((t: { token: string }) => ({
      to: t.token,
      title,
      body: messageBody,
      data: data ?? {},
      sound: "default",
    }));

    const resp = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(messages),
    });

    const result = await resp.json().catch(() => ({}));
    return json({ ok: true, sent: messages.length, expo: result });
  } catch (err) {
    console.error("[send-push] error", err);
    return json({ error: "Internal error" }, 500);
  }
});
