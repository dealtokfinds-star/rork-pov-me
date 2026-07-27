/**
 * ViewerScreen
 * ------------
 * Watches a live POV stream. Replaces the inline `live/[id]` viewer when the
 * host is broadcasting from `HostScreen`; works equally well for simulated
 * mock streams (driven by `expo-video` playback) so the experience is real
 * on devices without an active broadcaster.
 *
 * Responsibilities:
 *  - Access gate: public / subscriber-only / PPV (routes to subscribe or unlock)
 *  - Real-time viewer count + chat (via `ChatOverlay`)
 *  - Network reconnect handling: shows a "buffering" state and auto-resumes
 *  - Memory: releases the `expo-video` player + chat timers on unmount
 *  - Tip / gift routing through the app wallet
 */

import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  AlertCircle,
  Crown,
  Lock,
  RefreshCw,
  Sparkles,
  Users,
  WifiOff,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatOverlay, type ChatOverlayHandle } from "@/components/ChatOverlay";
import { Avatar, Button, LiveBadge, PressableScale, Tag, haptic } from "@/components/ui";
import Colors, { Radius } from "@/constants/colors";
import { formatCount, formatMoney } from "@/lib/format";
import { useStream } from "@/lib/data";
import { useCreatorMap } from "@/hooks/useCreatorMap";
import { useApp } from "@/providers/app-provider";
import type { StreamAccess } from "@/types";

interface ViewerScreenProps {
  /** Stream id (falls back to the route param when omitted). */
  streamId?: string;
  /** Override the access level (used when joining a host's real session). */
  forcedAccess?: StreamAccess;
  /** Override the video source (used for real host broadcasts). */
  videoSource?: string | null;
  /** Override the thumbnail (used for real host broadcasts). */
  thumb?: string;
  /** Override the creator id (used for real host broadcasts). */
  creatorId?: string;
  /** Override the title (used for real host broadcasts). */
  title?: string;
}

type ViewHealth = "loading" | "playing" | "reconnecting" | "ended";

