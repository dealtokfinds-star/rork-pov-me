/**
 * mux-webhook
 * -----------
 * Receives Mux event webhooks and keeps the `live_streams` row in sync:
 *  - video.live_stream.connected  → is_live = true, health_status = 'live'
 *  - video.live_stream.disconnected → health_status = 'reconnecting'
 *                                   (Mux auto-reconnects for `reconnect_window`)
 *  - video.live_stream.active     → is_live = true (second-stage health)
 *  - video.asset.ready            → if this asset came from a live stream,
 *                                   finalize the replay episode row.
 *  - video.live_stream.deleted     → mark stream ended (clean teardown)
 *
 * Security: every request must carry a valid Mux webhook signature header
 * (`Mux-Signature`) computed with MUX_WEBHOOK_SECRET. We verify before
 * doing anything. This endpoint does NOT require a Rork Auth JWT — Mux
 * can't carry our session token. Use the service-role admin client.
 *
 * Register this URL in the Mux dashboard under Webhooks. The edge function
 * URL pattern is:
 *   https://<project>.functions.supabase.co/mux-webhook
 */

import {
  corsHeaders,
  createAdminClient,
  json,
} from "../_shared/auth.ts";
import { verifyMuxWebhookSignature, getAsset } from "../_shared/mux.ts";

interface MuxEvent {
  type: string;
  data: {
    id: string; // live stream id OR asset id, depending on event
    status?: string;
    playback_ids?: Array<{ id: string; policy: string }>;
    duration?: number;
    // For asset events tied to a live stream:
    live_stream_id?: string;
    // For live stream events, `recent_asset_ids` may be present.
    recent_asset_ids?: string[];
    active_asset_id?: string | null;
  };
  /** Mux includes the id of the live stream this asset came from. */
  request_id?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const signature = req.headers.get("Mux-Signature") ?? "";
  const rawBody = await req.text();

  // Verify the Mux signature. If MUX_WEBHOOK_SECRET isn't set yet, we
  // reject — never process unsigned webhooks.
  let verified = false;
  try {
    verified = await verifyMuxWebhookSignature(rawBody, signature);
  } catch (err) {
    console.error("[mux-webhook] verify threw", err);
  }
  if (!verified) {
    return json({ error: "Invalid signature" }, 401);
  }

  let event: MuxEvent;
  try {
    event = JSON.parse(rawBody) as MuxEvent;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "video.live_stream.connected": {
      // Find the stream by mux_live_stream_id and flip it live.
      const { data: stream } = await supabase
        .from("live_streams")
        .select("id, creator_id, title")
        .eq("mux_live_stream_id", event.data.id)
        .maybeSingle();
      if (stream) {
        await supabase
          .from("live_streams")
          .update({
            is_live: true,
            health_status: "live",
            started_at: new Date().toISOString(),
          })
          .eq("id", stream.id);

        // Notify all active subscribers that this creator went live
        try {
          const { data: subs } = await supabase
            .from("subscriptions")
            .select("fan_id")
            .eq("creator_id", stream.creator_id)
            .eq("active", true);
          if (subs && subs.length > 0) {
            const { data: creatorProfile } = await supabase
              .from("profiles")
              .select("name, handle")
              .eq("id", stream.creator_id)
              .maybeSingle();
            const creatorName = creatorProfile?.name ?? creatorProfile?.handle ?? "A creator";
            const { data: tokens } = await supabase
              .from("push_tokens")
              .select("token")
              .in("user_id", subs.map((s: { fan_id: string }) => s.fan_id));
            if (tokens && tokens.length > 0) {
              const messages = tokens.map((t: { token: string }) => ({
                to: t.token,
                title: `${creatorName} is live`,
                body: stream.title ?? "Come join the live POV",
                data: { type: "live", stream_id: stream.id, creator_id: stream.creator_id },
                sound: "default",
              }));
              await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(messages),
              });
            }
          }
        } catch (pushErr) {
          console.log("[mux-webhook] live push failed", pushErr);
        }
      }
      break;
    }

    case "video.live_stream.disconnected": {
      // Mux will try to reconnect for `reconnect_window` seconds. Show the
      // reconnecting state in the UI until then.
      const { data: stream } = await supabase
        .from("live_streams")
        .select("id")
        .eq("mux_live_stream_id", event.data.id)
        .maybeSingle();
      if (stream) {
        await supabase
          .from("live_streams")
          .update({ health_status: "reconnecting" })
          .eq("id", stream.id);
      }
      break;
    }

    case "video.live_stream.active": {
      // The stream is fully healthy. (Mux sends this after `connected` once
      // the encoder handshake is complete.)
      const { data: stream } = await supabase
        .from("live_streams")
        .select("id")
        .eq("mux_live_stream_id", event.data.id)
        .maybeSingle();
      if (stream) {
        await supabase
          .from("live_streams")
          .update({ is_live: true, health_status: "live" })
          .eq("id", stream.id);
      }
      break;
    }

    case "video.live_stream.deleted": {
      // Stream was deleted (either by us or Mux's retention policy).
      const { data: stream } = await supabase
        .from("live_streams")
        .select("id")
        .eq("mux_live_stream_id", event.data.id)
        .maybeSingle();
      if (stream) {
        await supabase.rpc("end_stream", { p_stream_id: stream.id });
      }
      break;
    }

    case "video.asset.ready": {
      // An asset finished preparing. If it came from a live stream and
      // we haven't yet created the replay episode, do it now (covers the
      // case where end-live-stream's poll timed out).
      const liveStreamId = event.data.live_stream_id;
      if (!liveStreamId) break;
      const { data: stream } = await supabase
        .from("live_streams")
        .select("id, creator_id, title, access, ppv_price, category, replay_enabled, replay_episode_id, thumb_url")
        .eq("mux_live_stream_id", liveStreamId)
        .maybeSingle();
      if (!stream || !stream.replay_enabled || stream.replay_episode_id) {
        break; // already handled or replay disabled
      }
      const playback = event.data.playback_ids?.[0];
      if (!playback) break;
      const { data: ep } = await supabase
        .from("episodes")
        .insert({
          creator_id: stream.creator_id,
          title: `Replay: ${stream.title}`.slice(0, 120),
          description: "Live stream replay.",
          video_url: `https://stream.mux.com/${playback.id}.m3u8`,
          thumb_url: stream.thumb_url,
          duration_sec: Math.round(event.data.duration ?? 0),
          access: stream.access,
          ppv_price: stream.ppv_price,
          category: stream.category,
          chapter: "replay",
        })
        .select("id")
        .single();
      if (ep) {
        await supabase
          .from("live_streams")
          .update({ replay_episode_id: ep.id })
          .eq("id", stream.id);
      }
      break;
    }

    default:
      // Ignore metrics/other events — we don't need them.
      break;
  }

  return json({ ok: true });
}
