import { createAdminClient, corsHeaders, json, requireAuth, AuthError } from "../_shared/auth.ts";

/**
 * POST /notify-live
 * Body: { stream_id: string }
 *
 * Called by the creator client right after go-live. Fans out a push
 * notification to every follower with a registered device token via the
 * Expo Push API. Idempotent per stream — a `live_notify` event row is
 * recorded so retries never double-send.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const { stream_id } = (await req.json()) as { stream_id?: string };
    if (!stream_id) return json({ error: "stream_id is required" }, 400);

    const admin = createAdminClient();

    const { data: stream } = await admin
      .from("live_streams")
      .select("id, creator_id, title, is_live")
      .eq("id", stream_id)
      .maybeSingle();

    if (!stream || stream.creator_id !== user.userId) {
      return json({ error: "Stream not found" }, 404);
    }
    if (!stream.is_live) {
      return json({ ok: true, sent: 0, reason: "not_live" });
    }

    // Idempotency — one fan-out per stream.
    const { data: existing } = await admin
      .from("events")
      .select("id")
      .eq("stream_id", stream_id)
      .eq("kind", "live_notify")
      .maybeSingle();
    if (existing) {
      return json({ ok: true, sent: 0, reason: "already_notified" });
    }

    const { data: creator } = await admin
      .from("profiles")
      .select("name")
      .eq("id", stream.creator_id)
      .maybeSingle();
    const creatorName = creator?.name ?? "A creator you follow";

    // Followers = distinct users with a `follow` event for this creator.
    const { data: follows } = await admin
      .from("events")
      .select("user_id")
      .eq("creator_id", stream.creator_id)
      .eq("kind", "follow");

    const followerIds = [...new Set((follows ?? []).map((f) => f.user_id as string))].filter(
      (uid) => uid !== stream.creator_id,
    );

    const recordNotify = (sent: number) =>
      admin.from("events").insert({
        user_id: user.userId,
        creator_id: stream.creator_id,
        stream_id,
        kind: "live_notify",
        metadata: { sent },
      });

    if (followerIds.length === 0) {
      await recordNotify(0);
      return json({ ok: true, sent: 0, reason: "no_followers" });
    }

    const { data: tokens } = await admin
      .from("push_tokens")
      .select("token")
      .in("user_id", followerIds);

    if (!tokens || tokens.length === 0) {
      await recordNotify(0);
      return json({ ok: true, sent: 0, reason: "no_tokens" });
    }

    const messages = tokens.map((t: { token: string }) => ({
      to: t.token,
      title: "Live now",
      body: `${creatorName} just went live: "${stream.title ?? "POV stream"}"`,
      data: { stream_id, url: `/live/${stream_id}` },
      sound: "default",
    }));

    const resp = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    const expoResult = await resp.json().catch(() => ({}));

    await recordNotify(messages.length);
    return json({ ok: true, sent: messages.length, expo: expoResult });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    console.error("[notify-live] error", err);
    return json({ error: "Internal error" }, 500);
  }
});
