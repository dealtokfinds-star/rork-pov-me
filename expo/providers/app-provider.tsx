import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { openCheckout, cancelSubscription as cancelStripeSub } from "@/lib/payments";
import { supabase } from "@/lib/supabase";
import type {
  AccessLevel,
  Episode,
  PovCategory,
  StudioEpisode,
} from "@/types";

import {
  useCreatorStats,
  useLikes,
  useSaves,
  useSubscriptions,
  type CreatorStats,
  type SubInfo,
} from "@/hooks/useServerData";

const STORAGE_KEY = "povme.state.v1";

/**
 * Persisted state is now a CACHE ONLY. The source of truth is the server
 * `profiles` row. AsyncStorage holds the last-known values so the UI can
 * render instantly before the network resolves, but every field is
 * overwritten by the server hydration on sign-in.
 */
interface PersistedState {
  onboarded: boolean;
  isCreator: boolean;
  displayName: string;
  handle: string;
  /** Real wallet balance from profiles.wallet_balance — credited only by webhooks. */
  balance: number;
  interests: PovCategory[];
  creatorPrice: number;
  totalSpent: number;
}

const DEFAULT_STATE: PersistedState = {
  onboarded: false,
  isCreator: false,
  displayName: "",
  handle: "",
  balance: 0,
  interests: [],
  creatorPrice: 12.99,
  totalSpent: 0,
};

