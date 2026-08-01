import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/lib/supabase";

/**
 * useLiveNow
 * ----------
 * Keeps every "LIVE" badge in the app truthful in real time.
 *
 * Subscribes to Postgres changes on `live_streams` (INSERT / UPDATE / DELETE —
 * the table is in the `supabase_realtime` publication). Whenever a stream
 * starts, ends, or changes viewer counts, the creators/streams queries are
 * invalidated so `CreatorCard`, `CreatorRow`, `Avatar(live)`, and the live tab
 * re-render with fresh `isLive` state — no pull-to-refresh needed.
 *
 * Mount once (tabs layout). Debounced so a burst of updates (viewer counter
 * ticking) causes at most one refetch per second.
 */
export function useLiveNow(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const invalidate = (): void => {
      if (debounce) return;
      debounce = setTimeout(() => {
        debounce = null;
        void queryClient.invalidateQueries({ queryKey: ["creators"] });
        void queryClient.invalidateQueries({ queryKey: ["streams"] });
        void queryClient.invalidateQueries({ queryKey: ["stream"] });
        void queryClient.invalidateQueries({ queryKey: ["creator"] });
      }, 1000);
    };

    const channel = supabase
      .channel("live-now")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_streams" },
        () => invalidate(),
      )
      .subscribe();

    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
