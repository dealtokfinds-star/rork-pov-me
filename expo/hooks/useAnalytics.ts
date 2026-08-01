import { useCallback } from "react";

import { callEdge } from "@/lib/edge";
import { supabase } from "@/lib/supabase";

/**
 * Creator analytics — event ingestion + aggregate queries.
 *
 * trackEvent() sends an analytics event to the track-event edge function
 * (views, likes, unlocks, tips, watch_time, shares). The events table has
 * RLS: the owner and the creator (whose content was viewed) can read.
 *
 * fetchCreatorAnalytics() pulls aggregated data for the signed-in creator:
 *  - daily revenue trend (sub/ppv/tip) from the creator_revenue_daily view
 *  - top episodes from episode_performance view
 *  - totals from the transactions/tips/unlocks tables
 *  - subscriber count from subscriptions
 */

export type EventKind = "view" | "like" | "unlock" | "tip" | "sub" | "watch_time" | "share";

export function useAnalytics() {
  const trackEvent = useCallback(
    async (input: {
      kind: EventKind;
      creatorId?: string;
      episodeId?: string;
      streamId?: string;
      value?: number;
      metadata?: Record<string, unknown>;
    }): Promise<void> => {
      try {
        await callEdge("track-event", {
          kind: input.kind,
          creator_id: input.creatorId,
          episode_id: input.episodeId,
          stream_id: input.streamId,
          value: input.value,
          metadata: input.metadata,
        });
      } catch (err) {
        // Analytics failures should never break UX
        console.log("[povme] trackEvent failed", err);
      }
    },
    [],
  );

  /** Track a view event — fire-and-forget. */
  const trackView = useCallback(
    (episodeId?: string, streamId?: string, creatorId?: string) => {
      void trackEvent({ kind: "view", episodeId, streamId, creatorId });
    },
    [trackEvent],
  );

  /** Track watch time progress — fire-and-forget. */
  const trackWatchTime = useCallback(
    (episodeId: string, seconds: number, creatorId?: string) => {
      void trackEvent({ kind: "watch_time", episodeId, value: seconds, creatorId });
    },
    [trackEvent],
  );

  /** Track a like — fire-and-forget. */
  const trackLike = useCallback(
    (episodeId?: string, creatorId?: string) => {
      void trackEvent({ kind: "like", episodeId, creatorId });
    },
    [trackEvent],
  );

  /** Track a share — fire-and-forget. */
  const trackShare = useCallback(
    (episodeId?: string, creatorId?: string) => {
      void trackEvent({ kind: "share", episodeId, creatorId });
    },
    [trackEvent],
  );

  return { trackEvent, trackView, trackWatchTime, trackLike, trackShare };
}

export interface CreatorAnalytics {
  totalViews: number;
  totalSubs: number;
  totalTips: number;
  totalUnlocks: number;
  netRevenue: number;
  grossRevenue: number;
  topEpisodes: Array<{
    episode_id: string;
    title: string;
    thumb_url: string | null;
    total_views: number;
    total_unlocks: number;
    total_tips: number;
    total_likes: number;
  }>;
  revenueTrend: Array<{
    day: string;
    sub_revenue: number;
    ppv_revenue: number;
    tip_revenue: number;
  }>;
}

/** Fetch aggregated analytics for the signed-in creator. */
export async function fetchCreatorAnalytics(
  rangeDays = 30,
  userId?: string | null,
): Promise<CreatorAnalytics | null> {
  if (!userId) return null;
  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();

  // Get the creator's own profile row (id-filtered — profiles are publicly
  // readable, so an unfiltered maybeSingle() fails with multiple rows).
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, is_creator")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile?.is_creator) return null;
  const creatorId = profile.id;

  // Run queries in parallel
  const [
    viewsResult,
    subsResult,
    tipsResult,
    unlocksResult,
    revenueResult,
    trendResult,
    topEpsResult,
  ] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }).eq("creator_id", creatorId).eq("kind", "view").gte("created_at", since),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("creator_id", creatorId).eq("active", true),
    supabase.from("tips").select("amount").eq("creator_id", creatorId).gte("created_at", since),
    supabase.from("unlocks").select("price").eq("creator_id", creatorId).eq("status", "completed"),
    supabase.from("transactions").select("amount, platform_fee, creator_payout").eq("creator_id", creatorId).eq("status", "completed").gte("created_at", since),
    supabase.from("creator_revenue_daily").select("day, sub_revenue, ppv_revenue, tip_revenue").eq("creator_id", creatorId).gte("day", since).order("day", { ascending: true }),
    supabase.from("episode_performance").select("episode_id, total_views, total_unlocks, total_tips, total_likes").eq("creator_id", creatorId).order("total_views", { ascending: false }).limit(5),
  ]);

  const totalViews = viewsResult.count ?? 0;
  const totalSubs = subsResult.count ?? 0;
  const totalTips = (tipsResult.data ?? []).reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
  const totalUnlocks = (unlocksResult.data ?? []).length;

  const grossRevenue = (revenueResult.data ?? []).reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
  const netRevenue = (revenueResult.data ?? []).reduce((sum, t) => sum + Number(t.creator_payout ?? 0), 0);

  // Fetch episode titles/thumbnails for top episodes
  const topEpIds = (topEpsResult.data ?? []).map((e) => e.episode_id);
  const episodeMeta: Record<string, { title: string; thumb_url: string | null }> = {};
  if (topEpIds.length > 0) {
    const { data: eps } = await supabase.from("episodes").select("id, title, thumb_url").in("id", topEpIds);
    for (const e of eps ?? []) {
      episodeMeta[e.id] = { title: e.title, thumb_url: e.thumb_url };
    }
  }

  return {
    totalViews,
    totalSubs,
    totalTips,
    totalUnlocks,
    netRevenue,
    grossRevenue,
    topEpisodes: (topEpsResult.data ?? []).map((e) => ({
      episode_id: e.episode_id,
      title: episodeMeta[e.episode_id]?.title ?? "Untitled",
      thumb_url: episodeMeta[e.episode_id]?.thumb_url ?? null,
      total_views: e.total_views ?? 0,
      total_unlocks: e.total_unlocks ?? 0,
      total_tips: e.total_tips ?? 0,
      total_likes: e.total_likes ?? 0,
    })),
    revenueTrend: (trendResult.data ?? []).map((d) => ({
      day: d.day,
      sub_revenue: Number(d.sub_revenue ?? 0),
      ppv_revenue: Number(d.ppv_revenue ?? 0),
      tip_revenue: Number(d.tip_revenue ?? 0),
    })),
  };
}
