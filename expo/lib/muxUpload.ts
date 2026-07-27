/**
 * lib/muxUpload.ts
 * ----------------
 * Client for the real Mux direct-upload pipeline.
 *   - createUploadUrl()  → calls the `create-upload-url` edge fn to mint a
 *                          signed PUT URL + insert a placeholder episode row.
 *   - uploadFile()       → PUTs the file to Mux with real byte progress via
 *                          XMLHttpRequest.upload.onprogress.
 *   - awaitAssetReady()  → polls the `episodes` row until Mux finishes
 *                          transcoding (status flips off uploading/transcoding).
 *
 * No secrets in the app — the edge fn holds the Mux token. Errors are
 * normalized to friendly messages so the UI never shows "Failed to fetch".
 */

import { supabase } from "@/lib/supabase";
import { callEdge } from "@/lib/edge";

export interface UploadUrlResult {
  uploadUrl: string;
  uploadId: string;
  episodeId: string;
}

/** Episode row shape returned by supabase during the readiness poll. */
interface EpisodeRow {
  id: string;
  status: string;
  video_url: string | null;
  thumb_url: string | null;
}

/**
 * Ask the backend to create a Mux direct upload + placeholder episode row.
 * Returns the signed PUT URL the client should upload bytes to.
 */
export async function createUploadUrl(params: {
  title: string;
  category?: string;
  chapter?: string;
  thumbUrl?: string;
}): Promise<UploadUrlResult> {
  try {
    return await callEdge<UploadUrlResult>("create-upload-url", params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not start the upload.";
    throw new Error(friendlyMsg(msg));
  }
}

/**
 * Upload a file (by uri) to the Mux direct-upload URL. Reports real byte
 * progress via onProgress(0..1). Uses XMLHttpRequest so we get progress
 * events on both iOS and Android (fetch has no upload progress in RN).
 */
export function uploadFile(
  uri: string,
  uploadUrl: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    // Mux direct uploads accept the raw video bytes — no content-type needed,
    // and setting one can trigger CORS preflight issues.
    xhr.setRequestHeader("Content-Type", "video/mp4");

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event: ProgressEvent<EventTarget>): void => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(Math.min(0.99, event.loaded / event.total));
        }
      };
    }

    xhr.onload = (): void => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        reject(new Error("The upload was rejected by the video provider."));
      }
    };

    xhr.onerror = (): void => {
      reject(new Error("Network error during upload. Check your connection and try again."));
    };

    xhr.ontimeout = (): void => {
      reject(new Error("The upload timed out. Try a shorter clip or a stronger connection."));
    };

    // Fetch the file blob from the local uri and send it.
    fetch(uri)
      .then((res) => res.blob())
      .then((blob) => {
        xhr.send(blob);
      })
      .catch(() => {
        reject(new Error("Could not read the selected video file."));
      });
  });
}

/**
 * Poll the episodes row until Mux finishes transcoding — i.e. the status
 * flips off "uploading"/"transcoding" and video_url is set (the webhook
 * fires video.asset.ready). Resolves with the finalized episode.
 *
 * Times out after `timeoutMs` (default 3 min) — in that case the webhook
 * is still expected to finalize the row asynchronously, so we resolve with
 * the last-seen row rather than rejecting (the UI shows "still processing").
 */
export async function awaitAssetReady(
  episodeId: string,
  timeoutMs = 180_000,
  intervalMs = 3_000,
): Promise<EpisodeRow | null> {
  const deadline = Date.now() + timeoutMs;
  let lastRow: EpisodeRow | null = null;

  while (Date.now() < deadline) {
    try {
      const { data, error } = await supabase
        .from("episodes")
        .select("id, status, video_url, thumb_url")
        .eq("id", episodeId)
        .maybeSingle();
      if (!error && data) {
        lastRow = data as EpisodeRow;
        const isProcessing = data.status === "uploading" || data.status === "transcoding";
        if (!isProcessing || (data.video_url && data.status !== "uploading")) {
          return lastRow;
        }
      }
    } catch (err) {
      console.log("[povme] awaitAssetReady poll error", err);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return lastRow;
}

/** Update the episode's publish state (status / scheduled_at / access / ppv). */
export async function updateEpisodePublish(
  episodeId: string,
  patch: {
    status: "published" | "scheduled" | "draft";
    access?: string;
    ppvPrice?: number | null;
    category?: string;
    title?: string;
    thumbUrl?: string;
    scheduledAt?: string | null;
  },
): Promise<void> {
  const update: Record<string, unknown> = {
    status: patch.status,
    access: patch.access ?? "subscribers",
    ppv_price: patch.ppvPrice ?? null,
    category: patch.category ?? "founder",
  };
  if (patch.title) update.title = patch.title.trim().slice(0, 120);
  if (patch.thumbUrl) update.thumb_url = patch.thumbUrl;
  if (patch.status === "published") {
    update.posted_at = new Date().toISOString();
  }
  if (patch.status === "scheduled") {
    update.scheduled_at = patch.scheduledAt ?? null;
  }

  const { error } = await supabase.from("episodes").update(update).eq("id", episodeId);
  if (error) {
    throw new Error(friendlyMsg(error.message));
  }
}

function friendlyMsg(msg: string): string {
  if (msg.includes("Failed to fetch") || msg.includes("Network request failed")) {
    return "Network error. Check your connection and try again.";
  }
  if (msg.includes("exp") && msg.includes("claim")) {
    return "Your session expired. Please sign in again.";
  }
  return msg;
}
