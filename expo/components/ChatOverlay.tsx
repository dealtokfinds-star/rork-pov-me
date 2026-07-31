/**
 * ChatOverlay
 * -----------
 * Real-time chat component rendered over a live video stream (host or viewer).
 * Self-contained: manages its own message list, auto-scroll, slow-mode gating,
 * floating reactions, and a composer. Designed to be dropped on top of a
 * full-bleed `CameraView` / `VideoView` without intercepting its gestures
 * (the overlay only captures touches on its own input row + reaction buttons).
 *
 * Features:
 *  - Real chat messages passed in via initialMessages (from Supabase Realtime)
 *  - Slow-mode: enforces a cooldown between user messages
 *  - Sub/mod/top badges, colored usernames, tip + gift + join events
 *  - Floating heart reactions with haptics
 *  - Auto-scroll to newest message, capped at 80 messages to bound memory
 *  - Composer with send + gift tray toggle + heart pop
 *  - `onSendTip` callback so the host/viewer screen can route tips to the wallet
 */

import { LinearGradient } from "expo-linear-gradient";
import { Heart, MessageCircle, Send, Sparkles, X } from "lucide-react-native";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PressableScale, haptic } from "@/components/ui";
import Colors, { Radius } from "@/constants/colors";
import { CHAT_COLORS, GIFTS } from "@/constants/mock-data";
import type { ChatMessage } from "@/types";

export interface ChatOverlayHandle {
  /** Push a message from outside (e.g. a tip confirmation). */
  pushMessage: (msg: ChatMessage) => void;
  /** Clear all messages. */
  clear: () => void;
}

interface ChatOverlayProps {
  /** Initial messages (real chat messages from Supabase Realtime). */
  initialMessages?: ChatMessage[];
  /** Max messages kept in memory. Default 80. */
  maxMessages?: number;
  /** Slow mode cooldown in seconds. 0 = disabled. Default 0. */
  slowModeSec?: number;
  /** Restrict chat to subscribers — non-subs see a locked composer. */
  subOnly?: boolean;
  /** Whether the current user is a subscriber (when subOnly is true). */
  isSub?: boolean;
  /** Current user's display name. */
  displayName: string;
  /** Username color for the current user. */
  userColor?: string;
  /** Called when the user sends a tip via the gift tray. */
  onSendTip?: (amount: number, label?: string) => void;
  /** Called when the user sends a chat message. */
  onSendChat?: (text: string) => void;
  /** Wallet balance for the gift tray display. */
  walletBalance?: number;
  /** Whether to show the close (X) button. Default false. */
  showClose?: boolean;
  onClose?: () => void;
}

const QUICK_TIPS = [2, 5, 10, 25];