export const [AppProvider, useApp] = createContextHook(() => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [state, setState] = useState<PersistedState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [kycStatus, setKycStatus] = useState<string>("unverified");
  const [kycLastReason, setKycLastReason] = useState<string | null>(null);
  const hydrationAttempted = useRef<boolean>(false);

  // ─── Restore cached state from AsyncStorage (cache only) ───────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as Partial<PersistedState>;
          setState({ ...DEFAULT_STATE, ...parsed });
        }
      } catch (error) {
        console.log("[povme] failed to restore state", error);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Persist cache to AsyncStorage ─────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((error) => {
      console.log("[povme] failed to persist state", error);
    });
  }, [state, hydrated]);

  // ─── Server hydration: fetch the real profile row on sign-in ───────────────
  useEffect(() => {
    if (!user?.id || !hydrated || hydrationAttempted.current) return;
    hydrationAttempted.current = true;

    const hydrate = async (): Promise<void> => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "id, name, handle, wallet_balance, total_spent, onboarded, is_creator, interests, sub_price, kyc_status, kyc_last_reason",
          )
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("[povme] profile hydration failed:", error.message);
          return;
        }

        if (data) {
          setState((prev) => ({
            ...prev,
            displayName: data.name ?? prev.displayName,
            handle: data.handle ?? prev.handle,
            balance: Number(data.wallet_balance ?? 0),
            totalSpent: Number(data.total_spent ?? 0),
            onboarded: data.onboarded ?? false,
            isCreator: data.is_creator ?? false,
            interests: (data.interests ?? []) as PovCategory[],
            creatorPrice: Number(data.sub_price ?? prev.creatorPrice),
          }));
          setKycStatus(data.kyc_status ?? "unverified");
          setKycLastReason(data.kyc_last_reason ?? null);
        }
      } catch (err) {
        console.error("[povme] hydration error", err);
      }
    };

    void hydrate();
  }, [user?.id, hydrated]);

  // Reset hydration flag when user signs out
  useEffect(() => {
    if (!user) {
      hydrationAttempted.current = false;
      setKycStatus("unverified");
      setKycLastReason(null);
    }
  }, [user]);

  // ─── Real server data hooks ────────────────────────────────────────────────
  const subsQuery = useSubscriptions();
  const savesHook = useSaves();
  const likesHook = useLikes();

  const activeSubs = useMemo(
    () => (subsQuery.data ?? []).filter((s) => s.active),
    [subsQuery.data],
  );

  const monthlySpend = useMemo(
    () => activeSubs.reduce((sum, s) => sum + s.price, 0),
    [activeSubs],
  );

  const isSubscribed = useCallback(
    (creatorId: string): boolean =>
      activeSubs.some((s) => s.creatorId === creatorId),
    [activeSubs],
  );

  // ─── Access checks (optimistic hints — server is source of truth) ──────────
  const hasUnlocked = useCallback(
    (_episodeId: string): boolean => {
      // Server-enforced via episode-access edge function.
      // This local hint is not used for gating anymore.
      return false;
    },
    [],
  );

  const hasStreamAccess = useCallback(
    (_streamId: string): boolean => {
      // Server-enforced via stream-access edge function.
      return false;
    },
    [],
  );

  const canWatch = useCallback(
    (episode: Episode): boolean => {
      if (episode.access === "free") return true;
      if (episode.access === "subscribers") return isSubscribed(episode.creatorId);
      return false; // PPV — server checks unlock row
    },
    [isSubscribed],
  );

  // ─── Stripe payments (real — webhook confirms) ─────────────────────────────

  const topUpViaStripe = useCallback(
    async (amount: number): Promise<{ success: boolean; error?: string }> => {
      const result = await openCheckout({ type: "topup", amount });
      if (!result.success) {
        return { success: false, error: result.error ?? "Payment cancelled" };
      }
      // Refresh wallet after a delay to let the webhook process
      setTimeout(() => void refreshWallet(), 3000);
      return { success: true };
    },
    [],
  );

  const subscribeViaStripe = useCallback(
    async (creatorId: string, _price: number): Promise<{ success: boolean; error?: string }> => {
      const result = await openCheckout({ type: "sub", creator_id: creatorId });
      if (!result.success) {
        return { success: false, error: result.error ?? "Subscription cancelled" };
      }
      // Invalidate subscriptions query to refetch after webhook
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["subscriptions"] }), 3000);
      return { success: true };
    },
    [queryClient],
  );

  const unlockViaStripe = useCallback(
    async (
      episodeId: string,
      price: number,
      creatorId: string,
      streamId?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      const result = await openCheckout({
        type: "ppv",
        amount: price,
        creator_id: creatorId,
        episode_id: streamId ? undefined : episodeId,
        stream_id: streamId,
      });
      if (!result.success) {
        return { success: false, error: result.error ?? "Unlock cancelled" };
      }
      return { success: true };
    },
    [],
  );

  const tipViaStripe = useCallback(
    async (
      creatorId: string,
      amount: number,
      message?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      const result = await openCheckout({
        type: "tip",
        amount,
        creator_id: creatorId,
        message,
      });
      if (!result.success) {
        return { success: false, error: result.error ?? "Tip cancelled" };
      }
      return { success: true };
    },
    [],
  );

  const cancelSubscriptionViaStripe = useCallback(
    async (creatorId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await cancelStripeSub(creatorId);
        void queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
        return { success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Cancel failed";
        return { success: false, error: msg };
      }
    },
    [queryClient],
  );

  // ─── Wallet refresh from server ────────────────────────────────────────────
  const refreshWallet = useCallback(async (): Promise<void> => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("wallet_balance, total_spent")
        .maybeSingle();
      if (data) {
        setState((prev) => ({
          ...prev,
          balance: Number(data.wallet_balance ?? 0),
          totalSpent: Number(data.total_spent ?? 0),
        }));
      }
    } catch (err) {
      console.log("[povme] refreshWallet failed", err);
    }
  }, []);

  // ─── Saves / Likes (delegated to server hooks) ─────────────────────────────
  const toggleSaved = useCallback(
    (episodeId: string) => {
      void savesHook.toggleSave(episodeId);
    },
    [savesHook],
  );

  const toggleLiked = useCallback(
    (episodeId: string) => {
      void likesHook.toggleLike(episodeId);
    },
    [likesHook],
  );

  // ─── Onboarding / profile updates ──────────────────────────────────────────
  const completeOnboarding = useCallback(
    (name: string, interests: PovCategory[], _followed: string[] = []) => {
      setState((prev) => ({
        ...prev,
        onboarded: true,
        displayName: name.trim().length > 0 ? name.trim() : prev.displayName,
        handle: name.trim().length > 0 ? name.trim().toLowerCase().replace(/\s+/g, "") : prev.handle,
        interests,
      }));
    },
    [],
  );

  const becomeCreator = useCallback((price: number) => {
    setState((prev) => ({ ...prev, isCreator: true, creatorPrice: price }));
  }, []);

  const setCreatorPrice = useCallback((price: number) => {
    setState((prev) => ({ ...prev, creatorPrice: price }));
  }, []);

  // ─── Episode publishing (real DB write) ────────────────────────────────────
  const publishEpisode = useCallback(
    async (input: {
      title: string;
      thumb: string;
      access: AccessLevel;
      ppvPrice?: number;
      category: PovCategory;
      status: "published" | "scheduled" | "draft";
      episodeId?: string;
      description?: string;
      chapter?: string;
      scheduledAt?: string | null;
    }): Promise<void> => {
      if (input.episodeId) {
        const update: Record<string, unknown> = {
          status: input.status,
          access: input.access,
          ppv_price: input.access === "ppv" ? (input.ppvPrice ?? null) : null,
          category: input.category,
          title: input.title.trim().slice(0, 120),
        };
        if (input.thumb) update.thumb_url = input.thumb;
        if (input.description) update.description = input.description.trim().slice(0, 500);
        if (input.chapter) update.chapter = input.chapter;
        if (input.status === "published") update.posted_at = new Date().toISOString();
        if (input.status === "scheduled") update.scheduled_at = input.scheduledAt ?? null;

        try {
          const { error } = await supabase
            .from("episodes")
            .update(update)
            .eq("id", input.episodeId);
          if (error) {
            console.log("[povme] publishEpisode DB update failed", error.message);
          }
        } catch (err) {
          console.log("[povme] publishEpisode DB update threw", err);
        }
      }

      void queryClient.invalidateQueries({ queryKey: ["studio-episodes"] });
    },
    [queryClient],
  );

  const deleteStudioEpisode = useCallback(
    async (id: string) => {
      try {
        await supabase.from("episodes").delete().eq("id", id);
      } catch (err) {
        console.log("[povme] deleteStudioEpisode failed", err);
      }
      void queryClient.invalidateQueries({ queryKey: ["studio-episodes"] });
    },
    [queryClient],
  );

  const resetAccount = useCallback(() => {
    setState({ ...DEFAULT_STATE });
  }, []);

  // ─── Creator stats (real, from server) ─────────────────────────────────────
  const creatorStatsQuery = useCreatorStats(user?.id ?? null);
  const creatorStats: CreatorStats = useMemo(
    () =>
      creatorStatsQuery.data ?? {
        grossRevenue: 0,
        netRevenue: 0,
        totalViews: 0,
        subscriberCount: 0,
        totalTips: 0,
        ppvUnlocks: 0,
        episodeCount: 0,
        retention: 0,
        dailyRevenue: [],
      },
    [creatorStatsQuery.data],
  );

  return {
    ...state,
    hydrated,
    kycStatus,
    kycLastReason,
    // Subscriptions from server
    subscriptions: subsQuery.data ?? [],
    activeSubs,
    monthlySpend,
    // Saves / likes from server
    savedEpisodes: Array.from(savesHook.savedIds),
    likedEpisodes: Array.from(likesHook.likedIds),
    // Creator stats from server
    creatorStats,
    // Access helpers (optimistic only — server enforces)
    isSubscribed,
    hasUnlocked,
    hasStreamAccess,
    canWatch,
    // Stripe payments
    subscribeViaStripe,
    cancelSubscriptionViaStripe,
    unlockViaStripe,
    tipViaStripe,
    topUpViaStripe,
    refreshWallet,
    // Saves / likes
    toggleSaved,
    toggleLiked,
    // Onboarding
    completeOnboarding,
    becomeCreator,
    setCreatorPrice,
    // Episodes
    publishEpisode,
    deleteStudioEpisode,
    resetAccount,
  };
});

/** Episodes from creators the user actively subscribes to, newest first. */
export function useSubscribedFeed(episodes: Episode[]): Episode[] {
  const { activeSubs } = useApp();
  return useMemo(() => {
    const ids = new Set(activeSubs.map((s) => s.creatorId));
    return episodes.filter((e) => ids.has(e.creatorId));
  }, [activeSubs, episodes]);
}
