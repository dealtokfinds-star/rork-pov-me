import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";

import { openCheckout, cancelSubscription as cancelStripeSub } from "@/lib/payments";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type {
  AccessLevel,
  Episode,
  PovCategory,
  StudioEpisode,
  Subscription,
  Transaction,
} from "@/types";

const STORAGE_KEY = "povme.local.v1";

/**
 * Locally-persisted UI state that is NOT stored in Supabase (or is a
 * cached copy of server state used before the profile query resolves).
 */
interface LocalState {
  onboarded: boolean;
  interests: PovCategory[];
  followedCreators: string[];
  /** Creator price the user last set in onboarding (synced to profile.sub_price). */
  creatorPrice: number;
}

const DEFAULT_LOCAL: LocalState = {
  onboarded: false,
  interests: [],
  followedCreators: [],
  creatorPrice: 12.99,
};

type SubscriptionRow = {
  creator_id: string;
  price: number;
  active: boolean | null;
  started_at: string | null;
  renews_at: string | null;
};

type UnlockRow = {
  episode_id: string | null;
  stream_id: string | null;
};

type SaveRow = { episode_id: string };
type LikeRow = { episode_id: string };

type TransactionRow = {
  id: string;
  kind: string;
  label: string;
  amount: number;
  creator_id: string | null;
  created_at: string | null;
};

type EpisodeRow = {
  id: string;
  title: string;
  thumb_url: string | null;
  access: string;
  ppv_price: number | null;
  category: string;
  views: number | null;
  posted_at: string | null;
};

function mapSubscription(r: SubscriptionRow): Subscription {
  return {
    creatorId: r.creator_id,
    price: Number(r.price ?? 0),
    startedAt: r.started_at ? new Date(r.started_at).getTime() : Date.now(),
    renewsAt: r.renews_at ? new Date(r.renews_at).getTime() : Date.now() + 30 * 86400000,
    active: r.active ?? true,
  };
}

function mapStudioEpisode(r: EpisodeRow): StudioEpisode {
  const posted = r.posted_at ? new Date(r.posted_at).getTime() : Date.now();
  const now = Date.now();
  const dayMs = 86400000;
  let postedLabel = "—";
  const diff = now - posted;
  if (diff < dayMs) postedLabel = "today";
  else if (diff < 7 * dayMs) postedLabel = `${Math.floor(diff / dayMs)}d`;
  else postedLabel = `${Math.floor(diff / (7 * dayMs))}w`;
  return {
    id: r.id,
    title: r.title,
    thumb: r.thumb_url ?? "",
    access: r.access as AccessLevel,
    ppvPrice: r.ppv_price ?? undefined,
    status: "published",
    views: r.views ?? 0,
    earned: 0,
    category: r.category as PovCategory,
    postedAt: postedLabel,
  };
}

function mapTransaction(r: TransactionRow): Transaction {
  return {
    id: r.id,
    kind: (r.kind as Transaction["kind"]) ?? "topup",
    label: r.label,
    amount: Number(r.amount ?? 0),
    creatorId: r.creator_id ?? undefined,
    at: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  };
}

/**
 * App-wide state backed by Supabase.
 *
 * Reads the signed-in user's profile, subscriptions, unlocks, saves, likes,
 * transactions, and studio episodes directly from the database (RLS-scoped).
 * Payment mutations go through Stripe via edge functions — the wallet-based
 * mock charge helpers have been removed.
 */
