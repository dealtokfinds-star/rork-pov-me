import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type {
  AccessLevel,
  Creator,
  Episode,
  LiveStream,
  PovCategory,
  SocialLinks,
  StudioEpisode,
  StreamAccess,
} from "@/types";

/**
 * Data layer that bridges Supabase rows to the existing UI types.
 * Keeps the cards/components unchanged — they still receive the same shapes.
 */

type ProfileRow = {
  id: string;
  handle: string;
  name: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  identity: string | null;
  location: string | null;
  categories: string[] | null;
  social_links: Record<string, string> | null;
  is_creator: boolean | null;
  verified: boolean | null;
  sub_price: number | null;
  onboarded: boolean | null;
};

type EpisodeRow = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  thumb_url: string | null;
  video_url: string | null;
  duration_sec: number | null;
  access: string;
  ppv_price: number | null;
  category: string;
  chapter: string | null;
  views: number | null;
  likes: number | null;
  tips: number | null;
  posted_at: string | null;
};

type StreamRow = {
  id: string;
  creator_id: string;
  title: string;
  thumb_url: string | null;
  category: string;
  access: string;
  ppv_price: number | null;
  viewers: number | null;
  is_live: boolean | null;
  replay_enabled: boolean | null;
  started_at: string | null;
};

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function startedMinutesAgo(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function mapCreator(row: ProfileRow, liveIds: Set<string>): Creator {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    avatar: row.avatar_url ?? "",
    cover: row.cover_url ?? row.avatar_url ?? "",
    bio: row.bio ?? "",
    identity: row.identity ?? "",
    location: row.location ?? "",
    categories: (row.categories ?? []) as PovCategory[],
    subPrice: Number(row.sub_price ?? 9.99),
    subscribers: 0,
    episodes: 0,
    verified: row.verified ?? false,
    isLive: liveIds.has(row.id),
    rating: 4.8,
    socialLinks: (row.social_links ?? {}) as SocialLinks,
  };
}

function mapEpisode(row: EpisodeRow): Episode {
  return {
    id: row.id,
    creatorId: row.creator_id,
    title: row.title,
    description: row.description ?? "",
    thumb: row.thumb_url ?? "",
    video: row.video_url ?? "",
    durationSec: row.duration_sec ?? 0,
    access: row.access as AccessLevel,
    ppvPrice: row.ppv_price ?? undefined,
    category: row.category as PovCategory,
    chapter: row.chapter ?? "",
    views: row.views ?? 0,
    likes: row.likes ?? 0,
    tips: row.tips ?? 0,
    postedAt: relTime(row.posted_at),
  };
}

function mapStream(row: StreamRow): LiveStream {
  return {
    id: row.id,
    creatorId: row.creator_id,
    title: row.title,
    thumb: row.thumb_url ?? "",
    video: "",
    category: row.category as PovCategory,
    access: row.access as StreamAccess,
    ppvPrice: row.ppv_price ?? undefined,
    viewers: row.viewers ?? 0,
    startedMinutesAgo: startedMinutesAgo(row.started_at),
    replayEnabled: row.replay_enabled ?? false,
  };
}

async function fetchCreators(): Promise<Creator[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, name, avatar_url, cover_url, bio, identity, location, categories, social_links, is_creator, verified, sub_price, onboarded")
    .eq("is_creator", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[povme] fetchCreators:", error.message);
    throw error;
  }

  const liveIds = await fetchLiveCreatorIds();
  return (data ?? []).map((r) => mapCreator(r as ProfileRow, liveIds));
}

async function fetchLiveCreatorIds(): Promise<Set<string>> {
  const { data } = await supabase
    .from("live_streams")
    .select("creator_id")
    .eq("is_live", true);
  return new Set((data ?? []).map((r) => r.creator_id as string));
}

async function fetchEpisodes(): Promise<Episode[]> {
  const { data, error } = await supabase
    .from("episodes")
    .select("id, creator_id, title, description, thumb_url, video_url, duration_sec, access, ppv_price, category, chapter, views, likes, tips, posted_at")
    .order("posted_at", { ascending: false });

  if (error) {
    console.error("[povme] fetchEpisodes:", error.message);
    throw error;
  }

  return (data ?? []).map((r) => mapEpisode(r as EpisodeRow));
}

async function fetchStreams(): Promise<LiveStream[]> {
  const { data, error } = await supabase
    .from("live_streams")
    .select("id, creator_id, title, thumb_url, category, access, ppv_price, viewers, is_live, replay_enabled, started_at")
    .eq("is_live", true)
    .order("viewers", { ascending: false });

  if (error) {
    console.error("[povme] fetchStreams:", error.message);
    throw error;
  }

  return (data ?? []).map((r) => mapStream(r as StreamRow));
}

async function fetchEpisodeById(id: string): Promise<Episode | null> {
  const { data, error } = await supabase
    .from("episodes")
    .select("id, creator_id, title, description, thumb_url, video_url, duration_sec, access, ppv_price, category, chapter, views, likes, tips, posted_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[povme] fetchEpisodeById:", error.message);
    throw error;
  }
  return data ? mapEpisode(data as EpisodeRow) : null;
}

