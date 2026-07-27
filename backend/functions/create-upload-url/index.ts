/**
 * create-upload-url
 * -----------------
 * Called by a creator when they start a video upload. Creates a Mux direct
 * upload (a signed PUT URL the client pushes bytes to), and inserts a
 * placeholder `episodes` row (status `uploading`, mux_upload_id set) so the
 * Mux webhook can find and finalize it when the asset is ready.
 *
 * The `passthrough` field on the Mux upload is set to the new episode id —
 * `mux-webhook` reads it on `video.asset.ready` to know which row to update.
 *
 * Creator-only: viewers cannot call this. Returns:
 *   { uploadUrl, uploadId, episodeId }
 *
 * Mux direct uploads: https://docs.mux.com/guides/video/upload-files-directly
 */

import { corsHeaders, createUserClient, json, requireAuth } from "../_shared/auth.ts";
import { muxFetch, MuxApiError } from "../_shared/mux.ts";

interface CreateUploadBody {
  title: string;
  category?: string;
  chapter?: string;
  /** Creator-chosen thumbnail (overrides Mux auto-thumb). */
  thumbUrl?: string;
}

interface MuxDirectUpload {
  id: string;
  url: string;
  timeout: number;
  new_asset_settings: {
    playback_policy: string[];
    passthrough?: string;
  };
}

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

  let body: CreateUploadBody;
  try {
    body = (await req.json()) as CreateUploadBody;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.title || body.title.trim().length === 0) {
    return json({ error: "title is required" }, 400);
  }

  const supabase = createUserClient(req);

  // Confirm creator status — only creators can upload.
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, is_creator, handle")
    .eq("id", user.userId)
    .single();
  if (profileErr || !profile) {
    return json({ error: "Profile not found" }, 404);
  }
  if (!profile.is_creator) {
    return json({ error: "Only creators can upload. Become a creator first." }, 403);
  }

  // 1. Insert the placeholder episode row so we have an id to passthrough.
  const { data: epRow, error: epErr } = await supabase
    .from("episodes")
    .insert({
      creator_id: user.userId,
      title: body.title.trim().slice(0, 120),
      category: body.category ?? "founder",
      chapter: body.chapter ?? null,
      thumb_url: body.thumbUrl ?? null,
      access: "subscribers",
      status: "uploading",
      video_url: null,
      mux_asset_id: null,
      mux_upload_id: null,
    })
    .select("id")
    .single();
  if (epErr || !epRow) {
    console.error("[create-upload-url] insert placeholder failed", epErr);
    return json({ error: "Could not create the episode record." }, 500);
  }

  const episodeId = epRow.id;

  // 2. Create the Mux direct upload. The passthrough is the episode id so the
  //    webhook can match the asset back to this row.
  let upload: MuxDirectUpload;
  try {
    upload = await muxFetch<MuxDirectUpload>("/video/v1/uploads", {
      method: "POST",
      body: JSON.stringify({
        cors_origin: "*",
        new_asset_settings: {
          playback_policy: ["signed"],
          per_title_encode: false,
          passthrough: episodeId,
          // Generate a static thumbnail + animated preview.
          mp4_support: "standard",
        },
      }),
    });
  } catch (err) {
    console.error("[create-upload-url] mux create failed", err);
    // Clean up the placeholder so we don't leave an orphaned row.
    await supabase.from("episodes").delete().eq("id", episodeId).catch(() => {});
    const msg = err instanceof MuxApiError
      ? "Could not start the upload with the video provider."
      : "Could not start the upload. Try again.";
    return json({ error: msg }, 502);
  }

  // 3. Stash the mux_upload_id so we can correlate if the webhook is slow.
  await supabase
    .from("episodes")
    .update({ mux_upload_id: upload.id })
    .eq("id", episodeId)
    .catch((e: unknown) => console.log("[create-upload-url] save upload id failed", e));

  return json({
    uploadUrl: upload.url,
    uploadId: upload.id,
    episodeId,
  });
}
