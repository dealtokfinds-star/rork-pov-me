import { createAdminClient, corsHeaders, json, requireAuth, AuthError } from "../_shared/auth.ts";

/**
 * POST /dm-send
 * Body:
 *   { recipient_id: string, text?: string, is_paid?: boolean, price?: number, attachment_url?: string }
 *
 * Creates or reuses a dm_thread between the sender and recipient, inserts a
 * dm_message, bumps unread counts via the bump_dm_thread RPC, and triggers a
 * push notification to the recipient.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const {
      recipient_id,
      text,
      is_paid = false,
      price = 0,
      attachment_url,
    } = body as {
      recipient_id?: string;
      text?: string;
      is_paid?: boolean;
      price?: number;
      attachment_url?: string;
    };

    if (!recipient_id) return json({ error: "recipient_id is required" }, 400);
    if (recipient_id === user.userId) return json({ error: "Cannot DM yourself" }, 400);
    if (!text && !attachment_url) return json({ error: "text or attachment_url required" }, 400);
    if (text && text.length > 2000) return json({ error: "Message too long (max 2000 chars)" }, 400);

    const admin = createAdminClient();

    // Determine creator vs fan ordering: the creator is the one with is_creator
    const { data: senderProfile } = await admin
      .from("profiles")
      .select("is_creator")
      .eq("id", user.userId)
      .maybeSingle();
    const { data: recipientProfile } = await admin
      .from("profiles")
      .select("is_creator")
      .eq("id", recipient_id)
      .maybeSingle();

    // Creator is the one with is_creator=true; if both or neither, sender is fan
    const senderIsCreator = Boolean(senderProfile?.is_creator);
    const recipientIsCreator = Boolean(recipientProfile?.is_creator);
    const creatorId = senderIsCreator && !recipientIsCreator
      ? user.userId
      : recipientIsCreator && !senderIsCreator
        ? recipient_id
        : recipient_id; // default: treat recipient as creator
    const fanId = creatorId === user.userId ? recipient_id : user.userId;

    // Upsert thread
    const { data: existingThread } = await admin
      .from("dm_threads")
      .select("id")
      .eq("creator_id", creatorId)
      .eq("fan_id", fanId)
      .maybeSingle();

    let threadId: string;
    if (existingThread) {
      threadId = existingThread.id;
    } else {
      const { data: newThread, error: threadErr } = await admin
        .from("dm_threads")
        .insert({ creator_id: creatorId, fan_id: fanId })
        .select("id")
        .single();
      if (threadErr || !newThread) {
        console.error("[dm-send] thread insert error", threadErr);
        return json({ error: "Failed to create thread" }, 500);
      }
      threadId = newThread.id;
    }

    // Insert message
    const { data: message, error: msgErr } = await admin
      .from("dm_messages")
      .insert({
        thread_id: threadId,
        sender_id: user.userId,
        text: text ?? null,
        is_paid,
        price,
        attachment_url: attachment_url ?? null,
      })
      .select("id, created_at")
      .single();

    if (msgErr) {
      console.error("[dm-send] message insert error", msgErr);
      return json({ error: "Failed to send message" }, 500);
    }

    // Bump unread counts + last_message_at
    await admin.rpc("bump_dm_thread", {
      p_thread_id: threadId,
      p_sender_id: user.userId,
    }).catch((err: unknown) => console.log("[dm-send] bump_dm_thread failed", err));

    // Send push notification to recipient (best-effort, non-blocking)
    try {
      const pushUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`;
      // We call send-push via internal fetch; use the service role to bypass auth
      // Actually simpler: directly fetch tokens and call Expo. But send-push
      // encapsulates that logic, so call it. We pass the user JWT since we're
      // already authenticated. However, the recipient is a different user —
      // send-push requires admin privileges to send to arbitrary users. We'll
      // make send-push accept an admin-key header. For now, do the push inline.
      await sendPushInline(admin, recipient_id, {
        title: `New message`,
        body: text ? (text.length > 60 ? text.slice(0, 60) + "…" : text) : "You have a new message",
        data: { type: "dm", thread_id: threadId, sender_id: user.userId },
      });
    } catch (err) {
      console.log("[dm-send] push failed", err);
    }

    return json({ ok: true, id: message?.id, thread_id: threadId, created_at: message?.created_at });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    console.error("[dm-send] error", err);
    return json({ error: "Internal error" }, 500);
  }
});

/** Best-effort inline push: fetch tokens and call Expo Push API. */
async function sendPushInline(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  const { data: tokens } = await admin
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId);
  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map((t: { token: string }) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: "default",
  }));

  const resp = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(messages),
  });
  if (!resp.ok) {
    console.log("[dm-send] expo push response", resp.status);
  }
}
