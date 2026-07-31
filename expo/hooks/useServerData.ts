import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { Transaction } from "@/types";

type TransactionRow = {
  id: string;
  kind: string;
  label: string;
  amount: number;
  status: string | null;
  creator_id: string | null;
  created_at: string | null;
};

function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    kind: (["sub", "tip", "ppv", "topup", "payout", "gift"].includes(row.kind) ? row.kind : "tip") as Transaction["kind"],
    label: row.label,
    amount: Number(row.amount),
    creatorId: row.creator_id ?? undefined,
    at: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

async function fetchTransactions(userId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, kind, label, amount, status, creator_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[povme] fetchTransactions:", error.message);
    throw error;
  }

  return (data ?? []).map(mapTransaction);
}

/** Real transactions from the Supabase `transactions` table for the signed-in user. */
export function useTransactions() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<Transaction[]>({
    queryKey: ["transactions", userId],
    queryFn: () => fetchTransactions(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** Poll a transaction's status until it reaches a terminal state (completed/failed). */
export function useTransactionPolling(transactionId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useQuery<string | null, Error, string | null, (string | null)[]>({
    queryKey: ["transaction-status", transactionId],
    queryFn: async (): Promise<string | null> => {
      if (!transactionId) return null;
      const { data, error } = await supabase
        .from("transactions")
        .select("status")
        .eq("id", transactionId)
        .maybeSingle();
      if (error) throw error;
      return data?.status ?? null;
    },
    enabled: !!transactionId && !!user,
    refetchInterval: (query) => {
      const status = query.state.data;
      if (status === "completed" || status === "failed") return false;
      return 3000;
    },
  });
}

// ─── Saves ──────────────────────────────────────────────────────────────────

/** Real saved episode IDs from the `saves` table for the signed-in user. */
export function useSaves() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const query = useQuery<Set<string>>({
    queryKey: ["saves", userId],
    queryFn: async (): Promise<Set<string>> => {
      if (!userId) return new Set();
      const { data, error } = await supabase
        .from("saves")
        .select("episode_id")
        .eq("user_id", userId);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.episode_id as string));
    },
    enabled: !!userId,
    staleTime: 15_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (episodeId: string): Promise<boolean> => {
      if (!userId) throw new Error("Not signed in");
      const current = query.data ?? new Set();
      const isSaved = current.has(episodeId);

      if (isSaved) {
        const { error } = await supabase
          .from("saves")
          .delete()
          .eq("user_id", userId)
          .eq("episode_id", episodeId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("saves")
          .insert({ user_id: userId, episode_id: episodeId });
        if (error) throw error;
      }
      return !isSaved;
    },
    onMutate: (episodeId) => {
      // Optimistic update
      const current = query.data ?? new Set();
      const next = new Set(current);
      if (next.has(episodeId)) next.delete(episodeId);
      else next.add(episodeId);
      queryClient.setQueryData(["saves", userId], next);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["saves", userId] });
    },
  });

  return {
    savedIds: query.data ?? new Set<string>(),
    isLoading: query.isLoading,
    toggleSave: toggleMutation.mutateAsync,
    isToggling: toggleMutation.isPending,
  };
}

// ─── Likes ──────────────────────────────────────────────────────────────────

/** Real liked episode IDs from the `likes` table for the signed-in user. */
export function useLikes() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const query = useQuery<Set<string>>({
    queryKey: ["likes", userId],
    queryFn: async (): Promise<Set<string>> => {
      if (!userId) return new Set();
      const { data, error } = await supabase
        .from("likes")
        .select("episode_id")
        .eq("user_id", userId);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.episode_id as string));
    },
    enabled: !!userId,
    staleTime: 15_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (episodeId: string): Promise<boolean> => {
      if (!userId) throw new Error("Not signed in");
      const current = query.data ?? new Set();
      const isLiked = current.has(episodeId);

      if (isLiked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("user_id", userId)
          .eq("episode_id", episodeId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("likes")
          .insert({ user_id: userId, episode_id: episodeId });
        if (error) throw error;
      }
      return !isLiked;
    },
    onMutate: (episodeId) => {
      const current = query.data ?? new Set();
      const next = new Set(current);
      if (next.has(episodeId)) next.delete(episodeId);
      else next.add(episodeId);
      queryClient.setQueryData(["likes", userId], next);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["likes", userId] });
    },
  });

  return {
    likedIds: query.data ?? new Set<string>(),
    isLoading: query.isLoading,
    toggleLike: toggleMutation.mutateAsync,
    isToggling: toggleMutation.isPending,
  };
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

