/**
 * end-live-stream
 * ---------------
 * Called by the host when they tap "End stream". Does three things:
 *  1. Tells Mux to complete the live stream (disable ingest, finalize asset).
 *  2. If `replayEnabled`, polls for the produced asset and inserts an
 *     `episodes` row pointing at the asset's playback id — this is the
 *     "stream replay → VOD" conversion. The episode inherits the stream's
 *     access level so PPV tickets stay valid for the replay.
 *  3. Updates `live_streams.is_live = false` and links the replay episode.
 *
 * Mux typically takes 30-90s to finalize an asset after `complete` is called,
 * so we kick off the asset creation but don't block on it past a short poll.
 * If the asset isn't ready by then, the mux-webhook `video.asset.ready`
 * event will finish the episode insert.
 */

import { corsHeaders, createUserClient, json, requireAuth } from "../_shared/auth.ts";
import { endLiveStream, getLiveStream, getAsset, type MuxAsset } from "../_shared/mux.ts";

interface EndBody {
  streamId: string;
  /** Override the title for the replay VOD. */
  replayTitle?: string;
}

const ASSET_POLL_MS = 2000;
const ASSET_POLL_MAX_ATTEMPTS = 10; // 20s of synchronous polling

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let user;
  try {
    user = await requireAuth(req);
  } catch (err) {
    return json({ error: (err as Error).message }, 401);
  }

  let body: EndBody;
  try {
    body = (await req.json()) as EndBody;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.streamId) {
    return json({ error: "streamId is required" }, 400);
  }

  const supabase = createUserClient(req);

  const { data: stream, error } = await supabase
    .from("live_streams")
    .select("id, creator_id, mux_live_stream_id, access, ppv_price, category, title, replay_enabled, thumb_url")
    .eq("id", body.streamId)
    .single();
  if (error || !stream) {
    return json({ error: "Stream not found" }, 404);
  }
  if (stream.creator_id !== user.userId) {
    return json({ error: "Only the stream owner can end it." }, 403);
  }

  // 1. Complete the Mux live stream.
  if (stream.mux_live_stream_id) {
    try {
      await endLiveStream(stream.mux_live_stream_id);
    } catch (err) {
      console.error("[end-live-stream] mux complete failed", err);
      // Continue — we still want to mark the DB row ended even if Mux errors.
    }
  }

  // 2. If replay is enabled, try to produce a VOD episode. Poll briefly for
  //    the asset to become ready; if it doesn't, the mux-webhook will finish.
  let replayEpisodeId: string | null = null;
  if (stream.replay_enabled && stream.mux_live_stream_id) {
    try {
      const live = await getLiveStream(stream.mux_live_stream_id);
      const assetId = live.active_asset_id ?? live.recent_asset_ids?.[0] ?? null;
      if (assetId) {
        let asset: MuxAsset | null = null;
        for (let i = 0; i < ASSET_POLL_MAX_ATTEMPTS; i++) {
          try {
            asset = await getAsset(assetId);
            if (asset && (asset.status === "ready" || asset.status === "errored")) {
              break;
            }
          } catch {
            // Asset may not exist yet right after complete — keep polling.
          }
          await new Promise((r) => setTimeout(r, ASSET_POLL_MS));
        }
        if (asset && asset.status === "ready" && asset.playback_ids?.[0]) {
          const { data: ep } = await supabase
            .from("episodes")
            .insert({
              creator_id: stream.creator_id,
              title: (body.replayTitle ?? `Replay: ${stream.title}`).slice(0, 120),
              description: "Live stream replay.",
              video_url: `https://stream.mux.com/${asset.playback_ids[0].id}.m3u8`,
              thumb_url: stream.thumb_url,
              duration_sec: Math.round(asset.duration ?? 0),
              access: stream.access,
              ppv_price: stream.ppv_price,
              category: stream.category,
              // Mark as a replay so the feed can badge it.
              chapter: "replay",
            })
            .select("id")
            .single();
          if (ep) replayEpisodeId = ep.id;
        }
      }
    } catch (err) {
      console.error("[end-live-stream] replay asset setup failed", err);
      // Non-fatal — stream is still marked ended.
    }
  }

  // 3. Mark the stream ended and link the replay.
  await supabase.rpc("end_stream", {
    p_stream_id: body.streamId,
    p_replay_episode_id: replayEpisodeId,
  });

  return json({
    ok: true,
    replayEpisodeId,
    replayReady: replayEpisodeId !== null,
  });
}

Deno.serve(handler);
