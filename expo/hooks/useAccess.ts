import { useQuery } from "@tanstack/react-query";

import { callEdge } from "@/lib/edge";

export interface EpisodeAccessResult {
  allowed: boolean;
  reason?: "subscribe" | "ppv" | "unauthenticated" | "not_found" | "unpublished";
  videoUrl?: string | null;
  price?: number;
  creatorId?: string;
  access?: string;
}

export interface StreamAccessResult {
  allowed: boolean;
  reason?: "subscribe" | "ppv" | "unauthenticated" | "ended" | "not_found";
  hlsPlaybackUrl?: string | null;
  muxPlaybackId?: string | null;
  price?: number;
  creatorId?: string;
  isLive?: boolean;
}

/**
 * Server-enforced access check for a VOD episode.
 * Calls the `episode-access` edge function which checks free/subscribers/ppv
 * + subscription/unlock rows server-side. Returns the video URL only if allowed.
 */
export function useEpisodeAccess(episodeId: string | null | undefined) {
  return useQuery<EpisodeAccessResult>({
    queryKey: ["episode-access", episodeId],
    queryFn: async (): Promise<EpisodeAccessResult> => {
      if (!episodeId) return { allowed: false, reason: "not_found" };
      return callEdge<EpisodeAccessResult>("episode-access", { episodeId });
    },
    enabled: !!episodeId,
    staleTime: 10_000,
    retry: 1,
  });
}

/**
 * Server-enforced access check for a live stream.
 * Calls the `stream-access` edge function which returns a signed HLS URL
 * only if the viewer has access (public/subscriber/PPV-unlock).
 */
export function useStreamAccess(streamId: string | null | undefined) {
  return useQuery<StreamAccessResult>({
    queryKey: ["stream-access", streamId],
    queryFn: async (): Promise<StreamAccessResult> => {
      if (!streamId) return { allowed: false, reason: "not_found" };
      return callEdge<StreamAccessResult>("stream-access", { streamId });
    },
    enabled: !!streamId,
    staleTime: 5_000,
    retry: 1,
  });
}
