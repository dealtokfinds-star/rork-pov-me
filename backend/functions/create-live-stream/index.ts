/**
 * create-live-stream
 * ------------------
 * Called by a creator when they tap "Go live". Creates a Mux Live Stream,
 * inserts a row in `live_streams` with the RTMP ingest URL + stream key +
 * signed HLS playback id, and returns everything the host app needs:
 *  - streamId (our DB id)
 *  - rtmpIngestUrl + rtmpStreamKey (for OBS / chest rig / desktop encoder)
 *  - hlsPlaybackUrl (for the creator's own monitor if desired)
 *  - muxLiveStreamId (for health polling)
 *
 * The RTMP key is NEVER returned to viewers — RLS hides it from anon/other
 * users. Only the `active_streams` view (which excludes the key) is public.
 *
 * For phone source: we still create a Mux Live Stream so the viewer HLS path
 * is identical, but the phone cannot push RTMP from Expo Go. The host app
 * records locally and uploads as a VOD after the session (handled in
 * upload.tsx + lib/streaming). The host UI explains this clearly.
 */

import { corsHeaders, createUserClient, json, requireAuth } from "../_shared/auth.ts";
import { createLiveStream, type MuxLiveStream } from "../_shared/mux.ts";

interface CreateBody {
  title: string;
  category: string;
  access: "public" | "subscribers" | "ppv";
  ppvPrice?: number;
  streamSource?: "phone" | "chest" | "desktop";
  replayEnabled?: boolean;
  slowMode?: boolean;
  subOnlyChat?: boolean;
  latencyMode?: "low" | "reduced" | "standard";
  thumbUrl?: string;
  /** Co-stream: id of the primary stream to join as a co-host. */
  primaryStreamId?: string;
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
  } catch (err) {
    return json({ error: (err as Error).message }, 401);
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.title || body.title.trim().length === 0) {
    return json({ error: "title is required" }, 400);
  }
  if (!body.access) {
    return json({ error: "access is required" }, 400);
  }

  const supabase = createUserClient(req);

  // Confirm creator status — only creators can go live.
  // KYC is no longer a gate: creators go live immediately after becoming a
  // creator. ID upload is optional and only affects the verified badge +
  // payout review priority (see submit-kyc auto-approval).
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, is_creator, handle, name")
    .eq("id", user.userId)
    .single();
  if (profileErr || !profile) {
    return json({ error: "Profile not found" }, 404);
  }
  if (!profile.is_creator) {
    return json({ error: "Only creators can go live. Become a creator first." }, 403);
  }

  // Co-stream join: verify the primary stream exists and we're invited.
  let primaryStreamId: string | null = null;
  let isCoStream = false;
  if (body.primaryStreamId) {
    const { data: primary, error: pErr } = await supabase
      .from("live_streams")
      .select("id, is_live, co_host_ids, access")
      .eq("id", body.primaryStreamId)
      .single();
    if (pErr || !primary) {
      return json({ error: "Primary stream not found" }, 404);
    }
    const invited = (primary.co_host_ids ?? []).some(
      (id: unknown) => String(id) === user.userId,
    );
    if (!invited) {
      return json({ error: "You're not invited to co-stream on this broadcast." }, 403);
    }
    primaryStreamId = primary.id;
    isCoStream = true;
  }

  // Create the Mux Live Stream. For phone-source streams the broadcast is
  // driven by the app itself (presence + is_live flip), so a Mux outage or
  // missing credentials must NOT block going live — degrade to a DB-only
  // stream row. Encoder sources (chest/desktop) genuinely need the RTMP
  // endpoint, so those still hard-fail.
  let mux: MuxLiveStream | null = null;
  try {
    mux = await createLiveStream({
      latencyMode: body.latencyMode ?? "low",
      reconnectWindowSeconds: 10,
      isCoStream,
    });
  } catch (err) {
    console.error("[create-live-stream] mux create failed", err);
    if ((body.streamSource ?? "phone") !== "phone") {
      return json(
        { error: "Could not start the live stream provider. Try again." },
        502,
      );
    }
    mux = null;
  }

  const playback = mux?.playback_ids?.[0];
  const hlsUrl = playback
    ? `https://stream.mux.com/${playback.id}.m3u8`
    : null;

  // Insert the DB row. RLS allows this because creator_id = user_id().
  const insert: Record<string, unknown> = {
    creator_id: user.userId,
    title: body.title.trim().slice(0, 120),
    category: body.category,
    access: body.access,
    ppv_price: body.access === "ppv" ? body.ppvPrice ?? 0 : null,
    stream_source: body.streamSource ?? "phone",
    replay_enabled: body.replayEnabled ?? true,
    slow_mode: body.slowMode ?? true,
    sub_only_chat: body.subOnlyChat ?? false,
    is_live: false, // goes true when Mux sends `video.live_stream.connected`
    started_at: new Date().toISOString(),
    health_status: "created",
    mux_live_stream_id: mux?.id ?? null,
    rtmp_ingest_url: mux
      ? mux.rtmp_ingest_url ?? "rtmp://global-live.mux.com:5222/app"
      : null,
    rtmp_stream_key: mux?.stream_key ?? null,
    mux_playback_id: playback?.id ?? null,
    hls_playback_url: hlsUrl,
    latency_mode: body.latencyMode ?? "low",
    is_co_stream: isCoStream,
    primary_stream_id: primaryStreamId,
    thumb_url: body.thumbUrl ?? null,
  };

  const { data: row, error: insertErr } = await supabase
    .from("live_streams")
    .insert(insert)
    .select("id")
    .single();
  if (insertErr || !row) {
    // Best-effort cleanup: delete the Mux live stream we just created so we
    // don't leak orphan ingest endpoints.
    console.error("[create-live-stream] insert failed", insertErr);
    if (mux) {
      try {
        await import("../_shared/mux.ts").then((m) => m.deleteLiveStream(mux!.id));
      } catch {
        // ignore
      }
    }
    return json({ error: "Could not create the stream record." }, 500);
  }

  return json({
    streamId: row.id,
    muxLiveStreamId: mux?.id ?? null,
    rtmpIngestUrl: mux
      ? mux.rtmp_ingest_url ?? "rtmp://global-live.mux.com:5222/app"
      : null,
    rtmpStreamKey: mux?.stream_key ?? null,
    hlsPlaybackUrl: hlsUrl,
    muxPlaybackId: playback?.id ?? null,
    // Observed/streamed-only fields the host UI needs:
    creatorHandle: profile.handle,
    creatorName: profile.name,
    isCoStream,
  });
}

Deno.serve(handler);
