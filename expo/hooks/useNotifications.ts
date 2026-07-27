import { useEffect, useState, useCallback } from "react";

import { supabase } from "@/lib/supabase";

/**
 * In-app notifications feed.
 *
 * Derives a notifications list from real database activity:
 *  - New episodes from subscribed creators (episodes table + subscriptions)
 *  - Live streams from subscribed creators (live_streams where is_live=true)
 *  - Subscription renewals coming up (subscriptions.renews_at within 3 days)
 *  - Tips received (creator side)
 *
 * This replaces the static NOTICES array with live data, joined to creator
 * profiles for display.
 */

export interface AppNotification {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string | null;
  kind: "live" | "drop" | "ppv" | "tip" | "sub";
  text: string;
  when: string;
  href: string;
  unread: boolean;
}

interface SubbedCreator {
  id: string;
  name: string | null;
  handle: string | null;
  avatar_url: string | null;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Get my profile
      const { data: me } = await supabase
        .from("profiles")
        .select("id, is_creator")
        .maybeSingle();
      if (!me) {
        setIsLoading(false);
        return;
      }
      setMyUserId(me.id);

      // Get my active subscriptions (fan side) with creator profiles
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("creator_id, renews_at, active")
        .eq("fan_id", me.id)
        .eq("active", true);

      const creatorIds = (subs ?? []).map((s) => s.creator_id);
      const { data: creatorProfiles } = await supabase
        .from("profiles")
        .select("id, name, handle, avatar_url")
        .in("id", creatorIds.length > 0 ? creatorIds : ["none"]);

      const creatorMap = new Map<string, SubbedCreator>();
      for (const p of creatorProfiles ?? []) {
        creatorMap.set(p.id, { id: p.id, name: p.name, handle: p.handle, avatar_url: p.avatar_url });
      }

      const notices: AppNotification[] = [];

      // New episodes from subscribed creators (last 48h)
      if (creatorIds.length > 0) {
        const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const { data: newEps } = await supabase
          .from("episodes")
          .select("id, creator_id, title, access, ppv_price, posted_at, created_at")
          .in("creator_id", creatorIds)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(20);

        for (const ep of newEps ?? []) {
          const creator = creatorMap.get(ep.creator_id);
          if (!creator) continue;
          const isPpv = ep.access === "ppv";
          notices.push({
            id: `ep-${ep.id}`,
            creatorId: creator.id,
            creatorName: creator.name ?? creator.handle ?? "Creator",
            creatorAvatar: creator.avatar_url,
            kind: isPpv ? "ppv" : "drop",
            text: isPpv
              ? `dropped a premium POV: ${ep.title}`
              : `posted a new episode: ${ep.title}`,
            when: ep.posted_at ?? ep.created_at ?? new Date().toISOString(),
            href: `/episode/${ep.id}`,
            unread: false,
          });
        }

        // Live streams from subscribed creators
        const { data: liveStreams } = await supabase
          .from("live_streams")
          .select("id, creator_id, title, is_live, started_at")
          .in("creator_id", creatorIds)
          .eq("is_live", true)
          .limit(10);

        for (const stream of liveStreams ?? []) {
          const creator = creatorMap.get(stream.creator_id);
          if (!creator) continue;
          notices.push({
            id: `live-${stream.id}`,
            creatorId: creator.id,
            creatorName: creator.name ?? creator.handle ?? "Creator",
            creatorAvatar: creator.avatar_url,
            kind: "live",
            text: `is live now — ${stream.title}`,
            when: stream.started_at ?? new Date().toISOString(),
            href: `/live/${stream.id}`,
            unread: true,
          });
        }
      }

      // Upcoming subscription renewals (within 3 days)
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      for (const sub of subs ?? []) {
        if (!sub.renews_at) continue;
        if (sub.renews_at <= threeDaysFromNow) {
          const creator = creatorMap.get(sub.creator_id);
          if (!creator) continue;
          notices.push({
            id: `renew-${sub.creator_id}`,
            creatorId: creator.id,
            creatorName: creator.name ?? creator.handle ?? "Creator",
            creatorAvatar: creator.avatar_url,
            kind: "sub",
            text: "your subscription renews in 3 days",
            when: sub.renews_at,
            href: "/subscriptions",
            unread: false,
          });
        }
      }

      // Tips received (if creator)
      if (me.is_creator) {
        const { data: tips } = await supabase
          .from("tips")
          .select("id, fan_id, amount, created_at, message")
          .eq("creator_id", me.id)
          .order("created_at", { ascending: false })
          .limit(10);

        for (const tip of tips ?? []) {
          const { data: fan } = await supabase
            .from("profiles")
            .select("name, handle, avatar_url")
            .eq("id", tip.fan_id)
            .maybeSingle();
          notices.push({
            id: `tip-${tip.id}`,
            creatorId: tip.fan_id,
            creatorName: fan?.name ?? fan?.handle ?? "A fan",
            creatorAvatar: fan?.avatar_url ?? null,
            kind: "tip",
            text: `tipped you $${Number(tip.amount).toFixed(2)}${tip.message ? ` — "${tip.message}"` : ""}`,
            when: tip.created_at ?? new Date().toISOString(),
            href: "/earnings",
            unread: false,
          });
        }
      }

      // Sort by date descending
      notices.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
      setNotifications(notices);
    } catch (err) {
      console.error("[povme] useNotifications load failed", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // Refresh every 60 seconds
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  return { notifications, isLoading, myUserId, refetch: load };
}
