import { createAdminClient, corsHeaders, json, requireAuth, AuthError } from "../_shared/auth.ts";

/**
 * POST /register-push
 * Body: { token: string, platform?: string, app_version?: string }
 *
 * Upserts a device push token for the authenticated user.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { token, platform, app_version } = body as {
      token?: string;
      platform?: string;
      app_version?: string;
    };

    if (!token || typeof token !== "string") {
      return json({ error: "token is required" }, 400);
    }

    const admin = createAdminClient();

    // Upsert: if the (user_id, token) pair exists, update last_seen_at; else insert
    const { data: existing } = await admin
      .from("push_tokens")
      .select("id")
      .eq("user_id", user.userId)
      .eq("token", token)
      .maybeSingle();

    if (existing) {
      await admin
        .from("push_tokens")
        .update({
          last_seen_at: new Date().toISOString(),
          platform: platform ?? null,
          app_version: app_version ?? null,
        })
        .eq("id", existing.id);
    } else {
      await admin
        .from("push_tokens")
        .insert({
          user_id: user.userId,
          token,
          platform: platform ?? null,
          app_version: app_version ?? null,
        });
    }

    return json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    console.error("[register-push] error", err);
    return json({ error: "Internal error" }, 500);
  }
});