export default function ViewerScreen(props: ViewerScreenProps): React.ReactElement | null {
  const routeParams = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    isSubscribed,
    hasStreamAccess,
    unlockViaStripe,
    subscribeViaStripe,
    tipViaStripe,
    balance,
    displayName,
  } = useApp();

  // Resolve the stream — either from props (real host) or the database.
  const { data: dbStream } = useStream(props.streamId ?? routeParams.id ?? null);
  const { get: getCreator } = useCreatorMap();
  const stream = props.videoSource ? null : dbStream;
  const creator = getCreator(props.creatorId ?? stream?.creatorId ?? "");

  const [viewers, setViewers] = useState<number>(stream?.viewers ?? 0);
  const [health, setHealth] = useState<ViewHealth>("loading");
  const [banner, setBanner] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const chatRef = useRef<ChatOverlayHandle>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Access gate (memoized so we don't recompute every render).
  const access = useMemo(() => {
    const level = props.forcedAccess ?? stream?.access ?? "public";
    if (level === "public") return true;
    if (level === "subscribers") {
      return isSubscribed(props.creatorId ?? stream?.creatorId ?? "");
    }
    return (
      hasStreamAccess(props.streamId ?? routeParams.id ?? "") ||
      isSubscribed(props.creatorId ?? stream?.creatorId ?? "")
    );
  }, [
    props.forcedAccess,
    props.streamId,
    props.creatorId,
    stream,
    routeParams.id,
    isSubscribed,
    hasStreamAccess,
  ]);

  // Video player — only mounted when access is granted.
  const videoSource = props.videoSource ?? stream?.video ?? null;
  const player = useVideoPlayer(access ? videoSource : null, (p) => {
    p.loop = true;
    p.play();
  });

  // ---- viewer count + reconnect simulation ---------------------------------

  useEffect(() => {
    if (!access) return;
    const viewerTimer = setInterval(() => {
      setViewers((v) => Math.max(50, v + Math.floor(Math.random() * 90) - 30));
    }, 3400);
    return () => clearInterval(viewerTimer);
  }, [access]);

  // Brief loading → playing transition so the UI shows a spinner state.
  useEffect(() => {
    if (!access) return;
    setHealth("loading");
    const t = setTimeout(() => setHealth("playing"), 600);
    return () => clearTimeout(t);
  }, [access]);

  // Simulated network drops for the viewer side (rarer than host side).
  useEffect(() => {
    if (!access) return;
    const dropTimer = setInterval(() => {
      if (Math.random() > 0.985 && health === "playing") {
        setHealth("reconnecting");
        setReconnectAttempts(0);
      }
    }, 30_000);
    return () => clearInterval(dropTimer);
  }, [access, health]);

  // Reconnect with exponential backoff (viewer side).
  useEffect(() => {
    if (health !== "reconnecting") return;
    const attempt = reconnectAttempts + 1;
    if (attempt > 4) {
      setHealth("ended");
      return;
    }
    const delay = Math.pow(2, attempt - 1) * 1000;
    const t = setTimeout(() => {
      if (Math.random() < 0.85) {
        setHealth("playing");
        setReconnectAttempts(0);
        showBanner("Reconnected");
      } else {
        setReconnectAttempts(attempt);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [health, reconnectAttempts]);

  // ---- banner helper -------------------------------------------------------

  const showBanner = useCallback((text: string) => {
    setBanner(text);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 2400);
  }, []);

  useEffect(() => {
    return () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, []);

  // ---- tip routing ---------------------------------------------------------

  const handleTip = useCallback(
    async (amount: number, label?: string) => {
      const cid = props.creatorId ?? stream?.creatorId ?? "";
      if (!cid) return;
      const result = await tipViaStripe(cid, amount, label);
      if (!result.success) {
        showBanner(result.error ?? "Not enough wallet balance — top up to keep supporting.");
        return;
      }
      haptic("success");
      showBanner(`${label ?? "Tip"} sent · ${formatMoney(amount)}`);
    },
    [props.creatorId, stream, tipViaStripe, showBanner],
  );

  // ---- not found -----------------------------------------------------------

  if (!stream && !props.videoSource) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 60, paddingHorizontal: 24 }]}>
        <Text style={styles.endedTitle}>This stream ended</Text>
        <Button label="Back to live" onPress={() => router.replace("/(tabs)/live")} style={{ marginTop: 18 }} />
      </View>
    );
  }

  // ---- access gate ---------------------------------------------------------

  if (!access) {
    const isPpv = (props.forcedAccess ?? stream?.access) === "ppv";
    const price = isPpv ? (stream?.ppvPrice ?? 0) : creator?.subPrice ?? 0;
    return (
      <View style={styles.screen}>
        <Image
          source={{ uri: props.thumb ?? stream?.thumb ?? "" }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={35}
        />
        <LinearGradient
          colors={["rgba(255,45,111,0.2)", "rgba(8,8,10,0.85)", Colors.ink]}
          style={StyleSheet.absoluteFill}
        />
        <PressableScale
          onPress={() => router.back()}
          scaleTo={0.9}
          style={[styles.closeBtn, { top: insets.top + 10 }]}
        >
          <View style={styles.closeCircle}>
            <X size={19} color={Colors.text} />
          </View>
        </PressableScale>
        <View style={[styles.gateBody, { paddingBottom: insets.bottom + 30 }]}>
          <LiveBadge viewers={stream?.viewers} />
          <View style={styles.gateIcon}>
            <Lock size={22} color={Colors.ink} />
          </View>
          <Text style={styles.gateTitle}>{props.title ?? stream?.title}</Text>
          <Text style={styles.gateBodyText}>
            {isPpv
              ? `This is a pay-per-view live event. One unlock gets you the full stream${stream?.replayEnabled ? " plus the paid replay" : ""}.`
              : `Subscriber-only stream. Subscribe to @${creator?.handle} to enter this POV and every episode.`}
          </Text>
          {creator ? (
            <View style={styles.gateCreator}>
              <Avatar uri={creator.avatar} size={40} ring live />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.gateName}>{creator.name}</Text>
                <Text style={styles.gateIdentity}>
                  {creator.identity} · {formatCount(creator.subscribers)} subs
                </Text>
              </View>
            </View>
          ) : null}
          {banner ? <Text style={styles.gateWarn}>{banner}</Text> : null}
          <Button
            label={isPpv ? `Unlock live · ${formatMoney(price)}` : `Subscribe · ${formatMoney(price)}/mo`}
            variant={isPpv ? "ppv" : "primary"}
            onPress={async () => {
              const sid = props.streamId ?? routeParams.id ?? "";
              const cid = props.creatorId ?? stream?.creatorId ?? "";
              const result = isPpv
                ? await unlockViaStripe(sid, price, cid, sid)
                : await subscribeViaStripe(cid, price);
              if (!result.success) {
                showBanner(result.error ?? `Wallet balance is ${formatMoney(balance)} — top up to join.`);
                return;
              }
              haptic("success");
            }}
            style={{ marginTop: 22 }}
          />
          <Button
            label="Add funds to wallet"
            variant="ghost"
            small
            onPress={() => router.push("/wallet")}
            style={{ marginTop: 10 }}
          />
        </View>
      </View>
    );
  }

  // ---- active viewer -------------------------------------------------------

  return (
    <View style={styles.screen}>
      {videoSource ? (
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          contentFit="cover"
          nativeControls={false}
        />
      ) : (
        <Image
          source={{ uri: props.thumb ?? stream?.thumb ?? "" }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      )}
      <LinearGradient
        colors={["rgba(8,8,10,0.85)", "transparent", "rgba(8,8,10,0.5)", "rgba(8,8,10,0.95)"]}
        locations={[0, 0.25, 0.6, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* loading spinner */}
      {health === "loading" ? (
        <View style={styles.loadingWrap}>
          <RefreshCw size={28} color={Colors.text} />
          <Text style={styles.loadingText}>Loading stream…</Text>
        </View>
      ) : null}

      {/* reconnect / ended overlay */}
      {health === "reconnecting" || health === "ended" ? (
        <View style={styles.reconnectOverlay}>
          <View style={styles.reconnectIcon}>
            {health === "reconnecting" ? (
              <AnimatedSpin>
                <WifiOff size={26} color={Colors.gold} />
              </AnimatedSpin>
            ) : (
              <AlertCircle size={26} color={Colors.magenta} />
            )}
          </View>
          <Text style={styles.reconnectTitle}>
            {health === "reconnecting" ? "Reconnecting…" : "Stream ended"}
          </Text>
          <Text style={styles.reconnectBody}>
            {health === "reconnecting"
              ? `Attempt ${reconnectAttempts + 1} of 4`
              : "The broadcaster went offline. Replay may be available shortly."}
          </Text>
          {health === "ended" ? (
            <Button
              label="Back to live"
              variant="primary"
              onPress={() => router.replace("/(tabs)/live")}
              style={{ marginTop: 18 }}
            />
          ) : null}
        </View>
      ) : null}

      {/* ---- top bar ---- */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {creator ? (
          <PressableScale
            onPress={() => router.push(`/creator/${creator.id}`)}
            scaleTo={0.96}
            style={{ flex: 1 }}
          >
            <View style={styles.hostPill}>
              <Avatar uri={creator.avatar} size={30} ring live />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <Text style={styles.hostName} numberOfLines={1}>
                  {creator.name}
                </Text>
                <Text style={styles.hostMeta}>
                  {stream?.startedMinutesAgo ?? 0}m · {creator.location}
                </Text>
              </View>
              {!isSubscribed(creator.id) ? (
                <PressableScale
                  onPress={() => router.push(`/subscribe/${creator.id}`)}
                  scaleTo={0.9}
                >
                  <View style={styles.subMini}>
                    <Text style={styles.subMiniText}>SUB</Text>
                  </View>
                </PressableScale>
              ) : null}
            </View>
          </PressableScale>
        ) : null}

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

      {/* ---- badges ---- */}
      <View style={[styles.badgeRow, { top: insets.top + 62 }]}>
        <LiveBadge />
        <Tag
          label={
            (props.forcedAccess ?? stream?.access) === "public"
              ? "OPEN POV"
              : (props.forcedAccess ?? stream?.access) === "subscribers"
                ? "SUBS ONLY"
                : "PPV EVENT"
          }
          color={Colors.ink}
          bg={(props.forcedAccess ?? stream?.access) === "ppv" ? Colors.cyan : Colors.lime}
        />
      </View>

      {/* ---- banner ---- */}
      {banner ? (
        <View style={[styles.banner, { top: insets.top + 104 }]}>
          <Sparkles size={13} color={Colors.ink} />
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      {/* ---- chat overlay ---- */}
      <View style={styles.chatLayer}>
        <ChatOverlay
          ref={chatRef}
          simulateIncoming
          incomingIntervalMs={2300}
          maxMessages={80}
          displayName={displayName}
          onSendTip={handleTip}
          walletBalance={balance}
          showClose
          onClose={() => router.back()}
        />
      </View>
    </View>
  );
}

// ===========================================================================
// Small helpers
// ===========================================================================

/** A tiny continuous-spin wrapper for the reconnect icon. */
function AnimatedSpin({ children }: { children: React.ReactNode }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1200, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  return (
    <Animated.View
      style={{
        transform: [
          {
            rotate: spin.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "360deg"],
            }),
          },
        ],
      }}
    >
      {children}
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

  // loading
  loadingWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,8,10,0.4)",
    gap: 12,
  },
  loadingText: { color: Colors.text, fontSize: 13, fontWeight: "700" },

  // reconnect overlay
  reconnectOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,8,10,0.85)",
    paddingHorizontal: 32,
    zIndex: 15,
  },
  reconnectIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,182,39,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,182,39,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  reconnectTitle: { color: Colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.6 },
  reconnectBody: {
    color: Colors.textMid,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },

  // access gate
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
  endedTitle: { color: Colors.text, fontSize: 22, fontWeight: "900" },

  // top bar
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 8, zIndex: 10 },
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
  subMiniText: { color: Colors.ink, fontSize: 9.5, fontWeight: "900", letterSpacing: 0.6 },
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
  badgeRow: { position: "absolute", left: 14, flexDirection: "row", gap: 6, zIndex: 6 },
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
    zIndex: 7,
  },
  bannerText: { color: Colors.ink, fontSize: 12.5, fontWeight: "900" },
  chatLayer: { flex: 1, justifyContent: "flex-end" },
});
