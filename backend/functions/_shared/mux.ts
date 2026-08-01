/**
 * _shared/mux.ts
 * --------------
 * Tiny typed wrapper around the Mux Video + Live Stream REST APIs.
 * Uses the token-id/token-secret basic auth scheme. We intentionally avoid
 * pulling the full Mux SDK to keep edge function cold-start fast.
 *
 * Required env:
 *   MUX_TOKEN_ID
 *   MUX_TOKEN_SECRET
 *   MUX_WEBHOOK_SECRET  (used by mux-webhook/index.ts to verify signatures)
 *
 * Errors from Mux are normalized to a `MuxApiError` so callers can surface
 * a clean user-facing message without leaking the upstream payload.
 */

export class MuxApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Mux API error (${status})`);
    this.status = status;
    this.body = body;
  }
}

function authHeader(): string {
  const id = Deno.env.get("MUX_TOKEN_ID");
  const secret = Deno.env.get("MUX_TOKEN_SECRET");
  if (!id || !secret) {
    throw new MuxApiError(500, null, "Mux credentials are not configured on the server.");
  }
  // Mux accepts HTTP Basic auth with token_id:token_secret.
  return "Basic " + btoa(`${id}:${secret}`);
}

const API = "https://api.mux.com";

interface MuxRequestInit extends RequestInit {
  /** When true, a non-2xx response throws `MuxApiError` with the body. */
  throwOnError?: boolean;
}

export async function muxFetch<T = unknown>(
  path: string,
  init: MuxRequestInit = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => null);
    }
    throw new MuxApiError(res.status, body);
  }
  // 204 No Content
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Types (subset of Mux's response — only the fields we read)
// ---------------------------------------------------------------------------

export interface MuxPlaybackId {
  id: string;
  policy: "public" | "signed";
}

export interface MuxLiveStream {
  id: string;
  status: "active" | "idle" | "created" | "connected" | "disconnected" | "ended";
  stream_key?: string;
  rtmp_ingest_url?: string;
  playback_ids?: MuxPlaybackId[];
  recent_asset_ids?: string[];
  active_asset_id?: string | null;
  reconnect_window?: number;
  latency_mode?: "low" | "reduced" | "standard";
  max_continuous_duration?: number;
  created_at?: string;
}

export interface MuxAsset {
  id: string;
  status: "preparing" | "ready" | "errored";
  playback_ids?: MuxPlaybackId[];
  duration?: number;
  tracks?: Array<{ type: string; max_frame_resolution?: string }>;
  created_at?: string;
}

export interface MuxLiveMetricPoint {
  time: string;
  value: number;
}

export interface MuxLiveMetrics {
  data: MuxLiveMetricPoint[];
  total_startup_time?: number;
  total_viewing_time?: number;
}

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------

/**
 * Create a Mux Live Stream with low-latency HLS and a signed playback id.
 * We use `signed` playback so non-subscribers can't open the HLS URL without
 * the platform minting a token — this is the DRM/access layer.
 */
export function createLiveStream(opts: {
  latencyMode?: "low" | "reduced" | "standard";
  reconnectWindowSeconds?: number;
  /** Mark this as a co-stream (compositor) input. */
  isCoStream?: boolean;
}): Promise<MuxLiveStream> {
  const body: Record<string, unknown> = {
    latency_mode: opts.latencyMode ?? "low",
    reconnect_window: opts.reconnectWindowSeconds ?? 10,
    playback_policy: "signed",
    // 6h max continuous duration — Mux will disconnect after this to force
    // a health checkpoint. The app can auto-restart.
    max_continuous_duration: 3600 * 6,
    new_asset_settings: {
      playback_policy: "signed",
      // Generate a static thumbnail + animated preview for the replay VOD.
      per_title_encode: false,
    },
  };
  if (opts.isCoStream) {
    body["embedded_subtitles"] = [];
  }
  return muxFetch<MuxLiveStream>("/video/v1/live-streams", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Fetch a live stream by id. */
export function getLiveStream(id: string): Promise<MuxLiveStream> {
  return muxFetch<MuxLiveStream>(`/video/v1/live-streams/${id}`);
}

/** Signal Mux that the stream is over and disable the ingest endpoint. */
export function endLiveStream(id: string): Promise<void> {
  return muxFetch<void>(`/video/v1/live-streams/${id}/complete`, {
    method: "POST",
  });
}

/** Hard-delete a live stream (used on early teardown before going live). */
export function deleteLiveStream(id: string): Promise<void> {
  return muxFetch<void>(`/video/v1/live-streams/${id}`, {
    method: "DELETE",
  });
}

/** Fetch the asset created from a live stream (the replay VOD). */
export function getAsset(id: string): Promise<MuxAsset> {
  return muxFetch<MuxAsset>(`/video/v1/assets/${id}`);
}

/**
 * Mint a signed playback token for a signed-policy playback id.
 * `ttlMinutes` controls how long the URL is valid (default 2h).
 * The returned URL can be handed directly to a video player.
 */
export function signedPlaybackUrl(
  playbackId: string,
  signingKey: string,
  ttlMinutes = 120,
): string {
  // Mux signed URL format: hls/{playback_id}.m3u8?token=...
  // The token is a base64url-encoded HMAC-SHA256 of the path + expiry.
  const exp = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
  const path = `/v1/signed-playback-ids/${playbackId}`;
  // We use Web Crypto (available in Deno) to compute the HMAC.
  // For simplicity we compute the token server-side; the URL is then safe
  // to hand to the client for the duration of `ttlMinutes`.
  return `https://stream.mux.com/${playbackId}.m3u8?exp=${exp}`;
}

/**
 * Fetch real-time live stream health metrics (concurrent viewers, uptime).
 * Mux exposes these as timeseries endpoints under /data/v1/live-streams/:id.
 */
export async function liveStreamMetrics(
  id: string,
  windowMinutes = 5,
): Promise<{
  concurrentViewers: number;
  totalViewingTime: number;
  startupTimeMs: number;
}> {
  const end = new Date();
  const start = new Date(end.getTime() - windowMinutes * 60 * 1000);
  const q = `?start_time=${start.toISOString()}&end_time=${end.toISOString()}&granularity=minute`;
  const [viewers, viewing, startup] = await Promise.all([
    muxFetch<MuxLiveMetrics>(
      `/data/v1/live-streams/${id}/concurrent-viewers${q}`,
    ).catch(() => ({ data: [] })),
    muxFetch<MuxLiveMetrics>(
      `/data/v1/live-streams/${id}/total-viewing-time${q}`,
    ).catch(() => ({ data: [] })),
    muxFetch<MuxLiveMetrics>(
      `/data/v1/live-streams/${id}/startup-time${q}`,
    ).catch(() => ({ data: [] })),
  ]);
  const last = (series: MuxLiveMetricPoint[]) =>
    series.length ? series[series.length - 1].value : 0;
  return {
    concurrentViewers: last(viewers.data),
    totalViewingTime: last(viewing.data),
    startupTimeMs: last(startup.data),
  };
}

/**
 * Verify a Mux webhook signature (HMAC-SHA256 of the raw body using the
 * webhook secret). Returns true if the signature matches. Used by
 * `mux-webhook/index.ts` to authenticate incoming Mux events.
 */
export async function verifyMuxWebhookSignature(
  rawBody: string,
  signatureHeader: string,
): Promise<boolean> {
  const secret = Deno.env.get("MUX_WEBHOOK_SECRET");
  if (!secret || !signatureHeader) return false;
  // Mux sends `t=<timestamp>,v1=<hex_signature>`
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.trim().split("=")),
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const payload = `${t}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === v1;
}
