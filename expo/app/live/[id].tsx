import { useEvent } from "expo";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  Crown,
  Gift,
  Heart,
  Lock,
  MessageCircle,
  Radio,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Button, LiveBadge, PressableScale, Tag, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import {
  CHAT_COLORS,
  GIFTS,
  formatCount,
  formatMoney,
} from "@/constants/mock-data";
import { useApp } from "@/providers/app-provider";
import { useCreator, useStream } from "@/lib/data";
import { useStreamAccess } from "@/hooks/useAccess";
import { useStreamChat } from "@/hooks/useChat";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import type { ChatMessage } from "@/types";

const QUICK_TIPS = [2, 5, 10, 25];

export default function LiveRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    isSubscribed,
    unlockViaStripe,
    subscribeViaStripe,
    tipViaStripe,
    balance,
  } = useApp();

  const track = useTrackEvent();

  const { data: stream, isLoading } = useStream(id ?? "");
  const { data: creator } = useCreator(stream?.creatorId);

  // Server-enforced access check
  const { data: accessResult, isLoading: accessLoading } = useStreamAccess(id);
  const access = accessResult?.allowed ?? false;
  const hlsUrl = accessResult?.hlsPlaybackUrl ?? null;

  // Real chat via Supabase Realtime
  const {
    messages: chatMessages,
    viewerCount: realViewerCount,
    sendChat,
  } = useStreamChat(id ?? null);

  const [messages, setMessages] = useState<ChatMessage[]>(chatMessages);
  const [draft, setDraft] = useState<string>("");
  const [giftOpen, setGiftOpen] = useState<boolean>(false);
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([]);
  const [viewers, setViewers] = useState<number>(stream?.viewers ?? realViewerCount ?? 0);
  const [banner, setBanner] = useState<string | null>(null);
  const [paymentPending, setPaymentPending] = useState<boolean>(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const heartId = useRef<number>(0);

  // Sync real chat messages
  useEffect(() => {
    setMessages(chatMessages);
  }, [chatMessages]);

  // Use real viewer count from presence + server
  useEffect(() => {
    setViewers(stream?.viewers ?? realViewerCount ?? 0);
  }, [stream?.viewers, realViewerCount]);

  // View event once the stream resolves — powers recommendations + funnels.
  useEffect(() => {
    if (stream && creator) {
      track("view", { stream_id: stream.id, creator_id: stream.creatorId });
    }
  }, [stream, creator, track]);

  const player = useVideoPlayer(access && hlsUrl ? hlsUrl : null, (p) => {
    p.loop = true;
    if (access) p.play();
  });

  // Real playback status — drives the connecting overlay (no fake states).
  const statusEvent = useEvent(player, "statusChange", { status: player.status });
  const playerStatus = statusEvent?.status ?? "idle";

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  const showBanner = useCallback((text: string) => {
    setBanner(text);
    setTimeout(() => setBanner(null), 2600);
  }, []);

  const handleSendChat = useCallback(async () => {
    const text = draft.trim();
    if (text.length === 0) return;
    const result = await sendChat(text);
    if (result.ok) {
      setDraft("");
      haptic("light");
    } else {
      showBanner(result.error ?? "Failed to send");
    }
  }, [draft, sendChat]);

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
    async (amount: number, label?: string) => {
      if (!stream) return;
      setPaymentPending(true);
      const result = await tipViaStripe(stream.creatorId, amount, label);
      setPaymentPending(false);
      if (!result.success) {
        showBanner(result.error ?? "Tip failed");
        return;
      }
      haptic("success");
      setGiftOpen(false);
      track("tip", { creator_id: stream.creatorId, value: amount });
      showBanner(`${label ?? "Tip"} sent · ${formatMoney(amount)}`);
    },
    [stream, tipViaStripe, showBanner, track],
  );

  if (isLoading || accessLoading) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: Colors.textMid, fontSize: 14, fontWeight: "700" }}>Loading…</Text>
      </View>
    );
  }

  if (!stream || !creator) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 60, paddingHorizontal: 24 }]}>
        <Text style={styles.lockTitle}>This stream ended</Text>
        <Button label="Back to live" onPress={() => router.replace("/(tabs)/live")} style={{ marginTop: 18 }} />
      </View>
    );
  }

  if (!access) {
    const isPpv = stream.access === "ppv";
    const price = isPpv ? (stream.ppvPrice ?? 0) : creator.subPrice;
    return (
      <View style={styles.screen}>
        <Image source={{ uri: stream.thumb }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={35} />
        <LinearGradient
          colors={["rgba(255,45,111,0.2)", "rgba(8,8,10,0.85)", Colors.ink]}
          style={StyleSheet.absoluteFill}
        />
        <PressableScale onPress={() => router.back()} scaleTo={0.9} style={[styles.closeBtn, { top: insets.top + 10 }]}>
          <View style={styles.closeCircle}>
            <X size={19} color={Colors.text} />
          </View>
        </PressableScale>
        <View style={[styles.gateBody, { paddingBottom: insets.bottom + 30 }]}>
          <LiveBadge viewers={stream.viewers} />
          <View style={styles.gateIcon}>
            <Lock size={22} color={Colors.ink} />
          </View>
          <Text style={styles.gateTitle}>{stream.title}</Text>
          <Text style={styles.gateBodyText}>
            {isPpv
              ? `This is a pay-per-view live event. One unlock gets you the full stream${stream.replayEnabled ? " plus the paid replay" : ""}.`
              : `Subscriber-only stream. Subscribe to @${creator.handle} to enter this POV and every episode.`}
          </Text>
          <View style={styles.gateCreator}>
            <Avatar uri={creator.avatar} size={40} ring live />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.gateName}>{creator.name}</Text>
              <Text style={styles.gateIdentity}>
                {creator.identity} · {formatCount(creator.subscribers)} subs
              </Text>
            </View>
          </View>
          {banner ? <Text style={styles.gateWarn}>{banner}</Text> : null}
          <Button
            label={paymentPending ? "Processing…" : isPpv ? `Unlock live · ${formatMoney(price)}` : `Subscribe · ${formatMoney(price)}/mo`}
            variant={isPpv ? "ppv" : "primary"}
            disabled={paymentPending}
            onPress={async () => {
              setPaymentPending(true);
              const result = isPpv
                ? await unlockViaStripe(stream.id, price, stream.creatorId, stream.id)
                : await subscribeViaStripe(stream.creatorId, price);
              setPaymentPending(false);
              if (!result.success) {
                showBanner(result.error ?? "Payment failed");
                return;
              }
              haptic("success");
              if (isPpv) {
                track("unlock", { stream_id: stream.id, creator_id: stream.creatorId, value: price });
              } else {
                track("subscribe", { creator_id: stream.creatorId, value: price });
              }
              showBanner("Payment processing — access will be granted shortly.");
            }}
            style={{ marginTop: 22 }}
          />
          <Button
            label="Top up wallet"
            variant="ghost"
            small
            onPress={() => router.push("/wallet")}
            style={{ marginTop: 10 }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <VideoView style={StyleSheet.absoluteFill} player={player} contentFit="cover" nativeControls={false} />
      <LinearGradient
        colors={["rgba(8,8,10,0.85)", "transparent", "rgba(8,8,10,0.5)", "rgba(8,8,10,0.95)"]}
        locations={[0, 0.25, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      {hlsUrl && (playerStatus === "loading" || playerStatus === "idle") ? (
        <View pointerEvents="none" style={styles.connectingWrap}>
          <Text style={styles.connectingText}>Connecting to the stream…</Text>
        </View>
      ) : null}

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.push(`/creator/${creator.id}`)} scaleTo={0.96} style={{ flex: 1 }}>
          <View style={styles.hostPill}>
            <Avatar uri={creator.avatar} size={30} ring live />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text style={styles.hostName} numberOfLines={1}>
                {creator.name}
              </Text>
              <Text style={styles.hostMeta}>{stream.startedMinutesAgo}m · {creator.location}</Text>
            </View>
            {!isSubscribed(creator.id) ? (
              <PressableScale onPress={() => router.push(`/subscribe/${creator.id}`)} scaleTo={0.9}>
                <View style={styles.subMini}>
                  <Text style={styles.subMiniText}>SUB</Text>
                </View>
              </PressableScale>
            ) : null}
          </View>
        </PressableScale>

        <View style={styles.topRight}>
          <View style={styles.viewerPill}>
            <Users size={11} color="#fff" />
            <Text style={styles.viewerText}>{formatCount(viewers)}</Text>
          </View>
          <PressableScale onPress={() => router.back()} scaleTo={0.9}>
            <View style={styles.closeCircleSmall}>
              <X size={17} color={Colors.text} />
            </View>
          </PressableScale>
        </View>
      </View>

      <View style={[styles.badgeRow, { top: insets.top + 62 }]}>
        <LiveBadge />
        <Tag
          label={stream.access === "public" ? "OPEN POV" : stream.access === "subscribers" ? "SUBS ONLY" : "PPV EVENT"}
          color={Colors.ink}
          bg={stream.access === "ppv" ? Colors.cyan : Colors.lime}
        />
        {stream.replayEnabled ? <Tag label="REPLAY ON" color={Colors.text} bg="rgba(0,0,0,0.5)" /> : null}
      </View>

      {banner ? (
        <View style={[styles.banner, { top: insets.top + 104 }]}>
          <Sparkles size={13} color={Colors.ink} />
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.bottom}
      >
        <View style={styles.chatWrap}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <ChatRow message={item} />}
            contentContainerStyle={{ paddingTop: 8, gap: 7 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        </View>

        {giftOpen ? (
          <View style={styles.giftTray}>
            <View style={styles.giftHeader}>
              <Text style={styles.giftTitle}>Send a gift</Text>
              <Text style={styles.giftBalance}>Wallet {formatMoney(balance)}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {GIFTS.map((g) => (
                <PressableScale key={g.id} onPress={() => sendTip(g.price, g.name)} scaleTo={0.9}>
                  <View style={styles.giftCard}>
                    <Text style={styles.giftEmoji}>{g.emoji}</Text>
                    <Text style={styles.giftName}>{g.name}</Text>
                    <Text style={styles.giftPrice}>{formatMoney(g.price)}</Text>
                  </View>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.tipRow}>
            {QUICK_TIPS.map((amount) => (
              <PressableScale key={amount} onPress={() => sendTip(amount)} scaleTo={0.9} style={{ flex: 1 }}>
                <View style={styles.tipChip}>
                  <Text style={styles.tipChipText}>${amount}</Text>
                </View>
              </PressableScale>
            ))}
            <PressableScale onPress={() => router.push(`/tip/${creator.id}`)} scaleTo={0.9}>
              <View style={[styles.tipChip, { backgroundColor: "rgba(255,182,39,0.16)", borderColor: "rgba(255,182,39,0.35)" }]}>
                <Crown size={14} color={Colors.gold} />
              </View>
            </PressableScale>
          </View>
        )}

        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.inputBox}>
            <MessageCircle size={15} color={Colors.textDim} />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Say something…"
              placeholderTextColor={Colors.textDim}
              style={styles.input}
              onSubmitEditing={handleSendChat}
              returnKeyType="send"
            />
            <PressableScale onPress={handleSendChat} scaleTo={0.85}>
              <View style={styles.sendCircle}>
                <Send size={14} color={Colors.ink} />
              </View>
            </PressableScale>
          </View>
          <PressableScale onPress={() => setGiftOpen((v) => !v)} scaleTo={0.88}>
            <View style={[styles.roundBtn, giftOpen && { backgroundColor: Colors.gold }]}>
              <Gift size={18} color={giftOpen ? Colors.ink : Colors.gold} />
            </View>
          </PressableScale>
          <PressableScale onPress={popHeart} scaleTo={0.88}>
            <View style={styles.roundBtn}>
              <Heart size={18} color={Colors.magenta} fill={Colors.magenta} />
            </View>
          </PressableScale>
        </View>
      </KeyboardAvoidingView>

      <View pointerEvents="none" style={[styles.heartLayer, { bottom: insets.bottom + 80 }]}>
        {hearts.map((h) => (
          <FloatingHeart key={h.id} offsetX={h.x} />
        ))}
      </View>
    </View>
  );
}

function ChatRow({ message }: { message: ChatMessage }) {
  if (message.kind === "tip" || message.kind === "gift") {
    return (
      <View style={styles.tipMsg}>
        <Sparkles size={12} color={Colors.ink} />
        <Text style={styles.tipMsgText}>
          {message.user} {message.text} · {formatMoney(message.amount ?? 0)}
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
  screen: { flex: 1, backgroundColor: "#000" },
  closeBtn: { position: "absolute", right: 14, zIndex: 5 },
  closeCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeCircleSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  gateBody: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 24, gap: 4 },
  gateIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  gateTitle: {
    color: Colors.text,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 32,
    marginTop: 14,
  },
  gateBodyText: { color: Colors.textMid, fontSize: 14, fontWeight: "500", lineHeight: 21, marginTop: 10 },
  gateCreator: { flexDirection: "row", alignItems: "center", marginTop: 20 },
  gateName: { color: Colors.text, fontSize: 14.5, fontWeight: "900" },
  gateIdentity: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  gateWarn: { color: Colors.gold, fontSize: 12.5, fontWeight: "700", marginTop: 14 },
  lockTitle: { color: Colors.text, fontSize: 22, fontWeight: "900" },
  topBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 8 },
  hostPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: Radius.pill,
    padding: 6,
    paddingRight: 10,
  },
  hostName: { color: Colors.text, fontSize: 13, fontWeight: "900" },
  hostMeta: { color: "rgba(255,255,255,0.6)", fontSize: 10.5, fontWeight: "700", marginTop: 1 },
  subMini: {
    backgroundColor: Colors.lime,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 6,
  },
  subMiniText: { color: Colors.ink, ...microLabel, fontSize: 9.5 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  viewerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    height: 28,
    borderRadius: Radius.pill,
  },
  viewerText: { color: "#fff", fontSize: 11.5, fontWeight: "800" },
  badgeRow: { position: "absolute", left: 14, flexDirection: "row", gap: 6 },
  banner: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: Colors.lime,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
  },
  bannerText: { color: Colors.ink, fontSize: 12.5, fontWeight: "900" },
  bottom: { flex: 1, justifyContent: "flex-end" },
  chatWrap: { height: 230, paddingHorizontal: 14 },
  chatRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  chatText: { color: "#fff", fontSize: 13, fontWeight: "600", lineHeight: 18, flex: 1 },
  subBadge: { backgroundColor: "rgba(204,255,0,0.25)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  subBadgeText: { color: Colors.lime, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.6 },
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
    backgroundColor: Colors.surfaceHi,
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
  heartLayer: { position: "absolute", right: 34, alignItems: "center" },
  connectingWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  connectingText: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "800" },
});
