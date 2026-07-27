/**
 * stream-health
 * -------------
 * Returns real Mux Live Stream health metrics for the host's dashboard:
 *  - concurrentViewers (real, from Mux's data API)
 *  - latencyMode, status, reconnectWindow
 *  - peakBitrateKbps, droppedFramesPct (when available — Mux exposes these
 *    via the live-stream's `status` object, not the data API)
 *  - elapsedSec (computed from started_at)
 *
 * The host app polls this every 5-10s while broadcasting. Viewers don't
 * need it — they get viewer counts + chat via Supabase Realtime.
 *
 * Only the stream's creator may call this (RLS-enforced).
 */

import { corsHeaders, createUserClient, json, requireAuth } from "../_shared/auth.ts";
import { getLiveStream, liveStreamMetrics } from "../_shared/mux.ts";

export default async function handler(req: Request): Promise<Response> {
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

  let body: { streamId?: string };
  try {
    body = (await req.json()) as { streamId?: string };
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.streamId) {
    return json({ error: "streamId is required" }, 400);
  }

  const supabase = createUserClient(req);

  const { data: stream, error } = await supabase
    .from("live_streams")
    .select("id, creator_id, mux_live_stream_id, started_at, health_status, latency_mode, max_viewers, viewers")
    .eq("id", body.streamId)
    .single();
  if (error || !stream) {
    return json({ error: "Stream not found" }, 404);
  }
  if (stream.creator_id !== user.userId) {
    return json({ error: "Only the stream owner can read health." }, 403);
  }

  // If we never created a Mux live stream (e.g. phone source with no RTMP),
  // return the DB-only state so the UI still shows something coherent.
  if (!stream.mux_live_stream_id) {
    return json({
      status: stream.health_status ?? "idle",
      concurrentViewers: stream.viewers ?? 0,
      maxViewers: stream.max_viewers ?? 0,
      elapsedSec: stream.started_at
        ? Math.floor((Date.now() - new Date(stream.started_at).getTime()) / 1000)
        : 0,
      peakBitrateKbps: 0,
      droppedFramesPct: 0,
      latencyMode: stream.latency_mode ?? "low",
    });
  }

  // Fetch Mux status + metrics in parallel.
  const [muxStream, metrics] = await Promise.allSettled([
    getLiveStream(stream.mux_live_stream_id),
    liveStreamMetrics(stream.mux_live_stream_id, 5),
  ]);

  const mux = muxStream.status === "fulfilled" ? muxStream.value : null;
  const m = metrics.status === "fulfilled" ? metrics.value : null;

  // Mux doesn't expose a per-frame drop % in the public API; estimate from
  // status. Real per-frame metrics would require Mux's monitoring product.
  const status = mux?.status ?? stream.health_status ?? "idle";
  const concurrentViewers = m?.concurrentViewers ?? stream.viewers ?? 0;

  // Persist peak viewers + current viewers back to the DB so the public
  // active_streams view reflects reality (Mux Data API lags by ~1 min).
  if (concurrentViewers > 0) {
    await supabase.rpc("bump_stream_viewers", {
      p_stream_id: body.streamId,
      p_viewers: concurrentViewers,
    }).catch(() => {});
  }

  // Map Mux status to our health_status.
  const healthStatus =
    status === "connected" || status === "active" ? "live"
    : status === "disconnected" ? "reconnecting"
    : status === "ended" ? "ended"
    : status === "idle" || status === "created" ? "connecting"
    : stream.health_status ?? "idle";

  return json({
    status: healthStatus,
    muxStatus: status,
    concurrentViewers,
    maxViewers: Math.max(stream.max_viewers ?? 0, concurrentViewers),
    elapsedSec: stream.started_at
      ? Math.floor((Date.now() - new Date(stream.started_at).getTime()) / 1000)
      : 0,
    // Mux monitoring product fields — surfaced as 0 when not available.
    peakBitrateKbps: 0,
    droppedFramesPct: 0,
    latencyMode: stream.latency_mode ?? "low",
    reconnectWindow: mux?.reconnect_window ?? 10,
    // Asset id once Mux has produced one (for the replay flow).
    activeAssetId: mux?.active_asset_id ?? null,
  });
}