async function fetchCreatorById(id: string): Promise<Creator | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, name, avatar_url, cover_url, bio, identity, location, categories, social_links, is_creator, verified, sub_price, onboarded")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[povme] fetchCreatorById:", error.message);
    throw error;
  }
  if (!data) return null;
  const liveIds = await fetchLiveCreatorIds();
  return mapCreator(data as ProfileRow, liveIds);
}

async function fetchEpisodesByCreator(creatorId: string): Promise<Episode[]> {
  const { data, error } = await supabase
    .from("episodes")
    .select("id, creator_id, title, description, thumb_url, video_url, duration_sec, access, ppv_price, category, chapter, views, likes, tips, posted_at")
    .eq("creator_id", creatorId)
    .order("posted_at", { ascending: false });

  if (error) {
    console.error("[povme] fetchEpisodesByCreator:", error.message);
    throw error;
  }
  return (data ?? []).map((r) => mapEpisode(r as EpisodeRow));
}

async function fetchStreamById(id: string): Promise<LiveStream | null> {
  const { data, error } = await supabase
    .from("live_streams")
    .select("id, creator_id, title, thumb_url, category, access, ppv_price, viewers, is_live, replay_enabled, started_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[povme] fetchStreamById:", error.message);
    throw error;
  }
  return data ? mapStream(data as StreamRow) : null;
}

export function useCreators() {
  return useQuery<Creator[]>({
    queryKey: ["creators"],
    queryFn: fetchCreators,
  });
}

export function useEpisodes() {
  return useQuery<Episode[]>({
    queryKey: ["episodes"],
    queryFn: fetchEpisodes,
  });
}

export function useStreams() {
  return useQuery<LiveStream[]>({
    queryKey: ["streams"],
    queryFn: fetchStreams,
  });
}

export function useCreator(id: string | undefined) {
  return useQuery<Creator | null>({
    queryKey: ["creator", id],
    queryFn: () => fetchCreatorById(id!),
    enabled: !!id,
  });
}

export function useEpisode(id: string | undefined) {
  return useQuery<Episode | null>({
    queryKey: ["episode", id],
    queryFn: () => fetchEpisodeById(id!),
    enabled: !!id,
  });
}

export function useCreatorEpisodes(creatorId: string | undefined) {
  return useQuery<Episode[]>({
    queryKey: ["creator-episodes", creatorId],
    queryFn: () => fetchEpisodesByCreator(creatorId!),
    enabled: !!creatorId,
  });
}

type StudioEpisodeRow = {
  id: string;
  title: string;
  thumb_url: string | null;
  video_url: string | null;
  access: string;
  ppv_price: number | null;
  category: string;
  chapter: string | null;
  status: string;
  views: number | null;
  likes: number | null;
  tips: number | null;
  posted_at: string | null;
  scheduled_at: string | null;
  mux_upload_id: string | null;
  mux_asset_id: string | null;
};

function mapStudioEpisode(row: StudioEpisodeRow): StudioEpisode {
  const isProcessing = row.status === "uploading" || row.status === "transcoding";
  const postedAt =
    row.status === "published" ? relTime(row.posted_at)
    : row.status === "scheduled" ? (row.scheduled_at ? relTime(row.scheduled_at) : "queued")
    : "—";
  return {
    id: row.id,
    title: row.title,
    thumb: row.thumb_url ?? "",
    access: row.access as AccessLevel,
    ppvPrice: row.ppv_price ?? undefined,
    status: isProcessing ? "draft" : (row.status as "published" | "scheduled" | "draft"),
    views: row.views ?? 0,
    earned: Number(row.tips ?? 0) + Number(row.views ?? 0) * 0,
    category: row.category as PovCategory,
    postedAt,
  };
}

async function fetchStudioEpisodes(creatorId: string): Promise<StudioEpisode[]> {
  const { data, error } = await supabase
    .from("episodes")
    .select(
      "id, title, thumb_url, video_url, access, ppv_price, category, chapter, status, views, likes, tips, posted_at, scheduled_at, mux_upload_id, mux_asset_id",
    )
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[povme] fetchStudioEpisodes:", error.message);
    throw error;
  }
  return (data ?? []).map((r) => mapStudioEpisode(r as StudioEpisodeRow));
}

export function useStudioEpisodes(creatorId: string | null | undefined) {
  return useQuery<StudioEpisode[]>({
    queryKey: ["studio-episodes", creatorId],
    queryFn: () => fetchStudioEpisodes(creatorId!),
    enabled: !!creatorId,
    staleTime: 15_000,
  });
}

export function useStream(id: string | undefined) {
  return useQuery<LiveStream | null>({
    queryKey: ["stream", id],
    queryFn: () => fetchStreamById(id!),
    enabled: !!id,
  });
}