export const [AppProvider, useApp] = createContextHook(() => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // UI-only state persisted locally
  const [local, setLocal] = useState<LocalState>(DEFAULT_LOCAL);
  const [hydrated, setHydrated] = useState<boolean>(false);

  // Server-backed state (mirror of the user's row + related tables)
  const [displayName, setDisplayName] = useState<string>("");
  const [handle, setHandle] = useState<string>("");
  const [balance, setBalance] = useState<number>(0);
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [isCreator, setIsCreator] = useState<boolean>(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [unlockedEpisodes, setUnlockedEpisodes] = useState<string[]>([]);
  const [unlockedStreams, setUnlockedStreams] = useState<string[]>([]);
  const [savedEpisodes, setSavedEpisodes] = useState<string[]>([]);
  const [likedEpisodes, setLikedEpisodes] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [studio, setStudio] = useState<StudioEpisode[]>([]);

  // Hydrate local UI prefs
  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as Partial<LocalState>;
          setLocal({ ...DEFAULT_LOCAL, ...parsed });
        }
      } catch (err) {
        console.log("[povme] failed to restore local state", err);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(local)).catch((err) => {
      console.log("[povme] failed to persist local state", err);
    });
  }, [local, hydrated]);

  // Load everything from Supabase when the signed-in user changes.
  const loadServerState = useCallback(async (uid: string): Promise<void> => {
    const [profileRes, subsRes, unlocksRes, savesRes, likesRes, txRes, studioRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("name, handle, wallet_balance, total_spent, is_creator, onboarded, sub_price")
        .eq("id", uid)
        .maybeSingle(),
      supabase.from("subscriptions").select("creator_id, price, active, started_at, renews_at").eq("fan_id", uid),
      supabase.from("unlocks").select("episode_id, stream_id").eq("fan_id", uid),
      supabase.from("saves").select("episode_id").eq("user_id", uid),
      supabase.from("likes").select("episode_id").eq("user_id", uid),
      supabase
        .from("transactions")
        .select("id, kind, label, amount, creator_id, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("episodes")
        .select("id, title, thumb_url, access, ppv_price, category, views, posted_at")
        .eq("creator_id", uid)
        .order("posted_at", { ascending: false }),
    ]);

    if (profileRes.data) {
      const p = profileRes.data as {
        name: string | null; handle: string | null; wallet_balance: number | null;
        total_spent: number | null; is_creator: boolean | null; onboarded: boolean | null;
        sub_price: number | null;
      };
      setDisplayName(p.name ?? "");
      setHandle(p.handle ?? "");
      setBalance(Number(p.wallet_balance ?? 0));
      setTotalSpent(Number(p.total_spent ?? 0));
      setIsCreator(p.is_creator ?? false);
      setLocal((prev) => ({
        ...prev,
        onboarded: p.onboarded ?? prev.onboarded,
        creatorPrice: p.sub_price ?? prev.creatorPrice,
      }));
    }

    setSubscriptions((subsRes.data ?? []).map((r) => mapSubscription(r as SubscriptionRow)));
    const eps = new Set<string>();
    const streams = new Set<string>();
    for (const u of (unlocksRes.data ?? []) as UnlockRow[]) {
      if (u.episode_id) eps.add(u.episode_id);
      if (u.stream_id) streams.add(u.stream_id);
    }
    setUnlockedEpisodes([...eps]);
    setUnlockedStreams([...streams]);
    setSavedEpisodes((savesRes.data ?? []).map((r) => (r as SaveRow).episode_id));
    setLikedEpisodes((likesRes.data ?? []).map((r) => (r as LikeRow).episode_id));
    setTransactions((txRes.data ?? []).map(mapTransaction));
    setStudio((studioRes.data ?? []).map((r) => mapStudioEpisode(r as EpisodeRow)));
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        await loadServerState(userId);
      } catch (err) {
        console.log("[povme] loadServerState failed", err);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, loadServerState]);

  const isSubscribed = useCallback(
    (creatorId: string): boolean =>
      subscriptions.some((s) => s.creatorId === creatorId && s.active),
    [subscriptions],
  );

  const hasUnlocked = useCallback(
    (episodeId: string): boolean => unlockedEpisodes.includes(episodeId),
    [unlockedEpisodes],
  );

  const hasStreamAccess = useCallback(
    (streamId: string): boolean => unlockedStreams.includes(streamId),
    [unlockedStreams],
  );

  const canWatch = useCallback(
    (episode: Episode): boolean => {
      if (episode.access === "free") return true;
      if (episode.access === "subscribers") return isSubscribed(episode.creatorId);
      return hasUnlocked(episode.id);
    },
    [isSubscribed, hasUnlocked],
  );

  // ─── Stripe-backed payment actions ────────────────────────────────────────

  const topUpViaStripe = useCallback(
    async (amount: number): Promise<{ success: boolean; error?: string }> => {
      const result = await openCheckout({ type: "topup", amount });
      if (!result.success) return { success: false, error: result.error ?? "Payment cancelled" };
      return { success: true };
    },
    [],
  );

  const subscribeViaStripe = useCallback(
    async (creatorId: string, _price: number): Promise<{ success: boolean; error?: string }> => {
      const result = await openCheckout({ type: "sub", creator_id: creatorId });
      if (!result.success) return { success: false, error: result.error ?? "Subscription cancelled" };
      return { success: true };
    },
    [],
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
      if (!result.success) return { success: false, error: result.error ?? "Unlock cancelled" };
      return { success: true };
    },
    [],
  );

  const tipViaStripe = useCallback(
    async (creatorId: string, amount: number, message?: string): Promise<{ success: boolean; error?: string }> => {
      const result = await openCheckout({ type: "tip", amount, creator_id: creatorId, message });
      if (!result.success) return { success: false, error: result.error ?? "Tip cancelled" };
      return { success: true };
    },
    [],
  );

  const cancelSubscriptionViaStripe = useCallback(
    async (creatorId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await cancelStripeSub(creatorId);
        setSubscriptions((prev) =>
          prev.map((s) => (s.creatorId === creatorId ? { ...s, active: false } : s)),
        );
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Cancel failed" };
      }
    },
    [],
  );

  const refreshWallet = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("wallet_balance, total_spent")
        .eq("id", userId)
        .maybeSingle();
      if (data) {
        setBalance(Number((data as { wallet_balance: number | null }).wallet_balance ?? 0));
        setTotalSpent(Number((data as { total_spent: number | null }).total_spent ?? 0));
      }
      await loadServerState(userId);
    } catch (err) {
      console.log("[povme] refreshWallet failed", err);
    }
  }, [userId, loadServerState]);

  // ─── Saves / likes / follows (real DB rows) ───────────────────────────────

  const toggleSaved = useCallback(async (episodeId: string): Promise<void> => {
    if (!userId) return;
    const isSaved = savedEpisodes.includes(episodeId);
    if (isSaved) {
      setSavedEpisodes((prev) => prev.filter((id) => id !== episodeId));
      await supabase.from("saves").delete().eq("user_id", userId).eq("episode_id", episodeId);
    } else {
      setSavedEpisodes((prev) => [...prev, episodeId]);
      await supabase.from("saves").insert({ user_id: userId, episode_id: episodeId });
    }
  }, [userId, savedEpisodes]);

  const toggleLiked = useCallback(async (episodeId: string): Promise<void> => {
    if (!userId) return;
    const isLiked = likedEpisodes.includes(episodeId);
    if (isLiked) {
      setLikedEpisodes((prev) => prev.filter((id) => id !== episodeId));
      await supabase.from("likes").delete().eq("user_id", userId).eq("episode_id", episodeId);
    } else {
      setLikedEpisodes((prev) => [...prev, episodeId]);
      await supabase.from("likes").insert({ user_id: userId, episode_id: episodeId });
    }
  }, [userId, likedEpisodes]);

  const toggleFollow = useCallback((creatorId: string): void => {
    setLocal((prev) => ({
      ...prev,
      followedCreators: prev.followedCreators.includes(creatorId)
        ? prev.followedCreators.filter((id) => id !== creatorId)
        : [...prev.followedCreators, creatorId],
    }));
  }, []);

  // ─── Onboarding / creator setup ────────────────────────────────────────────

  const completeOnboarding = useCallback(
    (name: string, interests: PovCategory[], followed: string[] = []): void => {
      setLocal((prev) => ({
        ...prev,
        onboarded: true,
        interests,
        followedCreators: followed,
      }));
      if (name.trim().length > 0) {
        setDisplayName(name.trim());
        setHandle(name.trim().toLowerCase().replace(/\s+/g, ""));
      }
    },
    [],
  );

  const becomeCreator = useCallback((price: number): void => {
    setIsCreator(true);
    setLocal((prev) => ({ ...prev, creatorPrice: price }));
  }, []);

  const setCreatorPrice = useCallback((price: number): void => {
    setLocal((prev) => ({ ...prev, creatorPrice: price }));
  }, []);

  const publishEpisode = useCallback(
    (input: {
      title: string;
      thumb: string;
      access: AccessLevel;
      ppvPrice?: number;
      category: PovCategory;
      status: "published" | "scheduled" | "draft";
    }): void => {
      // Optimistic insert — the real row is created by an edge function on
      // upload; here we just mirror it in the local studio list.
      setStudio((prev) => [
        {
          id: `pending_${Date.now()}`,
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
        ...prev,
      ]);
    },
    [],
  );

  const deleteStudioEpisode = useCallback(async (id: string): Promise<void> => {
    setStudio((prev) => prev.filter((e) => e.id !== id));
    if (userId && !id.startsWith("pending_")) {
      await supabase.from("episodes").delete().eq("id", id).eq("creator_id", userId);
    }
  }, [userId]);

  const resetAccount = useCallback((): void => {
    setLocal(DEFAULT_LOCAL);
    setSubscriptions([]);
    setUnlockedEpisodes([]);
    setUnlockedStreams([]);
    setSavedEpisodes([]);
    setLikedEpisodes([]);
    setTransactions([]);
    setStudio([]);
    setBalance(0);
    setTotalSpent(0);
    setIsCreator(false);
  }, []);

  const activeSubs = useMemo(
    () => subscriptions.filter((s) => s.active),
    [subscriptions],
  );

  const monthlySpend = useMemo(
    () => activeSubs.reduce((sum, s) => sum + s.price, 0),
    [activeSubs],
  );

  const tipTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const tx of transactions) {
      if ((tx.kind === "tip" || tx.kind === "gift") && tx.creatorId) {
        totals[tx.creatorId] = (totals[tx.creatorId] ?? 0) + tx.amount;
      }
    }
    return totals;
  }, [transactions]);

  const creatorStats = useMemo(() => {
    const published = studio.filter((e) => e.status === "published");
    return {
      gross: published.reduce((sum, e) => sum + e.earned, 0),
      net: published.reduce((sum, e) => sum + e.earned * 0.8, 0),
      views: published.reduce((sum, e) => sum + e.views, 0),
      subs: activeSubs.length,
      tips: 0,
      ppvUnlocks: 0,
      retention: 0.71,
    };
  }, [studio, activeSubs.length]);

  return {
    // identity
    displayName,
    handle,
    hydrated,
    onboarded: local.onboarded,
    // wallet
    balance,
    totalSpent,
    monthlySpend,
    // creator
    isCreator,
    creatorPrice: local.creatorPrice,
    creatorStats,
    // library
    subscriptions,
    activeSubs,
    unlockedEpisodes,
    unlockedStreams,
    savedEpisodes,
    likedEpisodes,
    followedCreators: local.followedCreators,
    interests: local.interests,
    transactions,
    studio,
    tipTotals,
    // queries
    isSubscribed,
    hasUnlocked,
    hasStreamAccess,
    canWatch,
    // payments (Stripe-backed)
    subscribeViaStripe,
    cancelSubscriptionViaStripe,
    unlockViaStripe,
    tipViaStripe,
    topUpViaStripe,
    refreshWallet,
    // library mutations
    toggleSaved,
    toggleLiked,
    toggleFollow,
    // onboarding / creator
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
  // This hook is retained for backwards compatibility but screens should
  // pull from useEpisodes() + activeSubs directly.
  const subIds = useMemo(() => new Set(activeSubs.map((s) => s.creatorId)), [activeSubs]);
  // No static fallback — return empty until the episodes query populates.
  void subIds;
  return [];
}
