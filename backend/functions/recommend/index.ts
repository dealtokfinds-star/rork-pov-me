import { requireAuth, AuthError, corsHeaders, json } from "../_shared/auth.ts";

/**
 * GET/POST /recommend
 * Returns ranked creator lists for discovery: trending, rising, and for-you.
 *
 * Query params (GET) or body (POST):
 *   mode: "trending" | "rising" | "foryou"  (default: trending)
 *   category?: PovCategory id — restrict to a category
 *   limit?: number (default 20, max 50)
 *
 * Ranking uses the `creator_stats` view (subscribers, episode views/likes/tips)
 * plus recency of the latest episode and whether the creator is currently live.
 *
 * "foryou" blends the user's declared interests (profiles.interests) with a
 * relevance score, boosting creators whose categories overlap with interests.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    let userId: string | null = null;
    try {
      const user = await requireAuth(req);
      userId = user.userId;
    } catch {
      // allow anonymous discovery (trending/rising are public)
    }

    const params = req.method === "GET"
      ? new URL(req.url).searchParams
      : new URLSearchParams(Object.entries(await req.json().catch(() => ({})) as Record<string, unknown>) as [string, string][]);

    const mode = (params.get("mode") ?? "trending") as "trending" | "rising" | "foryou";
    const category = params.get("category");
    const limit = Math.min(50, Math.max(1, Number(params.get("limit") ?? 20)));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const headers: Record<string, string> = { apikey: anonKey };
    if (userId) {
      headers["Authorization"] = req.headers.get("Authorization")!;
    }

    // Fetch creator_stats joined with profile display fields + latest episode recency + live status.
    // We do this in two steps: stats view + profiles, then merge client-side in the edge function.
    const statsUrl = new URL(`${supabaseUrl}/rest/v1/creator_stats`);
    statsUrl.searchParams.set("select", "creator_id,is_creator,verified,sub_price,categories,sub_count,ep_count,ep_views,ep_likes,ep_tips");
    statsUrl.searchParams.set("is_creator", "eq.true");

    const statsRes = await fetch(statsUrl, { headers: { ...headers, Accept: "application/json" } });
    if (!statsRes.ok) {
      console.error("[recommend] creator_stats fetch failed:", await statsRes.text());
      return json({ error: "Ranking unavailable" }, 502);
    }
    const stats = await statsRes.json() as Array<{
      creator_id: string;
      is_creator: boolean;
      verified: boolean;
      sub_price: number;
      categories: string[] | null;
      sub_count: number;
      ep_count: number;
      ep_views: number;
      ep_likes: number;
      ep_tips: number;
    }>;

    if (stats.length === 0) {
      return json({ items: [], mode, category });
    }

    const creatorIds = stats.map((s) => s.creator_id);

    // Fetch display fields + interests (for for-you) in one call using an `in` filter.
    const profilesUrl = new URL(`${supabaseUrl}/rest/v1/profiles`);
    profilesUrl.searchParams.set("select", "id,name,handle,avatar_url,cover_url,bio,identity,location,categories,interests,verified,sub_price");
    profilesUrl.searchParams.set("id", `in.(${creatorIds.join(",")})`);

    const profilesRes = await fetch(profilesUrl, { headers: { ...headers, Accept: "application/json" } });
    if (!profilesRes.ok) {
      console.error("[recommend] profiles fetch failed:", await profilesRes.text());
      return json({ error: "Ranking unavailable" }, 502);
    }
    const profiles = await profilesRes.json() as Array<{
      id: string;
      name: string | null;
      handle: string | null;
      avatar_url: string | null;
      cover_url: string | null;
      bio: string | null;
      identity: string | null;
      location: string | null;
      categories: string[] | null;
      interests: string[] | null;
      verified: boolean | null;
      sub_price: number | null;
    }>;

    // Latest episode recency per creator (for rising / trending boost)
    const epUrl = new URL(`${supabaseUrl}/rest/v1/episodes`);
    epUrl.searchParams.set("select", "creator_id,posted_at");
    epUrl.searchParams.set("creator_id", `in.(${creatorIds.join(",")})`);
    epUrl.searchParams.set("order", "posted_at.desc");
    epUrl.searchParams.set("limit", "1000");

    const epRes = await fetch(epUrl, { headers: { ...headers, Accept: "application/json" } });
    const episodes = epRes.ok ? await epRes.json() as Array<{ creator_id: string; posted_at: string | null }> : [];
    const latestByCreator = new Map<string, number>();
    for (const e of episodes) {
      if (e.posted_at && !latestByCreator.has(e.creator_id)) {
        latestByCreator.set(e.creator_id, new Date(e.posted_at).getTime());
      }
    }

    // Live status
    const liveUrl = new URL(`${supabaseUrl}/rest/v1/live_streams`);
    liveUrl.searchParams.set("select", "creator_id");
    liveUrl.searchParams.set("is_live", "eq.true");
    const liveRes = await fetch(liveUrl, { headers: { ...headers, Accept: "application/json" } });
    const liveRows = liveRes.ok ? await liveRes.json() as Array<{ creator_id: string }> : [];
    const liveIds = new Set(liveRows.map((r) => r.creator_id));

    // My interests for for-you
    let myInterests: Set<string> = new Set();
    if (mode === "foryou" && userId) {
      const meUrl = new URL(`${supabaseUrl}/rest/v1/profiles`);
      meUrl.searchParams.set("select", "interests");
      meUrl.searchParams.set("id", `eq.${userId}`);
      const meRes = await fetch(meUrl, { headers: { ...headers, Accept: "application/json" } });
      if (meRes.ok) {
        const meRows = await meRes.json() as Array<{ interests: string[] | null }>;
        myInterests = new Set(meRows[0]?.interests ?? []);
      }
    }

    const now = Date.now();
    const DAY = 86_400_000;

    type Scored = {
      id: string;
      score: number;
      subCount: number;
      epCount: number;
      epViews: number;
      epLikes: number;
      epTips: number;
      isLive: boolean;
      daysSincePost: number;
      categoryMatch: number;
    };

    const scored: Scored[] = [];
    for (const s of stats) {
      const cats = s.categories ?? [];
      if (category && !cats.includes(category)) continue;

      const daysSincePost = latestByCreator.has(s.creator_id)
        ? Math.max(0, (now - (latestByCreator.get(s.creator_id) ?? now)) / DAY)
        : 999;

      const isLive = liveIds.has(s.creator_id);
      const categoryMatch = mode === "foryou"
        ? cats.filter((c) => myInterests.has(c)).length
        : 0;

      let score: number;
      if (mode === "rising") {
        // Rising: reward recent posting + growing engagement, not raw size.
        const recencyBoost = Math.exp(-daysSincePost / 14); // half-life ~10 days
        const engagement = s.ep_likes + s.ep_tips * 2;
        score = (s.ep_count * 0.6 + engagement * 0.4) * recencyBoost * 100;
      } else if (mode === "foryou") {
        // For-you: blend category affinity with engagement and a recency tail.
        const recencyBoost = Math.exp(-daysSincePost / 30);
        const engagement = s.ep_views + s.ep_likes * 5 + s.ep_tips * 10;
        const sizeNorm = Math.log10(s.sub_count + 10);
        score = (categoryMatch * 40 + engagement * 0.01 + sizeNorm * 5) * (0.6 + recencyBoost * 0.4) * 100;
      } else {
        // Trending: blend subscribers, engagement, recency, live bonus.
        const recencyBoost = Math.exp(-daysSincePost / 21);
        const engagement = s.ep_views + s.ep_likes * 3 + s.ep_tips * 5;
        const sizeNorm = Math.log10(s.sub_count + 10);
        score = (sizeNorm * 30 + engagement * 0.02) * (0.5 + recencyBoost * 0.5) * 100;
      }
      if (isLive) score *= 1.15; // live creators surface higher

      scored.push({
        id: s.creator_id,
        score,
        subCount: s.sub_count,
        epCount: s.ep_count,
        epViews: s.ep_views,
        epLikes: s.ep_likes,
        epTips: s.ep_tips,
        isLive,
        daysSincePost,
        categoryMatch,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, limit);

    // Hydrate with profile display fields
    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const items = top.map((t) => {
      const p = profileById.get(t.id);
      return {
        id: t.id,
        name: p?.name ?? "",
        handle: p?.handle ?? "",
        avatar_url: p?.avatar_url ?? null,
        cover_url: p?.cover_url ?? null,
        bio: p?.bio ?? null,
        identity: p?.identity ?? null,
        location: p?.location ?? null,
        categories: (p?.categories ?? []) as string[],
        verified: p?.verified ?? false,
        sub_price: p?.sub_price ?? s_defaultPrice,
        is_live: t.isLive,
        subscribers: t.subCount,
        episodes: t.epCount,
        score: Math.round(t.score),
        category_match: t.categoryMatch,
      };
    });

    return json({ items, mode, category: category ?? null });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: "Unauthorized" }, 401);
    console.error("[recommend] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

const s_defaultPrice = 9.99;
