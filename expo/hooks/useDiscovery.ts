import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { getValidAccessToken } from "@/lib/token";
import type { Category, Creator, PovCategory } from "@/types";

/**
 * Discovery layer — full-text search, recommendations, and category management.
 *
 * - `useSearch` — Postgres FTS over creator profiles (via /search edge function)
 * - `useRecommendations` — trending / rising / for-you ranking (via /recommend)
 * - `useCategories` — admin-curated category list (public read)
 * - `useAdminCategories` — admin CRUD for categories
 */

const FN_BASE = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getValidAccessToken();
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// ─── Search ────────────────────────────────────────────────────────────────

export type SearchSort = "relevance" | "subs" | "new" | "price";

interface SearchItem {
  id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  identity: string | null;
  location: string | null;
  categories: string[];
  verified: boolean;
  sub_price: number;
  is_live: boolean;
  subscribers: number;
  episodes: number;
}

function mapSearchToCreator(item: SearchItem): Creator {
  return {
    id: item.id,
    handle: item.handle,
    name: item.name,
    avatar: item.avatar_url ?? "",
    cover: item.cover_url ?? item.avatar_url ?? "",
    bio: item.bio ?? "",
    identity: item.identity ?? "",
    location: item.location ?? "",
    categories: (item.categories ?? []) as PovCategory[],
    subPrice: item.sub_price ?? 9.99,
    subscribers: item.subscribers ?? 0,
    episodes: item.episodes ?? 0,
    verified: item.verified,
    isLive: item.is_live,
    rating: 4.8,
    socialLinks: {},
  };
}

export function useSearch(
  query: string,
  opts?: { category?: PovCategory | "all"; sort?: SearchSort; limit?: number },
) {
  const category = opts?.category && opts.category !== "all" ? opts.category : undefined;
  const sort = opts?.sort ?? "relevance";
  const limit = opts?.limit ?? 20;
  return useQuery<Creator[]>({
    queryKey: ["search", query, category ?? "all", sort, limit],
    queryFn: async () => {
      const q = query.trim();
      if (!q) return [];
      const headers = await authHeaders();
      const url = new URL(`${FN_BASE}/search`);
      url.searchParams.set("q", q);
      if (category) url.searchParams.set("category", category);
      url.searchParams.set("sort", sort);
      url.searchParams.set("limit", String(limit));
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const data = (await res.json()) as { items: SearchItem[] };
      return data.items.map(mapSearchToCreator);
    },
    enabled: query.trim().length > 0,
    staleTime: 30_000,
  });
}

// ─── Recommendations ───────────────────────────────────────────────────────

export type RecommendMode = "trending" | "rising" | "foryou";

interface RecommendItem extends SearchItem {
  score: number;
  category_match: number;
}

export function useRecommendations(
  mode: RecommendMode,
  opts?: { category?: PovCategory | "all"; limit?: number },
) {
  const category = opts?.category && opts.category !== "all" ? opts.category : undefined;
  const limit = opts?.limit ?? 20;
  return useQuery<Creator[]>({
    queryKey: ["recommend", mode, category ?? "all", limit],
    queryFn: async () => {
      const headers = await authHeaders();
      const url = new URL(`${FN_BASE}/recommend`);
      url.searchParams.set("mode", mode);
      if (category) url.searchParams.set("category", category);
      url.searchParams.set("limit", String(limit));
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Recommendations failed: ${res.status}`);
      const data = (await res.json()) as { items: RecommendItem[] };
      return data.items.map((item) => ({
        ...mapSearchToCreator(item),
        rating: 4.8,
      }));
    },
    staleTime: 60_000,
  });
}

// ─── Categories ─────────────────────────────────────────────────────────────

type CategoryRow = {
  id: string;
  label: string;
  tagline: string;
  emoji: string;
  accent: string;
  sort_order: number;
  is_active: boolean;
};

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id as PovCategory,
    label: row.label,
    tagline: row.tagline,
    emoji: row.emoji,
    accent: row.accent,
  };
}

async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, label, tagline, emoji, accent, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[povme] fetchCategories:", error.message);
    throw error;
  }
  return (data ?? []).map(mapCategory);
}

/** Public, admin-curated category list (active only, ordered by sort_order). */
export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });
}

// ─── Admin category management ──────────────────────────────────────────────

export interface CategoryInput {
  id: string;
  label: string;
  tagline: string;
  emoji: string;
  accent: string;
  sort_order: number;
  is_active: boolean;
}

/** Admin-only CRUD for categories. Returns mutation helpers that invalidate the public list. */
export function useAdminCategories() {
  const queryClient = useQueryClient();

  const upsert = useMutation({
    mutationFn: async (input: CategoryInput) => {
      const { data, error } = await supabase
        .from("categories")
        .upsert({
          id: input.id,
          label: input.label,
          tagline: input.tagline,
          emoji: input.emoji,
          accent: input.accent,
          sort_order: input.sort_order,
          is_active: input.is_active,
        })
        .select("id, label, tagline, emoji, accent, sort_order, is_active")
        .maybeSingle();
      if (error) throw error;
      return mapCategory(data as CategoryRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("categories")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, idx) =>
        supabase.from("categories").update({ sort_order: idx + 1 }).eq("id", id),
      );
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error);
      if (err) throw err.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  return {
    upsertCategory: upsert.mutateAsync,
    isUpserting: upsert.isPending,
    toggleCategory: toggle.mutateAsync,
    isToggling: toggle.isPending,
    deleteCategory: remove.mutateAsync,
    isDeleting: remove.isPending,
    reorderCategories: reorder.mutateAsync,
    isReordering: reorder.isPending,
  };
}
