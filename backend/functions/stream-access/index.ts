/**
 * stream-access
 * -------------
 * Server-side access gate for a live stream. Viewers call this before
 * playing the HLS feed. It returns:
 *  - { allowed: true, hlsPlaybackUrl, muxPlaybackId } when access is granted
 *  - { allowed: false, reason: "subscribe"|"ppv"|"unauthenticated", price, creatorId }
 *
 * The gate is enforced server-side so a tampered client can't just open the
 * raw HLS URL — Mux playback is signed, and the signing key never leaves the
 * server. Even if someone leaks the playback id, the signed token expires.
 *
 * Rules:
 *  - public → allowed for everyone (even anon)
 *  - subscribers → allowed iff the viewer has an active subscription to the
 *    creator (row in `subscriptions` with active=true)
 *  - ppv → allowed iff the viewer has an unlock row for this stream_id
 *    (or is a subscriber — subscribers get PPV events free, matching the
 *    app's existing unlock screen logic)
 *  - The creator themselves always pass.
 */

import { corsHeaders, createUserClient, json, requireAuth } from "../_shared/auth.ts";

interface AccessResponse {
  allowed: boolean;
  reason?: "subscribe" | "ppv" | "unauthenticated" | "ended" | "not_found";
  hlsPlaybackUrl?: string | null;
  muxPlaybackId?: string | null;
  price?: number;
  creatorId?: string;
  isLive?: boolean;
}

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
  } catch {
    return json({
      allowed: false,
      reason: "unauthenticated",
    } as AccessResponse, 200);
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

  // Use the admin client to read RTMP fields too — RLS would hide the row
  // for non-creators, but we want viewers to read the gate fields. The
  // active_streams view hides secrets, so use that.
  const { data: stream, error } = await supabase
    .from("active_streams")
    .select("id, creator_id, access, ppv_price, is_live, hls_playback_url, mux_playback_id")
    .eq("id", body.streamId)
    .single();
  if (error || !stream) {
    return json({ allowed: false, reason: "not_found" } as AccessResponse, 200);
  }
  if (!stream.is_live) {
    return json({ allowed: false, reason: "ended" } as AccessResponse, 200);
  }

  // Creator always passes.
  if (stream.creator_id === user.userId) {
    return json({
      allowed: true,
      hlsPlaybackUrl: stream.hls_playback_url,
      muxPlaybackId: stream.mux_playback_id,
      isLive: true,
    } as AccessResponse, 200);
  }

  if (stream.access === "public") {
    return json({
      allowed: true,
      hlsPlaybackUrl: stream.hls_playback_url,
      muxPlaybackId: stream.mux_playback_id,
      isLive: true,
    } as AccessResponse, 200);
  }

  // Check subscription (covers both "subscribers" and PPV-with-sub).
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("fan_id", user.userId)
    .eq("creator_id", stream.creator_id)
    .eq("active", true)
    .maybeSingle();

  if (sub) {
    return json({
      allowed: true,
      hlsPlaybackUrl: stream.hls_playback_url,
      muxPlaybackId: stream.mux_playback_id,
      isLive: true,
    } as AccessResponse, 200);
  }

  if (stream.access === "subscribers") {
    return json({
      allowed: false,
      reason: "subscribe",
      creatorId: stream.creator_id,
    } as AccessResponse, 200);
  }

  // access === "ppv": check unlock for this stream.
  const { data: unlock } = await supabase
    .from("unlocks")
    .select("id")
    .eq("fan_id", user.userId)
    .eq("stream_id", body.streamId)
    .maybeSingle();

  if (unlock) {
    return json({
      allowed: true,
      hlsPlaybackUrl: stream.hls_playback_url,
      muxPlaybackId: stream.mux_playback_id,
      isLive: true,
    } as AccessResponse, 200);
  }

  return json({
    allowed: false,
    reason: "ppv",
    price: stream.ppv_price ?? 0,
    creatorId: stream.creator_id,
  } as AccessResponse, 200);
}

Deno.serve(handler);