export const ChatOverlay = forwardRef<ChatOverlayHandle, ChatOverlayProps>(
  function ChatOverlay(
    {
      initialMessages,
      maxMessages = 80,
      slowModeSec = 0,
      subOnly = false,
      isSub = true,
      displayName,
      userColor = Colors.lime,
      onSendTip,
      onSendChat,
      walletBalance,
      showClose = false,
      onClose,
    },
    ref,
  ) {
    const [messages, setMessages] = useState<ChatMessage[]>(
      () => initialMessages ?? [],
    );
    const [draft, setDraft] = useState<string>("");
    const [giftOpen, setGiftOpen] = useState<boolean>(false);
    const [hearts, setHearts] = useState<{ id: number; x: number }[]>([]);
    const [lastSentAt, setLastSentAt] = useState<number>(0);
    const [slowBanner, setSlowBanner] = useState<string | null>(null);

    const listRef = useRef<FlatList<ChatMessage>>(null);
    const heartId = useRef<number>(0);

    // ---- imperative handle --------------------------------------------------

    useImperativeHandle(
      ref,
      () => ({
        pushMessage: (msg: ChatMessage) => {
          setMessages((prev) => [...prev.slice(-(maxMessages - 1)), msg]);
        },
        clear: () => setMessages([]),
      }),
      [maxMessages],
    );

    // ---- auto-scroll --------------------------------------------------------

    useEffect(() => {
      if (messages.length > 0) {
        // Defer to next frame so the new row is measured first.
        requestAnimationFrame(() => {
          listRef.current?.scrollToEnd({ animated: true });
        });
      }
    }, [messages.length]);

    // ---- actions ------------------------------------------------------------

    const showSlowBanner = useCallback((text: string) => {
      setSlowBanner(text);
      setTimeout(() => setSlowBanner(null), 2200);
    }, []);

    const sendChat = useCallback(() => {
      const text = draft.trim();
      if (text.length === 0) return;

      // Slow-mode enforcement.
      if (slowModeSec > 0) {
        const elapsed = (Date.now() - lastSentAt) / 1000;
        if (elapsed < slowModeSec) {
          const wait = Math.ceil(slowModeSec - elapsed);
          showSlowBanner(`Slow mode is on — wait ${wait}s before sending again.`);
          return;
        }
      }

      setMessages((prev) => [
        ...prev.slice(-(maxMessages - 1)),
        {
          id: `me${Date.now()}`,
          user: displayName,
          color: userColor,
          text,
          kind: "chat",
          badge: isSub ? "sub" : undefined,
        },
      ]);
      setDraft("");
      setLastSentAt(Date.now());
      onSendChat?.(text);
      haptic("light");
    }, [
      draft,
      displayName,
      userColor,
      isSub,
      maxMessages,
      slowModeSec,
      lastSentAt,
      onSendChat,
      showSlowBanner,
    ]);

    const popHeart = useCallback(() => {
      heartId.current += 1;
      const item = { id: heartId.current, x: Math.random() * 40 - 20 };
      setHearts((prev) => [...prev, item]);
      haptic("light");
      setTimeout(() => {
        setHearts((prev) => prev.filter((h) => h.id !== item.id));
      }, 1800);
    }, []);

    const sendTip = useCallback(
      (amount: number, label?: string) => {
        onSendTip?.(amount, label);
        setMessages((prev) => [
          ...prev.slice(-(maxMessages - 1)),
          {
            id: `tip${Date.now()}`,
            user: displayName,
            color: Colors.gold,
            text: label ? `sent ${label}` : "tipped the stream",
            kind: label ? "gift" : "tip",
            amount,
            badge: "top",
          },
        ]);
        setGiftOpen(false);
        haptic("success");
      },
      [displayName, onSendTip, maxMessages],
    );

    // ---- locked composer (sub-only) -----------------------------------------

    if (subOnly && !isSub) {
      return (
        <View style={styles.lockedWrap} pointerEvents="auto">
          <View style={styles.lockedBox}>
            <Sparkles size={15} color={Colors.lime} />
            <Text style={styles.lockedText}>Subscribe to send messages and gifts</Text>
          </View>
        </View>
      );
    }

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
        pointerEvents="box-none"
      >
        {/* Gradient so chat text stays readable over bright video frames */}
        <LinearGradient
          colors={["transparent", "rgba(8,8,10,0.55)"]}
          style={styles.chatScrim}
          pointerEvents="none"
        />

        {showClose ? (
          <PressableScale onPress={onClose} scaleTo={0.9} style={styles.closeBtn}>
            <View style={styles.closeCircle}>
              <X size={17} color={Colors.text} />
            </View>
          </PressableScale>
        ) : null}

        {slowBanner ? (
          <View style={styles.slowBanner}>
            <Text style={styles.slowBannerText}>{slowBanner}</Text>
          </View>
        ) : null}

        <View style={styles.chatWrap}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <ChatRow message={item} />}
            contentContainerStyle={{ paddingTop: 8, gap: 7 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            pointerEvents="none"
          />
        </View>

        {giftOpen ? (
          <View style={styles.giftTray}>
            <View style={styles.giftHeader}>
              <Text style={styles.giftTitle}>Send a gift</Text>
              {walletBalance !== undefined ? (
                <Text style={styles.giftBalance}>Wallet ${walletBalance.toFixed(2)}</Text>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {GIFTS.map((g) => (
                <PressableScale key={g.id} onPress={() => sendTip(g.price, g.name)} scaleTo={0.9}>
                  <View style={styles.giftCard}>
                    <Text style={styles.giftEmoji}>{g.emoji}</Text>
                    <Text style={styles.giftName}>{g.name}</Text>
                    <Text style={styles.giftPrice}>${g.price}</Text>
                  </View>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.tipRow}>
            {QUICK_TIPS.map((amount) => (
              <PressableScale
                key={amount}
                onPress={() => sendTip(amount)}
                scaleTo={0.9}
                style={{ flex: 1 }}
              >
                <View style={styles.tipChip}>
                  <Text style={styles.tipChipText}>${amount}</Text>
                </View>
              </PressableScale>
            ))}
          </View>
        )}

        <View style={styles.inputRow}>
          <View style={styles.inputBox}>
            <MessageCircle size={15} color={Colors.textDim} />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Say something…"
              placeholderTextColor={Colors.textDim}
              style={styles.input}
              onSubmitEditing={sendChat}
              returnKeyType="send"
              maxLength={240}
            />
            <PressableScale onPress={sendChat} scaleTo={0.85}>
              <View style={styles.sendCircle}>
                <Send size={14} color={Colors.ink} />
              </View>
            </PressableScale>
          </View>
          <PressableScale onPress={() => setGiftOpen((v) => !v)} scaleTo={0.88}>
            <View style={[styles.roundBtn, giftOpen && { backgroundColor: Colors.gold }]}>
              <Sparkles size={18} color={giftOpen ? Colors.ink : Colors.gold} />
            </View>
          </PressableScale>
          <PressableScale onPress={popHeart} scaleTo={0.88}>
            <View style={styles.roundBtn}>
              <Heart size={18} color={Colors.magenta} fill={Colors.magenta} />
            </View>
          </PressableScale>
        </View>

        {/* Floating hearts layer — pointerEvents none so taps pass through */}
        <View pointerEvents="none" style={styles.heartLayer}>
          {hearts.map((h) => (
            <FloatingHeart key={h.id} offsetX={h.x} />
          ))}
        </View>
      </KeyboardAvoidingView>
    );
  },
);

function ChatRow({ message }: { message: ChatMessage }) {
  if (message.kind === "tip" || message.kind === "gift") {
    return (
      <View style={styles.tipMsg}>
        <Sparkles size={12} color={Colors.ink} />
        <Text style={styles.tipMsgText}>
          {message.user} {message.text}
          {message.amount !== undefined ? ` · $${message.amount}` : ""}
        </Text>
      </View>
    );
  }
  if (message.kind === "join") {
    return <Text style={styles.joinMsg}>{message.user} joined the POV</Text>;
  }
  return (
    <View style={styles.chatRow}>
      {message.badge === "sub" ? (
        <View style={styles.subBadge}>
          <Text style={styles.subBadgeText}>SUB</Text>
        </View>
      ) : message.badge === "top" ? (
        <View style={styles.topBadge}>
          <Text style={styles.topBadgeText}>TOP</Text>
        </View>
      ) : null}
      <Text style={styles.chatText}>
        <Text style={{ color: message.color, fontWeight: "900" }}>{message.user}</Text>
        <Text>  {message.text}</Text>
      </Text>
    </View>
  );
}

function FloatingHeart({ offsetX }: { offsetX: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const color = useMemo(() => CHAT_COLORS[Math.floor(Math.random() * CHAT_COLORS.length)], []);

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 1700, useNativeDriver: true }).start();
  }, [anim]);

  return (
    <Animated.View
      style={{
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -230] }) },
          { translateX: offsetX },
          { scale: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.5, 1.2, 0.7] }) },
        ],
        opacity: anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.8, 0] }),
      }}
    >
      <Heart size={26} color={color} fill={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  chatScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 280,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 14,
    zIndex: 6,
  },
  closeCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  slowBanner: {
    alignSelf: "center",
    backgroundColor: "rgba(255,182,39,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    marginBottom: 8,
  },
  slowBannerText: { color: Colors.ink, fontSize: 12.5, fontWeight: "900" },
  chatWrap: { height: 230, paddingHorizontal: 14 },
  chatRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  chatText: { color: "#fff", fontSize: 13, fontWeight: "600", lineHeight: 18, flex: 1 },
  subBadge: {
    backgroundColor: "rgba(204,255,0,0.25)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subBadgeText: { color: Colors.lime, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.6 },
  topBadge: {
    backgroundColor: "rgba(255,182,39,0.25)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  topBadgeText: { color: Colors.gold, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.6 },
  joinMsg: { color: "rgba(255,255,255,0.45)", fontSize: 11.5, fontWeight: "700" },
  tipMsg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: Colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  tipMsgText: { color: Colors.ink, fontSize: 12, fontWeight: "900" },
  giftTray: {
    marginHorizontal: 14,
    marginTop: 10,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(19,19,24,0.94)",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  giftHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  giftTitle: { color: Colors.text, fontSize: 14, fontWeight: "900" },
  giftBalance: { color: Colors.lime, fontSize: 12, fontWeight: "800" },
  giftCard: {
    width: 86,
    padding: 11,
    borderRadius: Radius.md,
    backgroundColor: "#1B1B22",
    alignItems: "center",
    gap: 3,
  },
  giftEmoji: { fontSize: 24 },
  giftName: { color: Colors.text, fontSize: 11, fontWeight: "800", marginTop: 4 },
  giftPrice: { color: Colors.gold, fontSize: 11, fontWeight: "900" },
  tipRow: { flexDirection: "row", gap: 8, paddingHorizontal: 14, marginTop: 10 },
  tipChip: {
    height: 38,
    minWidth: 46,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  tipChipText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingTop: 10 },
  inputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  input: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "600" },
  sendCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  roundBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  heartLayer: { position: "absolute", right: 34, bottom: 80, alignItems: "center" },
  lockedWrap: { justifyContent: "flex-end", paddingHorizontal: 14, paddingBottom: 14 },
  lockedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "rgba(8,8,10,0.85)",
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.3)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Radius.pill,
  },
  lockedText: { color: Colors.text, fontSize: 13, fontWeight: "800" },
});
