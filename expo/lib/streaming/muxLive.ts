/**
 * lib/streaming/muxLive.ts
 * ------------------------
 * App-side client for the POVMe live streaming pipeline. Wraps the four
 * edge functions that drive Mux Live:
 *   - create-live-stream : host taps "Go live" → returns RTMP key + HLS url
 *   - stream-access      : viewer joins → server-side gate returns HLS url
 *   - stream-health      : host polls every 5s for real Mux metrics
 *   - end-live-stream    : host ends → Mux completes, replay VOD created
 *
 * All calls go through Supabase's `functions.invoke` so the Rork Auth JWT
 * is attached automatically from SecureStore. No secrets live in the app.
 */

import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StreamSource = "phone" | "chest" | "desktop";
export type LatencyMode = "low" | "reduced" | "standard";

/** Response from create-live-stream. RTMP key is host-only (RLS enforced). */
export interface CreatedLiveStream {
  streamId: string;
  /** Null when Mux provisioning was skipped (phone-source fallback). */
  muxLiveStreamId: string | null;
  rtmpIngestUrl: string | null;
  rtmpStreamKey: string | null;
  hlsPlaybackUrl: string | null;
  muxPlaybackId: string | null;
  creatorHandle: string | null;
  creatorName: string | null;
  isCoStream: boolean;
}

export interface CreateLiveStreamParams {
  title: string;
  category: string;
  access: "public" | "subscribers" | "ppv";
  ppvPrice?: number;
  streamSource?: StreamSource;
  replayEnabled?: boolean;
  slowMode?: boolean;
  subOnlyChat?: boolean;
  latencyMode?: LatencyMode;
  thumbUrl?: string;
  primaryStreamId?: string;
}

/** Response from stream-access. When allowed, includes the signed HLS url. */
export interface StreamAccessResult {
  allowed: boolean;
  reason?: "subscribe" | "ppv" | "unauthenticated" | "ended" | "not_found";
  hlsPlaybackUrl?: string | null;
  muxPlaybackId?: string | null;
  price?: number;
  creatorId?: string;
  isLive?: boolean;
}

/** Response from stream-health. Real Mux metrics for the host dashboard. */
export type StreamHealth = {
  status: "idle" | "connecting" | "live" | "reconnecting" | "ended" | "error";
  muxStatus?: string;
  concurrentViewers: number;
  maxViewers: number;
  elapsedSec: number;
  peakBitrateKbps: number;
  droppedFramesPct: number;
  latencyMode: LatencyMode;
  reconnectWindow: number;
  activeAssetId: string | null;
}

export interface EndLiveStreamResult {
  ok: boolean;
  replayEpisodeId: string | null;
  replayReady: boolean;
}

// ---------------------------------------------------------------------------
// API wrappers
// ---------------------------------------------------------------------------

/** Hard cap on edge function calls so the UI can never hang on a spinner. */
const INVOKE_TIMEOUT_MS = 25_000;

/**
 * Invoke an edge function with a timeout guard and real error extraction.
 * `supabase.functions.invoke` hides the server's error body behind a generic
 * "non-2xx status code" message — this unwraps `{ error }` from the response
 * so the UI can show what actually went wrong (e.g. "Only creators can go
 * live"). A 25s timeout turns a dead endpoint into a retryable error instead
 * of an infinite "Setting up your stream…" spinner.
 */
async function invokeFn<T>(name: string, body: unknown): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("The server took too long to respond. Please try again.")),
        INVOKE_TIMEOUT_MS,
      );
    });
    const { data, error } = await Promise.race([
      supabase.functions.invoke<T>(name, { body: body as Record<string, unknown> }),
      timeout,
    ]);
    if (error) {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const detail = (await ctx.json().catch(() => null)) as { error?: string } | null;
        if (detail?.error) throw new Error(detail.error);
        throw new Error(`Request failed (${ctx.status})`);
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
    if (!data) throw new Error(`${name} returned no data`);
    return data;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Create a Mux Live Stream + DB row. Host-only. Returns the RTMP ingest
 * URL + stream key the host should feed into OBS / their chest rig / the
 * desktop encoder. For phone source the key is still returned so a future
 * native RTMP module (HaishinKit) can use it; Expo Go records locally.
 */
export function createLiveStream(
  params: CreateLiveStreamParams,
): Promise<CreatedLiveStream> {
  return invokeFn<CreatedLiveStream>("create-live-stream", params);
}

/**
 * Server-side access gate. Call before playing the HLS feed. Returns the
 * signed HLS url when allowed, or a reason code the viewer UI can branch on
 * (subscribe / ppv / unauthenticated / ended / not_found).
 */
export function getStreamAccess(
  streamId: string,
): Promise<StreamAccessResult> {
  return invokeFn<StreamAccessResult>("stream-access", { streamId });
}

/**
 * Real-time health metrics for the host dashboard. Poll every 5-10s while
 * broadcasting. Only the stream owner may call this (RLS enforced).
 */
export function getStreamHealth(
  streamId: string,
): Promise<StreamHealth> {
  return invokeFn<StreamHealth>("stream-health", { streamId });
}

/**
 * End the stream. Triggers Mux `complete` + replay VOD creation (when
 * replayEnabled). Host-only. Safe to call multiple times — idempotent.
 */
export function endLiveStream(
  streamId: string,
  replayTitle?: string,
): Promise<EndLiveStreamResult> {
  return invokeFn<EndLiveStreamResult>("end-live-stream", { streamId, replayTitle });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The Mux webhook URL — register this in the Mux dashboard under
 * Settings → Webhooks so Mux pushes live/disconnected/asset.ready events
 * back to our edge function. The webhook verifies the Mux signature.
 */
export function muxWebhookUrl(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
  // Supabase edge function URL pattern.
  return `${url.replace(/\/$/, "")}/functions/v1/mux-webhook`;
}

/**
 * True when the current build can push a real RTMP stream from the phone.
 * Expo Go cannot — that needs a native module (HaishinKit.xcf in a custom
 * dev client). The Host UI surfaces this clearly so creators know to use
 * an external encoder (chest rig / OBS) or build a custom client.
 */
export function canPhonePushRtmp(): boolean {
  // expo-camera's recordAsync produces a local file, not an RTMP push.
  // A native RTMP module would set a global flag on startup; for now false.
  return false;
}
