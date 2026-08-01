/**
 * lib/storageUpload.ts
 * --------------------
 * Direct-to-Supabase-Storage image uploads with real byte progress.
 *
 * Used for profile avatars (bucket: "avatars") and profile banners
 * (bucket: "covers"). Both buckets are public-read; INSERT requires an
 * authenticated JWT (RLS: auth.role() = 'authenticated').
 *
 * Uses XMLHttpRequest instead of supabase-js `storage.upload()` because
 * supabase-js exposes no upload progress events — XHR gives us
 * `upload.onprogress` on iOS, Android, and web. Every upload writes a
 * unique object key (userId/timestamp) so we never hit the UPDATE policy.
 */

import { getValidAccessToken } from "@/lib/token";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export type ImageBucket = "avatars" | "covers";

export interface UploadImageResult {
  /** Public CDN URL — store this on the profile row. */
  publicUrl: string;
  /** Object path inside the bucket. */
  path: string;
}

function extensionFor(uri: string, mimeType?: string): { ext: string; contentType: string } {
  const lowered = uri.toLowerCase();
  if (mimeType?.includes("png") || lowered.endsWith(".png")) {
    return { ext: "png", contentType: "image/png" };
  }
  if (mimeType?.includes("webp") || lowered.endsWith(".webp")) {
    return { ext: "webp", contentType: "image/webp" };
  }
  if (mimeType?.includes("gif") || lowered.endsWith(".gif")) {
    return { ext: "gif", contentType: "image/gif" };
  }
  return { ext: "jpg", contentType: "image/jpeg" };
}

/**
 * Upload a local image (picker uri) to a public Storage bucket with
 * real progress. Resolves with the public URL to persist on the profile.
 *
 * @param onProgress receives 0..1 as bytes are pushed
 */
export async function uploadProfileImage(params: {
  uri: string;
  bucket: ImageBucket;
  userId: string;
  mimeType?: string;
  onProgress?: (fraction: number) => void;
}): Promise<UploadImageResult> {
  const { uri, bucket, userId, mimeType, onProgress } = params;

  const token = await getValidAccessToken();
  if (!token) throw new Error("You need to be signed in to upload images.");

  const { ext, contentType } = extensionFor(uri, mimeType);
  // Unique key per upload — avoids UPDATE-policy paths and stale CDN caches.
  const path = `${userId}/${Date.now()}.${ext}`;
  const endpoint = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

  const blob = await fetch(uri)
    .then((res) => res.blob())
    .catch(() => {
      throw new Error("Could not read the selected image.");
    });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("cache-control", "max-age=3600");

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
        let message = "The image upload was rejected.";
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
          message = body.message ?? body.error ?? message;
        } catch {
          // keep default
        }
        reject(new Error(message));
      }
    };
    xhr.onerror = (): void => {
      reject(new Error("Network error during the image upload. Check your connection."));
    };
    xhr.ontimeout = (): void => {
      reject(new Error("The image upload timed out. Try again."));
    };

    xhr.send(blob);
  });

  return {
    publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`,
    path,
  };
}
