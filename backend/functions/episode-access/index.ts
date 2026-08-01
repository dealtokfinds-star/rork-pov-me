import { corsHeaders, createUserClient, json, requireAuth } from "../_shared/auth.ts";

/**
 * episode-access
 * --------------
 * Server-side access gate for a VOD episode. Viewers call this before
 * playing the video. Returns:
 *  - { allowed: true, videoUrl } when access is granted
 *  - { allowed: false, reason, price, creatorId } when blocked
 *
 * Mirrors stream-access but for the episodes table.
 *
 * Rules:
 *  - free → allowed for everyone (even anon)
 *  - subscribers → allowed iff the viewer has an active subscription
 *  - ppv → allowed iff the viewer has an unlock row for this episode
 *    (or is a subscriber — subscribers get PPV free)
 *  - The creator themselves always pass.
 */

interface EpisodeAccessResponse {
  allowed: boolean;
  reason?: "subscribe" | "ppv" | "unauthenticated" | "not_found" | "unpublished";
  videoUrl?: string | null;
  price?: number;
  creatorId?: string;
  access?: string;
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
    } as EpisodeAccessResponse, 200);
  }

  let body: { episodeId?: string };
  try {
    body = (await req.json()) as { episodeId?: string };
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.episodeId) {
    return json({ error: "episodeId is required" }, 400);
  }

  const supabase = createUserClient(req);

  const { data: episode, error } = await supabase
    .from("episodes")
    .select("id, creator_id, access, ppv_price, video_url, status")
    .eq("id", body.episodeId)
    .maybeSingle();

  if (error || !episode) {
    return json({ allowed: false, reason: "not_found" } as EpisodeAccessResponse, 200);
  }

  // Only published (or scheduled-visible) episodes are playable.
  if (episode.status && episode.status !== "published") {
    return json({ allowed: false, reason: "unpublished" } as EpisodeAccessResponse, 200);
  }

  // Creator always passes.
  if (episode.creator_id === user.userId) {
    return json({
      allowed: true,
      videoUrl: episode.video_url,
      access: episode.access,
    } as EpisodeAccessResponse, 200);
  }

  if (episode.access === "free") {
    return json({
      allowed: true,
      videoUrl: episode.video_url,
      access: episode.access,
    } as EpisodeAccessResponse, 200);
  }

  // Check subscription (covers both "subscribers" and PPV-with-sub).
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("fan_id", user.userId)
    .eq("creator_id", episode.creator_id)
    .eq("active", true)
    .maybeSingle();

  if (sub) {
    return json({
      allowed: true,
      videoUrl: episode.video_url,
      access: episode.access,
    } as EpisodeAccessResponse, 200);
  }

  if (episode.access === "subscribers") {
    return json({
      allowed: false,
      reason: "subscribe",
      creatorId: episode.creator_id,
    } as EpisodeAccessResponse, 200);
  }

  // access === "ppv": check unlock for this episode.
  const { data: unlock } = await supabase
    .from("unlocks")
    .select("id")
    .eq("fan_id", user.userId)
    .eq("episode_id", body.episodeId)
    .maybeSingle();

  if (unlock) {
    return json({
      allowed: true,
      videoUrl: episode.video_url,
      access: episode.access,
    } as EpisodeAccessResponse, 200);
  }

  return json({
    allowed: false,
    reason: "ppv",
    price: episode.ppv_price ?? 0,
    creatorId: episode.creator_id,
  } as EpisodeAccessResponse, 200);
}

Deno.serve(handler);
