import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useCreators } from "@/lib/data";
import type { Creator } from "@/types";

/**
 * Resolve creators by id from the React Query cache.
 *
 * Cards and detail screens used to call `creatorById(id)` against a static
 * mock array. This hook returns a `Map<string, Creator>` built from the real
 * `useCreators()` query, so any screen that already participates in the
 * creators query can resolve a creator without triggering an extra fetch.
 *
 * Returns a `get(id)` helper that yields `undefined` while the list is still
 * loading or the creator isn't in the cache.
 */
export function useCreatorMap() {
  const { data: creators } = useCreators();
  const map = useMemo(() => {
    const m = new Map<string, Creator>();
    for (const c of creators ?? []) m.set(c.id, c);
    return m;
  }, [creators]);
  return {
    map,
    get: (id: string | undefined | null): Creator | undefined =>
      id ? map.get(id) : undefined,
  };
}

/**
 * Resolve a single creator by id, preferring the React Query cache and
 * falling back to a targeted lookup if the list hasn't loaded yet.
 */
export function useCreatorById(id: string | undefined | null) {
  const { get } = useCreatorMap();
  return id ? get(id) : undefined;
}

/**
 * Build a creator lookup map from any cached creators query data without
 * subscribing to the query (useful inside non-React contexts).
 */
export function readCreatorMap(queryClient: ReturnType<typeof useQueryClient>): Map<string, Creator> {
  const data = queryClient.getQueryData<Creator[]>(["creators"]);
  const m = new Map<string, Creator>();
  for (const c of data ?? []) m.set(c.id, c);
  return m;
}
