import { createAdminClient, corsHeaders, json, requireAuth, AuthError } from "../_shared/auth.ts";

/**
 * POST /track-event
 * Body:
 *   {
 *     kind: "view" | "like" | "unlock" | "tip" | "sub" | "watch_time" | "share",
 *     creator_id?: string,
 *     episode_id?: string,
 *     stream_id?: string,
 *     value?: number,
 *     metadata?: object
 *   }
 *
 * Inserts an analytics event row. Used by the client video player
 * (onPlaybackStatusUpdate) and by tap actions (like, share, unlock).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { kind, creator_id, episode_id, stream_id, value, metadata } = body as {
      kind?: string;
      creator_id?: string;
      episode_id?: string;
      stream_id?: string;
      value?: number;
      metadata?: Record<string, unknown>;
    };

    if (!kind || typeof kind !== "string") {
      return json({ error: "kind is required" }, 400);
    }

    const admin = createAdminClient();

    // If episode_id given, look up creator_id from the episode if not provided
    let resolvedCreatorId = creator_id ?? null;
    if (!resolvedCreatorId && episode_id) {
      const { data: ep } = await admin
        .from("episodes")
        .select("creator_id")
        .eq("id", episode_id)
        .maybeSingle();
      resolvedCreatorId = ep?.creator_id ?? null;
    }
    if (!resolvedCreatorId && stream_id) {
      const { data: stream } = await admin
        .from("live_streams")
        .select("creator_id")
        .eq("id", stream_id)
        .maybeSingle();
      resolvedCreatorId = stream?.creator_id ?? null;
    }

    const { error } = await admin.from("events").insert({
      user_id: user.userId,
      creator_id: resolvedCreatorId,
      episode_id: episode_id ?? null,
      stream_id: stream_id ?? null,
      kind,
      value: value ?? 0,
      metadata: metadata ?? {},
    });

    if (error) {
      console.error("[track-event] insert error", error);
      return json({ error: "Failed to track event" }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    console.error("[track-event] error", err);
    return json({ error: "Internal error" }, 500);
  }
});
