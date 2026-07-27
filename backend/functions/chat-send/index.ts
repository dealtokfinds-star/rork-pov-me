import { createAdminClient, corsHeaders, json, requireAuth, AuthError } from "../_shared/auth.ts";

/**
 * POST /chat-send
 * Body: { stream_id: string, text: string, kind?: string, badge?: string, color?: string }
 *
 * Inserts a chat message into chat_messages. Slow-mode and sub-only-chat
 * enforcement happens server-side by reading live_streams settings.
 * Tip events are inserted by the stripe-webhook, not here.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { stream_id, text, kind, badge, color } = body as {
      stream_id?: string;
      text?: string;
      kind?: string;
      badge?: string;
      color?: string;
    };

    if (!stream_id || !text || typeof text !== "string") {
      return json({ error: "stream_id and text are required" }, 400);
    }
    if (text.length > 500) {
      return json({ error: "Message too long (max 500 chars)" }, 400);
    }

    const admin = createAdminClient();

    // Fetch the stream to enforce access rules
    const { data: stream } = await admin
      .from("live_streams")
      .select("is_live, slow_mode, sub_only_chat, creator_id, access")
      .eq("id", stream_id)
      .maybeSingle();

    if (!stream) return json({ error: "Stream not found" }, 404);
    if (stream.is_live === false) {
      return json({ error: "Stream is not live" }, 400);
    }

    // Sub-only chat: check subscription
    if (stream.sub_only_chat) {
      const isCreator = user.userId === stream.creator_id;
      const isAdmin = await checkIsAdmin(admin, user.userId);
      if (!isCreator && !isAdmin) {
        const { count } = await admin
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("creator_id", stream.creator_id)
          .eq("fan_id", user.userId)
          .eq("active", true);
        if (!count || count === 0) {
          return json({ error: "Subscribers only chat — subscribe to join" }, 403);
        }
      }
    }

    // Slow mode: 3s cooldown for non-creator/non-admin
    if (stream.slow_mode) {
      const isCreator = user.userId === stream.creator_id;
      const isAdmin = await checkIsAdmin(admin, user.userId);
      if (!isCreator && !isAdmin) {
        const { data: lastMsg } = await admin
          .from("chat_messages")
          .select("created_at")
          .eq("stream_id", stream_id)
          .eq("user_id", user.userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastMsg?.created_at) {
          const elapsed = Date.now() - new Date(lastMsg.created_at).getTime();
          if (elapsed < 3000) {
            return json({ error: "Slow mode: wait a moment before sending again" }, 429);
          }
        }
      }
    }

    // Fetch the user's name from profiles
    const { data: profile } = await admin
      .from("profiles")
      .select("name, handle")
      .eq("id", user.userId)
      .maybeSingle();
    const userName = profile?.name ?? profile?.handle ?? "viewer";

    const { data: inserted, error } = await admin
      .from("chat_messages")
      .insert({
        stream_id,
        user_id: user.userId,
        user_name: userName,
        text,
        kind: kind ?? "chat",
        badge: badge ?? null,
        color: color ?? null,
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("[chat-send] insert error", error);
      return json({ error: "Failed to send message" }, 500);
    }

    return json({ ok: true, id: inserted?.id, created_at: inserted?.created_at });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    console.error("[chat-send] error", err);
    return json({ error: "Internal error" }, 500);
  }
});

async function checkIsAdmin(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<boolean> {
  const { data } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  return Boolean(data?.is_admin);
}
