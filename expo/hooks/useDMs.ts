import { useEffect, useRef, useState, useCallback } from "react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { callEdge } from "@/lib/edge";

/**
 * Direct messages — realtime threads between fans and creators.
 *
 * - Loads the user's dm_threads (where they are creator or fan)
 * - For a given thread, loads dm_messages and subscribes to INSERTs
 * - sendMessage() calls the dm-send edge function (creates/reuses thread,
 *   bumps unread, sends push to recipient)
 * - Paid DMs: creator can send a message with is_paid=true + price; the
 *   recipient sees a locked preview and unlocks via Stripe checkout
 */

export interface DmThreadRow {
  id: string;
  creator_id: string;
  fan_id: string;
  last_message_at: string | null;
  creator_unread_count: number;
  fan_unread_count: number;
  created_at: string | null;
}

export interface DmMessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  text: string | null;
  is_paid: boolean;
  price: number;
  unlocked_by_recipient: boolean;
  attachment_url: string | null;
  created_at: string | null;
}

export interface DmThreadWithProfile extends DmThreadRow {
  other_name: string | null;
  other_avatar: string | null;
  other_handle: string | null;
  last_text: string | null;
  last_is_paid: boolean | null;
  last_price: number | null;
  last_sender_id: string | null;
}

/** List all DM threads for the signed-in user, with the other party's profile info. */
export function useDmThreads() {
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const [threads, setThreads] = useState<DmThreadWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadThreads = useCallback(async () => {
    // Get threads where user is creator or fan. RLS enforces this.
    const { data, error } = await supabase
      .from("dm_threads")
      .select("*")
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("[povme] useDmThreads load:", error.message);
      setIsLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setThreads([]);
      setIsLoading(false);
      return;
    }

    // Fetch the latest message for each thread + the other party's profile
    const otherIds = data.map((t: DmThreadRow) => t.creator_id).concat(data.map((t: DmThreadRow) => t.fan_id));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, handle, avatar_url")
      .in("id", otherIds);

    const profileMap = new Map<string, { name: string | null; handle: string | null; avatar_url: string | null }>();
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { name: p.name, handle: p.handle, avatar_url: p.avatar_url });
    }

    // Fetch last messages in batch
    const threadIds = data.map((t: DmThreadRow) => t.id);
    const { data: lastMsgs } = await supabase
      .from("dm_messages")
      .select("thread_id, sender_id, text, is_paid, price, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false });

    const lastMsgMap = new Map<string, DmMessageRow>();
    for (const m of lastMsgs ?? []) {
      if (!lastMsgMap.has(m.thread_id)) {
        lastMsgMap.set(m.thread_id, m as DmMessageRow);
      }
    }

    // The "other" party is whichever side of the thread isn't the signed-in
    // user — a creator sees the fan, a fan sees the creator.
    const enriched: DmThreadWithProfile[] = data.map((t: DmThreadRow) => {
      const otherId = myId && t.creator_id === myId ? t.fan_id : t.creator_id;
      const otherP = profileMap.get(otherId);
      return {
        ...t,
        other_name: otherP?.name ?? null,
        other_avatar: otherP?.avatar_url ?? null,
        other_handle: otherP?.handle ?? null,
        last_text: lastMsgMap.get(t.id)?.text ?? null,
        last_is_paid: lastMsgMap.get(t.id)?.is_paid ?? null,
        last_price: lastMsgMap.get(t.id)?.price ?? null,
        last_sender_id: lastMsgMap.get(t.id)?.sender_id ?? null,
      };
    });

    setThreads(enriched);
    setIsLoading(false);
  }, [myId]);

  useEffect(() => {
    loadThreads();

    // Subscribe to thread changes (new threads, updated last_message_at)
    const channel = supabase
      .channel("dm_threads")
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_threads" }, () => {
        loadThreads();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages" }, () => {
        loadThreads();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [loadThreads]);

  return { threads, isLoading, refetch: loadThreads };
}

/** Realtime messages for a single thread. */
export function useDmThread(threadId: string | null) {
  const [messages, setMessages] = useState<DmMessageRow[]>([]);
  const [thread, setThread] = useState<DmThreadRow | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!threadId) return;

    let cancelled = false;

    (async () => {
      // Load the thread row (identifies both parties) and its messages together.
      const [threadResult, messagesResult] = await Promise.all([
        supabase.from("dm_threads").select("*").eq("id", threadId).maybeSingle(),
        supabase
          .from("dm_messages")
          .select("*")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true }),
      ]);

      if (!cancelled && !threadResult.error && threadResult.data) {
        setThread(threadResult.data as DmThreadRow);
      }
      if (!cancelled && !messagesResult.error && messagesResult.data) {
        setMessages(messagesResult.data as DmMessageRow[]);
      }
      if (!cancelled) setIsLoading(false);
    })();

    const channel = supabase
      .channel(`dm:${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as DmMessageRow]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "dm_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const updated = payload.new as DmMessageRow;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [threadId]);

  const sendMessage = useCallback(
    async (
      recipientId: string,
      text?: string,
      opts?: { isPaid?: boolean; price?: number; attachmentUrl?: string },
    ): Promise<{ ok: boolean; threadId?: string; error?: string }> => {
      try {
        const result = await callEdge<{ ok: boolean; thread_id?: string; error?: string }>("dm-send", {
          recipient_id: recipientId,
          text,
          is_paid: opts?.isPaid ?? false,
          price: opts?.price ?? 0,
          attachment_url: opts?.attachmentUrl,
        });
        return { ok: result.ok, threadId: result.thread_id };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to send" };
      }
    },
    [],
  );

  /** Mark thread as read (clear unread count for the current user's side). */
  const markRead = useCallback(async (t: DmThreadRow, myUserId: string) => {
    const updates: Record<string, number> = {};
    if (t.creator_id === myUserId) updates.creator_unread_count = 0;
    if (t.fan_id === myUserId) updates.fan_unread_count = 0;
    if (Object.keys(updates).length === 0) return;
    const { error } = await supabase.from("dm_threads").update(updates).eq("id", t.id);
    if (error) console.log("[povme] markRead failed:", error.message);
  }, []);

  return { messages, thread, isLoading, sendMessage, markRead };
}
