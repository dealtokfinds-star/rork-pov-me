import { useEffect, useRef, useState, useCallback } from "react";

import { supabase } from "@/lib/supabase";
import { callEdge } from "@/lib/edge";
import type { ChatMessage } from "@/types";

/**
 * Realtime chat for a live stream.
 *
 * - Loads recent chat_messages from Supabase on mount
 * - Subscribes to Postgres changes on chat_messages (INSERT) for live messages
 * - Subscribes to a presence channel for the real concurrent viewer count
 * - sendChat() inserts via the chat-send edge function (enforces slow-mode +
 *   sub-only server-side). Falls back to optimistic local insert.
 * - Tip/gift events arrive via the same realtime channel (stripe-webhook inserts
 *   them server-side), so the chat overlay updates automatically when a tip lands.
 */
export interface RealtimeChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  text: string | null;
  kind: string;
  badge: string | null;
  color: string | null;
  amount: number | null;
  created_at: string | null;
}

function toChatMessage(row: RealtimeChatMessage): ChatMessage {
  return {
    id: row.id,
    user: row.user_name,
    color: row.color ?? "#CCFF00",
    text: row.text ?? "",
    kind: (row.kind === "tip" || row.kind === "gift" || row.kind === "join" ? row.kind : "chat") as ChatMessage["kind"],
    badge: row.badge === "sub" || row.badge === "top" || row.badge === "mod" ? row.badge : undefined,
    amount: row.amount ?? undefined,
  };
}

export function useStreamChat(streamId: string | null, maxMessages = 80) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load recent + subscribe to inserts
  useEffect(() => {
    if (!streamId) return;

    let cancelled = false;

    (async () => {
      // Load recent messages
      const { data } = await supabase
        .from("chat_messages")
        .select("id, user_id, user_name, text, kind, badge, color, amount, created_at")
        .eq("stream_id", streamId)
        .order("created_at", { ascending: false })
        .limit(maxMessages);

      if (!cancelled && data) {
        setMessages(data.reverse().map(toChatMessage));
      }
    })();

    // Realtime channel for new messages
    const channel = supabase
      .channel(`chat:${streamId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `stream_id=eq.${streamId}` },
        (payload) => {
          const row = payload.new as RealtimeChatMessage;
          setMessages((prev) => [...prev.slice(-(maxMessages - 1)), toChatMessage(row)]);
        },
      );

    // Presence for viewer count
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setViewerCount(Object.keys(state).length);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setIsConnected(true);
        // Track presence
        channel.track({ online_at: new Date().toISOString() }).catch(() => {});
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setIsConnected(false);
      }
    });

    channelRef.current = channel;

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [streamId, maxMessages]);

  const sendChat = useCallback(
    async (text: string): Promise<{ ok: boolean; error?: string }> => {
      const trimmed = text.trim();
      if (!trimmed || !streamId) return { ok: false, error: "Empty message" };

      try {
        await callEdge("chat-send", { stream_id: streamId, text: trimmed, kind: "chat" });
        // Realtime will deliver the inserted row — no optimistic insert needed.
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to send";
        return { ok: false, error: msg };
      }
    },
    [streamId],
  );

  const pushLocalMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev.slice(-(maxMessages - 1)), msg]);
  }, [maxMessages]);

  const clear = useCallback(() => setMessages([]), []);

  return {
    messages,
    viewerCount,
    isConnected,
    sendChat,
    pushLocalMessage,
    clear,
  };
}
