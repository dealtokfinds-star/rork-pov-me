import { useCallback } from "react";

import { useAuth } from "@/hooks/useAuth";
import { callEdge } from "@/lib/edge";

/** Event kinds the backend `events` table understands. */
export type TrackKind =
  | "view"
  | "like"
  | "follow"
  | "tip"
  | "subscribe"
  | "unlock"
  | "publish"
  | "go_live"
  | "share"
  | "watch_time";

export interface TrackPayload {
  creator_id?: string;
  episode_id?: string;
  stream_id?: string;
  value?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget analytics tracking into the `events` table via the
 * `track-event` edge function. Powers recommendations, creator funnels,
 * and live-start push fan-out. Never blocks the UI and never throws —
 * analytics must not break user flows.
 */
export function useTrackEvent() {
  const { user } = useAuth();

  return useCallback(
    (kind: TrackKind, payload: TrackPayload = {}): void => {
      if (!user) return; // guests have no events row
      callEdge("track-event", { kind, ...payload }).catch((err) => {
        console.log("[povme] track-event failed", err);
      });
    },
    [user],
  );
}