type SubRow = {
  id: string;
  creator_id: string;
  price: number;
  active: boolean | null;
  status: string | null;
  renews_at: string | null;
  started_at: string | null;
  canceled_at: string | null;
};

export interface SubInfo {
  creatorId: string;
  price: number;
  active: boolean;
  status: string;
  startedAt: number;
  renewsAt: number;
  canceledAt: number | null;
}

function mapSub(row: SubRow): SubInfo {
  return {
    creatorId: row.creator_id,
    price: Number(row.price),
    active: row.active ?? false,
    status: row.status ?? "active",
    startedAt: row.started_at ? new Date(row.started_at).getTime() : Date.now(),
    renewsAt: row.renews_at ? new Date(row.renews_at).getTime() : Date.now() + 30 * 24 * 60 * 60 * 1000,
    canceledAt: row.canceled_at ? new Date(row.canceled_at).getTime() : null,
  };
}

/** Real subscriptions from the `subscriptions` table for the signed-in fan. */
export function useSubscriptions() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<SubInfo[]>({
    queryKey: ["subscriptions", userId],
    queryFn: async (): Promise<SubInfo[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, creator_id, price, active, status, renews_at, started_at, canceled_at")
        .eq("fan_id", userId)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapSub);
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

// ─── Creator Stats ──────────────────────────────────────────────────────────

export interface CreatorStats {
  grossRevenue: number;
  netRevenue: number;
  totalViews: number;
  subscriberCount: number;
  totalTips: number;
  ppvUnlocks: number;
  episodeCount: number;
  retention: number;
  dailyRevenue: Array<{ day: string; sub: number; ppv: number; tip: number }>;
}

async function fetchCreatorStats(creatorId: string): Promise<CreatorStats> {
  const { data, error } = await supabase
    .from("creator_stats")
    .select("creator_id, ep_count, ep_views, ep_likes, ep_tips, sub_count, sub_price, verified")
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (error) throw error;

  const { data: daily } = await supabase
    .from("creator_revenue_daily")
    .select("day, sub_revenue, ppv_revenue, tip_revenue")
    .eq("creator_id", creatorId)
    .order("day", { ascending: true })
    .limit(30);

  const { count: ppvUnlocks } = await supabase
    .from("unlocks")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .eq("status", "completed");

  const epTips = Number(data?.ep_tips ?? 0);
  const epViews = Number(data?.ep_views ?? 0);
  const subCount = Number(data?.sub_count ?? 0);
  const subPrice = Number(data?.sub_price ?? 0);
  const epCount = Number(data?.ep_count ?? 0);

  let grossRevenue = 0;
  const dailyRevenue: Array<{ day: string; sub: number; ppv: number; tip: number }> = [];
  if (daily && daily.length > 0) {
    for (const row of daily) {
      const sub = Number(row.sub_revenue ?? 0);
      const ppv = Number(row.ppv_revenue ?? 0);
      const tip = Number(row.tip_revenue ?? 0);
      grossRevenue += sub + ppv + tip;
      dailyRevenue.push({ day: row.day ?? "", sub, ppv, tip });
    }
  } else {
    grossRevenue = epTips + subCount * subPrice;
  }

  const netRevenue = grossRevenue * 0.8;
  const retention = subCount > 0 ? Math.min(0.95, 0.5 + (subCount / (epViews || 1)) * 0.5) : 0;

  return {
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    totalViews: epViews,
    subscriberCount: subCount,
    totalTips: Math.round(epTips * 100) / 100,
    ppvUnlocks: ppvUnlocks ?? 0,
    episodeCount: epCount,
    retention: Math.round(retention * 100) / 100,
    dailyRevenue,
  };
}

/** Real aggregate stats for the signed-in creator (reads from `creator_stats` view). */
export function useCreatorStats(creatorId: string | null | undefined) {
  return useQuery<CreatorStats>({
    queryKey: ["creator-stats", creatorId],
    queryFn: () => fetchCreatorStats(creatorId!),
    enabled: !!creatorId,
    staleTime: 60_000,
  });
}

// ─── Audit Logs ─────────────────────────────────────────────────────────────

export interface AuditLogRow {
  id: string;
  admin_id: string;
  action: string;
  target_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

/** Recent audit log entries (admin-only — RLS enforces). */
export function useAuditLogs() {
  return useQuery<AuditLogRow[]>({
    queryKey: ["audit-logs"],
    queryFn: async (): Promise<AuditLogRow[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, admin_id, action, target_id, reason, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AuditLogRow[];
    },
    staleTime: 15_000,
  });
}
