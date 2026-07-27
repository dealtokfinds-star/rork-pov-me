import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CREATORS, EPISODES, STUDIO_EPISODES } from "@/constants/mock-data";
import { openCheckout, cancelSubscription as cancelStripeSub } from "@/lib/payments";
import { supabase } from "@/lib/supabase";
import type {
  AccessLevel,
  Episode,
  PovCategory,
  StudioEpisode,
  Subscription,
  Transaction,
} from "@/types";

const STORAGE_KEY = "povme.state.v1";

interface PersistedState {
  onboarded: boolean;
  isCreator: boolean;
  displayName: string;
  handle: string;
  balance: number;
  subscriptions: Subscription[];
  unlockedEpisodes: string[];
  unlockedStreams: string[];
  savedEpisodes: string[];
  likedEpisodes: string[];
  followedCreators: string[];
  transactions: Transaction[];
  tipTotals: Record<string, number>;
  studio: StudioEpisode[];
  interests: PovCategory[];
  creatorPrice: number;
  payoutConnected: boolean;
  totalSpent: number;
}

const DEFAULT_STATE: PersistedState = {
  onboarded: false,
  isCreator: false,
  displayName: "Brian",
  handle: "brian",
  balance: 120,
  subscriptions: [],
  unlockedEpisodes: [],
  unlockedStreams: [],
  savedEpisodes: [],
  likedEpisodes: [],
  followedCreators: [],
  transactions: [],
  tipTotals: {},
  studio: STUDIO_EPISODES,
  interests: [],
  creatorPrice: 12.99,
  payoutConnected: false,
  totalSpent: 0,
};

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export const [AppProvider, useApp] = createContextHook(() => {
  const [state, setState] = useState<PersistedState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState<boolean>(false);

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
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((error) => {
      console.log("[povme] failed to persist state", error);
    });
  }, [state, hydrated]);

  const pushTransaction = useCallback((tx: Omit<Transaction, "id" | "at">) => {
    setState((prev) => ({
      ...prev,
      transactions: [{ ...tx, id: uid("tx"), at: Date.now() }, ...prev.transactions].slice(0, 60),
    }));
  }, []);

  const isSubscribed = useCallback(
    (creatorId: string): boolean =>
      state.subscriptions.some((s) => s.creatorId === creatorId && s.active),
    [state.subscriptions],
  );

  const hasUnlocked = useCallback(
    (episodeId: string): boolean => state.unlockedEpisodes.includes(episodeId),
    [state.unlockedEpisodes],
  );

  const hasStreamAccess = useCallback(
    (streamId: string): boolean => state.unlockedStreams.includes(streamId),
    [state.unlockedStreams],
  );

  const canWatch = useCallback(
    (episode: Episode): boolean => {
      if (episode.access === "free") return true;
      if (episode.access === "subscribers") return isSubscribed(episode.creatorId);
      return hasUnlocked(episode.id) || false;
    },
    [isSubscribed, hasUnlocked],
  );

  const charge = useCallback(
    (amount: number): boolean => {
      if (state.balance < amount) return false;
      setState((prev) => ({
        ...prev,
        balance: Math.round((prev.balance - amount) * 100) / 100,
        totalSpent: Math.round((prev.totalSpent + amount) * 100) / 100,
      }));
      return true;
    },
    [state.balance],
  );

  const subscribe = useCallback(
    (creatorId: string, price: number): boolean => {
      if (state.balance < price) return false;
      charge(price);
      setState((prev) => ({
        ...prev,
        subscriptions: [
          ...prev.subscriptions.filter((s) => s.creatorId !== creatorId),
          {
            creatorId,
            price,
            startedAt: Date.now(),
            renewsAt: Date.now() + MONTH_MS,
            active: true,
          },
        ],
      }));
      const name = CREATORS.find((c) => c.id === creatorId)?.handle ?? "creator";
      pushTransaction({ kind: "sub", label: `Subscription · @${name}`, amount: price, creatorId });
      return true;
    },
    [state.balance, charge, pushTransaction],
  );

  const cancelSubscription = useCallback((creatorId: string) => {
    setState((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.map((s) =>
        s.creatorId === creatorId ? { ...s, active: false } : s,
      ),
    }));
  }, []);

  const resumeSubscription = useCallback((creatorId: string) => {
    setState((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.map((s) =>
        s.creatorId === creatorId ? { ...s, active: true, renewsAt: Date.now() + MONTH_MS } : s,
      ),
    }));
  }, []);

  const unlockEpisode = useCallback(
    (episodeId: string, price: number): boolean => {
      if (state.balance < price) return false;
      charge(price);
      setState((prev) => ({
        ...prev,
        unlockedEpisodes: [...new Set([...prev.unlockedEpisodes, episodeId])],
      }));
      const ep = EPISODES.find((e) => e.id === episodeId);
      pushTransaction({
        kind: "ppv",
        label: `Unlocked · ${ep?.title ?? "POV episode"}`,
        amount: price,
        creatorId: ep?.creatorId,
      });
      return true;
    },
    [state.balance, charge, pushTransaction],
  );

  const unlockStream = useCallback(
    (streamId: string, price: number, creatorId: string): boolean => {
      if (state.balance < price) return false;
      charge(price);
      setState((prev) => ({
        ...prev,
        unlockedStreams: [...new Set([...prev.unlockedStreams, streamId])],
      }));
      pushTransaction({ kind: "ppv", label: "Unlocked live event", amount: price, creatorId });
      return true;
    },
    [state.balance, charge, pushTransaction],
  );

  const tip = useCallback(
    (creatorId: string, amount: number, label?: string): boolean => {
      if (state.balance < amount) return false;
      charge(amount);
      setState((prev) => ({
        ...prev,
        tipTotals: {
          ...prev.tipTotals,
          [creatorId]: Math.round(((prev.tipTotals[creatorId] ?? 0) + amount) * 100) / 100,
        },
      }));
      const name = CREATORS.find((c) => c.id === creatorId)?.handle ?? "creator";
      pushTransaction({
        kind: label ? "gift" : "tip",
        label: label ? `${label} · @${name}` : `Tip · @${name}`,
        amount,
        creatorId,
      });
      return true;
    },
    [state.balance, charge, pushTransaction],
  );

  const topUp = useCallback(
    (amount: number) => {
      setState((prev) => ({
        ...prev,
        balance: Math.round((prev.balance + amount) * 100) / 100,
      }));
      pushTransaction({ kind: "topup", label: "Added to wallet", amount });
    },
    [pushTransaction],
  );

  /**
   * Real Stripe Checkout — opens a hosted payment page in the system browser.
   * On success, the webhook credits the wallet and the deep-link returns to /payment/success.
   */
  const topUpViaStripe = useCallback(
    async (amount: number): Promise<{ success: boolean; error?: string }> => {
      const result = await openCheckout({ type: "topup", amount });
      if (!result.success) {
        return { success: false, error: result.error ?? "Payment cancelled" };
      }
      // Optimistically show pending state; webhook + refresh will confirm
      pushTransaction({ kind: "topup", label: `Wallet top-up · $${amount} (processing)`, amount });
      return { success: true };
    },
    [pushTransaction],
  );

  /**
   * Real Stripe subscription — opens checkout for a monthly recurring subscription.
   */
  const subscribeViaStripe = useCallback(
    async (creatorId: string, _price: number): Promise<{ success: boolean; error?: string }> => {
      const result = await openCheckout({ type: "sub", creator_id: creatorId });
      if (!result.success) {
        return { success: false, error: result.error ?? "Subscription cancelled" };
      }
      return { success: true };
    },
    [],
  );

  /**
   * Real Stripe PPV unlock — opens checkout for a one-time episode/stream unlock.
   */
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

  /**
   * Real Stripe tip — opens checkout for a one-time tip to a creator.
   */
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

  /**
   * Cancel a subscription via Stripe (cancel_at_period_end).
   */
  const cancelSubscriptionViaStripe = useCallback(
    async (creatorId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await cancelStripeSub(creatorId);
        setState((prev) => ({
          ...prev,
          subscriptions: prev.subscriptions.map((s) =>
            s.creatorId === creatorId ? { ...s, active: false } : s,
          ),
        }));
        return { success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Cancel failed";
        return { success: false, error: msg };
      }
    },
    [],
  );

  /**
   * Refresh wallet balance + transactions from Supabase.
   * Called after a successful Stripe checkout to sync the server state.
   */
  const refreshWallet = useCallback(async (): Promise<void> => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("wallet_balance, total_spent")
        .maybeSingle();
      if (data) {
        setState((prev) => ({
          ...prev,
          balance: Number(data.wallet_balance ?? prev.balance),
          totalSpent: Number(data.total_spent ?? prev.totalSpent),
        }));
      }
    } catch (err) {
      console.log("[povme] refreshWallet failed", err);
    }
  }, []);

  const toggleSaved = useCallback((episodeId: string) => {
    setState((prev) => ({
      ...prev,
      savedEpisodes: prev.savedEpisodes.includes(episodeId)
        ? prev.savedEpisodes.filter((id) => id !== episodeId)
        : [...prev.savedEpisodes, episodeId],
    }));
  }, []);

  const toggleLiked = useCallback((episodeId: string) => {
    setState((prev) => ({
      ...prev,
      likedEpisodes: prev.likedEpisodes.includes(episodeId)
        ? prev.likedEpisodes.filter((id) => id !== episodeId)
        : [...prev.likedEpisodes, episodeId],
    }));
  }, []);

  const completeOnboarding = useCallback(
    (name: string, interests: PovCategory[], followed: string[] = []) => {
      setState((prev) => ({
        ...prev,
        onboarded: true,
        displayName: name.trim().length > 0 ? name.trim() : prev.displayName,
        handle: name.trim().length > 0 ? name.trim().toLowerCase().replace(/\s+/g, "") : prev.handle,
        interests,
        followedCreators: followed,
      }));
    },
    [],
  );

  const toggleFollow = useCallback((creatorId: string) => {
    setState((prev) => ({
      ...prev,
      followedCreators: prev.followedCreators.includes(creatorId)
        ? prev.followedCreators.filter((id) => id !== creatorId)
        : [...prev.followedCreators, creatorId],
    }));
  }, []);

  const becomeCreator = useCallback((price: number) => {
    setState((prev) => ({ ...prev, isCreator: true, creatorPrice: price, payoutConnected: true }));
  }, []);

  const setCreatorPrice = useCallback((price: number) => {
    setState((prev) => ({ ...prev, creatorPrice: price }));
  }, []);

  const publishEpisode = useCallback(
    async (input: {
      title: string;
      thumb: string;
      access: AccessLevel;
      ppvPrice?: number;
      category: PovCategory;
      status: "published" | "scheduled" | "draft";
      /** Real episodes row id (from create-upload-url). When provided, the
       *  publish metadata is written to the `episodes` table via supabase.
       *  Falls back to local-only when absent (e.g. not signed in). */
      episodeId?: string;
      description?: string;
      chapter?: string;
      scheduledAt?: string | null;
    }): Promise<void> => {
      // 1. Real DB write — update the placeholder row with publish metadata.
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

      // 2. Optimistic local update for immediate UI feedback.
      setState((prev) => ({
        ...prev,
        studio: [
          {
            id: input.episodeId ?? uid("s"),
            title: input.title,
            thumb: input.thumb,
            access: input.access,
            ppvPrice: input.ppvPrice,
            status: input.status,
            views: 0,
            earned: 0,
            category: input.category,
            postedAt: input.status === "published" ? "now" : input.status === "scheduled" ? "queued" : "—",
          },
          ...prev.studio.filter((e) => e.id !== input.episodeId),
        ],
      }));
    },
    [],
  );

  const deleteStudioEpisode = useCallback((id: string) => {
    setState((prev) => ({ ...prev, studio: prev.studio.filter((e) => e.id !== id) }));
  }, []);

  const resetAccount = useCallback(() => {
    setState({ ...DEFAULT_STATE, onboarded: true });
  }, []);

  const activeSubs = useMemo(
    () => state.subscriptions.filter((s) => s.active),
    [state.subscriptions],
  );

  const monthlySpend = useMemo(
    () => activeSubs.reduce((sum, s) => sum + s.price, 0),
    [activeSubs],
  );

  const creatorStats = useMemo(() => {
    const published = state.studio.filter((e) => e.status === "published");
    const gross = published.reduce((sum, e) => sum + e.earned, 0) + 2840.5;
    return {
      gross,
      net: gross * 0.8,
      views: published.reduce((sum, e) => sum + e.views, 0) + 41200,
      subs: 1284,
      tips: 962.4,
      ppvUnlocks: 318,
      retention: 0.71,
    };
  }, [state.studio]);

  return {
    ...state,
    hydrated,
    activeSubs,
    monthlySpend,
    creatorStats,
    isSubscribed,
    hasUnlocked,
    hasStreamAccess,
    canWatch,
    subscribe,
    subscribeViaStripe,
    cancelSubscription,
    cancelSubscriptionViaStripe,
    resumeSubscription,
    unlockEpisode,
    unlockViaStripe,
    unlockStream,
    tip,
    tipViaStripe,
    topUp,
    topUpViaStripe,
    refreshWallet,
    toggleSaved,
    toggleLiked,
    toggleFollow,
    completeOnboarding,
    becomeCreator,
    setCreatorPrice,
    publishEpisode,
    deleteStudioEpisode,
    resetAccount,
  };
});

/** Episodes from creators the user actively subscribes to, newest first. */
export function useSubscribedFeed(): Episode[] {
  const { activeSubs } = useApp();
  return useMemo(() => {
    const ids = new Set(activeSubs.map((s) => s.creatorId));
    return EPISODES.filter((e) => ids.has(e.creatorId));
  }, [activeSubs]);
}
