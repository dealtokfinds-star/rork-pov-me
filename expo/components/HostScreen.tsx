/**
 * HostScreen
 * ----------
 * The creator's live streaming surface — real Mux pipeline edition.
 *
 * Renders:
 *  - A "Connect your encoder" card with the RTMP ingest URL + copyable stream
 *    key (long-press to copy, haptic). For all sources (chest rig / phone /
 *    desktop) the key is shown so an external encoder can connect.
 *  - A local `CameraView` confidence monitor (labelled "local preview only")
 *    so the creator can frame their shot. Expo Go can't push RTMP, so the
 *    phone is the monitor while an encoder broadcasts.
 *  - A live health panel pulling real Mux metrics via `stream-health` polling
 *    every 5s (bitrate, resolution, viewers, dropped frames, status).
 *  - The end-stream button wired to `endLiveStream(streamId)`, which finalizes
 *    the Mux asset and auto-creates a replay episode.
 *
 * Memory & lifecycle:
 *  - The local `CameraView` confidence monitor is only mounted while live so
 *    the native capture session is released when we end.
 *  - Health polling is cleared on unmount and on end.
 */

import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  Check,
  Copy,
  Eye,
  Loader,
  Radio,
  Server,
  WifiOff,
  X,
  Zap,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PhoneBroadcast from "@/components/PhoneBroadcast";
import { Button, PressableScale, Tag, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { formatCount, formatMoney } from "@/constants/mock-data";
import { useStreamingPermissions } from "@/lib/streaming/PermissionHandler";
import {
  endLiveStream,
  getStreamHealth,
  type StreamHealth,
} from "@/lib/streaming/muxLive";
import { useApp } from "@/providers/app-provider";
import type { PovCategory, StreamAccess } from "@/types";

type Source = "chest" | "phone" | "desktop";

interface HostScreenProps {
  title: string;
  category: PovCategory;
  access: StreamAccess;
  ppvPrice?: number;
  streamId: string | null;
  rtmpUrl: string | null;
  rtmpKey: string | null;
  hlsUrl: string | null;
  source: Source;
  onStreamEnded?: () => void;
}

type HealthState = "connecting" | "live" | "reconnecting" | "ended" | "error";

const HEALTH_POLL_MS = 5_000;

export default function HostScreen({
  title,
  category,
  access,
  ppvPrice,
  streamId,
  rtmpUrl,
  rtmpKey,
  source,
  onStreamEnded,
}: HostScreenProps): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { displayName, balance } = useApp();

  const { state: permState, request: requestPermissions } =
    useStreamingPermissions(true);

  const [healthState, setHealthState] = useState<HealthState>("connecting");
  const [health, setHealth] = useState<StreamHealth | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [earned, setEarned] = useState<number>(0);
  const [ending, setEnding] = useState<boolean>(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const pulse = useRef(new Animated.Value(0)).current;

  // ---- ON-AIR pulse ----
  useEffect(() => {
    if (healthState !== "live") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [healthState, pulse]);

  // ---- real health polling (encoder sources only — phone manages its own
  // session state and Mux would report "idle" forever without RTMP) ----
  useEffect(() => {
    if (!streamId || source === "phone") return;
    let cancelled = false;

    const poll = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const h = await getStreamHealth(streamId);
        if (cancelled) return;
        setHealth(h);
        setHealthState(
          h.status === "live" ? "live"
          : h.status === "reconnecting" ? "reconnecting"
          : h.status === "ended" ? "ended"
          : h.status === "error" ? "error"
          : "connecting",
        );
        setElapsedSec(h.elapsedSec);
      } catch (err) {
        console.log("[povme] health poll error", err);
      }
    };

    poll();
    const interval = setInterval(poll, HEALTH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [streamId, source]);

  // ---- copy RTMP key / URL ----
  const copyKey = useCallback(async (): Promise<void> => {
    if (!rtmpKey) return;
    await Clipboard.setStringAsync(rtmpKey);
    setCopiedKey(true);
    haptic("success");
    setTimeout(() => setCopiedKey(false), 2000);
  }, [rtmpKey]);

  const copyUrl = useCallback(async (): Promise<void> => {
    if (!rtmpUrl) return;
    await Clipboard.setStringAsync(rtmpUrl);
    setCopiedUrl(true);
    haptic("success");
    setTimeout(() => setCopiedUrl(false), 2000);
  }, [rtmpUrl]);

  // ---- end stream ----
  const endStream = useCallback(async (): Promise<void> => {
    if (ending) return;
    setEnding(true);
    setEndError(null);
    haptic("heavy");
    try {
      if (streamId) {
        await endLiveStream(streamId, `Replay: ${title}`);
      }
      setHealthState("ended");
      onStreamEnded?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not end the stream.";
      setEndError(friendly(msg));
      setEnding(false);
    }
  }, [ending, streamId, title, onStreamEnded]);

  // ---- permission gate ----
  if (permState.status !== "granted" && source === "phone") {
    return (
      <PermissionGate
        status={permState.status}
        message={permState.message}
        insets={insets}
        onRequest={async () => {
          const result = await requestPermissions();
          if (!result.ok) haptic("heavy");
        }}
        onClose={() => router.back()}
      />
    );
  }

  // ---- phone source: full-screen camera broadcast (the real "start stream") ----
  if (source === "phone") {
    return (
      <PhoneBroadcast
        title={title}
        category={category}
        access={access}
        ppvPrice={ppvPrice}
        streamId={streamId}
        onExit={() => router.back()}
        onEnded={() => onStreamEnded?.()}
      />
    );
  }

  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;
  const isLive = healthState === "live";
  const isConnecting = healthState === "connecting";
  const isReconnecting = healthState === "reconnecting";
  const isEnded = healthState === "ended";
  const viewers = health?.concurrentViewers ?? 0;
  const maxViewers = health?.maxViewers ?? 0;
  const bitrateKbps = health?.peakBitrateKbps ?? 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20, paddingHorizontal: 16 }}>
      {/* ---- top bar ---- */}
      <View style={styles.topBar}>
        <Animated.View
          style={[
            styles.onAirPill,
            { opacity: isLive ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) : 1 },
          ]}
        >
          <Radio size={12} color="#fff" />
          <Text style={styles.onAirText}>
            {isLive ? "ON AIR" : isConnecting ? "CONNECTING" : isReconnecting ? "RECONNECT" : isEnded ? "ENDED" : "ERROR"}
          </Text>
        </Animated.View>
        <View style={styles.viewerPill}>
          <Eye size={11} color="#fff" />
          <Text style={styles.viewerText}>{formatCount(viewers)}</Text>
        </View>
        <PressableScale onPress={() => router.back()} scaleTo={0.9} style={{ marginLeft: "auto" }}>
          <View style={styles.closeCircle}>
            <X size={18} color={Colors.text} />
          </View>
        </PressableScale>
      </View>

      {/* ---- stream title + tags ---- */}
      <View style={styles.titleBlock}>
        <Text style={styles.streamTitle} numberOfLines={2}>
          {title || "Untitled POV stream"}
        </Text>
        <View style={styles.tagRow}>
          <Tag
            label={access === "public" ? "OPEN" : access === "subscribers" ? "SUBS" : `PPV ${formatMoney(ppvPrice ?? 0)}`}
            color={Colors.ink}
            bg={access === "ppv" ? Colors.cyan : Colors.lime}
          />
          <Tag label={category.toUpperCase()} color={Colors.text} bg="rgba(0,0,0,0.55)" />
          <Tag label={source === "chest" ? "CHEST RIG" : "DESKTOP"} color={Colors.text} bg="rgba(0,0,0,0.55)" />
        </View>
      </View>

      {/* ---- reconnect / error banner ---- */}
      {(isReconnecting || healthState === "error") && (
        <View style={styles.banner}>
          {isReconnecting ? <WifiOff size={13} color={Colors.ink} /> : <AlertCircle size={13} color={Colors.ink} />}
          <Text style={styles.bannerText}>
            {isReconnecting ? "Encoder disconnected — waiting for reconnect window…" : "Stream error. Check your encoder and try again."}
          </Text>
        </View>
      )}

      {/* ---- ended overlay ---- */}
      {isEnded ? (
        <View style={styles.endedCard}>
          <View style={styles.endedIcon}>
            <Check size={28} color={Colors.lime} />
          </View>
          <Text style={styles.endedTitle}>Stream ended</Text>
          <Text style={styles.endedBody}>
            {health?.activeAssetId
              ? "Your replay is being processed and will publish to your feed shortly."
              : "The stream has ended. Your replay will publish once Mux finalizes it."}
          </Text>
          <View style={styles.endedStats}>
            <EndedStat label="Peak viewers" value={formatCount(maxViewers)} />
            <EndedStat label="Duration" value={`${mins}:${secs.toString().padStart(2, "0")}`} />
          </View>
          <Button
            label="Back to Studio"
            variant="primary"
            onPress={() => router.replace("/(tabs)/studio")}
            style={{ marginTop: 24 }}
          />
        </View>
      ) : (
        <>
          {/* ---- RTMP encoder connect card ---- */}
          <View style={styles.encoderCard}>
            <View style={styles.encoderHeader}>
              <Server size={15} color={Colors.lime} />
              <Text style={styles.encoderTitle}>Connect your encoder</Text>
            </View>
            <Text style={styles.encoderHint}>
              Paste these into OBS, Streamlabs, or your chest rig&apos;s RTMP settings. The stream
              goes live automatically when your encoder connects.
            </Text>

            <View style={styles.rtmpRow}>
              <Text style={styles.rtmpLabel}>RTMP URL</Text>
              <Pressable onLongPress={copyUrl}>
                <View style={styles.rtmpValueWrap}>
                  <Text style={styles.rtmpValue} numberOfLines={1} selectable>
                    {rtmpUrl ?? "—"}
                  </Text>
                  <PressableScale onPress={copyUrl} scaleTo={0.9}>
                    <View style={[styles.copyBtn, copiedUrl && { backgroundColor: Colors.lime }]}>
                      {copiedUrl ? <Check size={12} color={Colors.ink} /> : <Copy size={12} color={Colors.text} />}
                    </View>
                  </PressableScale>
                </View>
              </Pressable>
            </View>

            <View style={styles.rtmpRow}>
              <Text style={styles.rtmpLabel}>Stream key</Text>
              <Pressable onLongPress={copyKey}>
                <View style={styles.rtmpValueWrap}>
                  <Text style={styles.rtmpValue} numberOfLines={1} selectable>
                    {rtmpKey ? `${rtmpKey.slice(0, 8)}••••••••` : "—"}
                  </Text>
                  <PressableScale onPress={copyKey} scaleTo={0.9}>
                    <View style={[styles.copyBtn, copiedKey && { backgroundColor: Colors.lime }]}>
                      {copiedKey ? <Check size={12} color={Colors.ink} /> : <Copy size={12} color={Colors.text} />}
                    </View>
                  </PressableScale>
                </View>
              </Pressable>
            </View>
            <Text style={styles.rtmpNote}>Long-press to reveal · tap the copy icon</Text>
          </View>

          {/* ---- live health panel ---- */}
          <View style={styles.healthSection}>
            <Text style={styles.kicker}>Stream health</Text>
            <View style={styles.healthCard}>
              <HealthRow
                label="Status"
                value={
                  isLive ? "Live" : isConnecting ? "Connecting" : isReconnecting ? "Reconnecting" : "Idle"
                }
                ok={isLive}
              />
              <HealthRow label="Viewers" value={formatCount(viewers)} ok={isLive} />
              <HealthRow label="Peak viewers" value={formatCount(maxViewers)} ok />
              <HealthRow
                label="Bitrate"
                value={bitrateKbps > 0 ? `${(bitrateKbps / 1000).toFixed(1)} mbps` : "—"}
                ok={bitrateKbps > 0}
              />
              <HealthRow
                label="Duration"
                value={`${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`}
                ok
              />
              <HealthRow
                label="Latency mode"
                value={health?.latencyMode ?? "low"}
                ok
              />
              <HealthRow
                label="Dropped frames"
                value={`${(health?.droppedFramesPct ?? 0).toFixed(1)}%`}
                ok={(health?.droppedFramesPct ?? 0) < 2}
              />
            </View>
          </View>

          {/* ---- end stream ---- */}
          {endError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{endError}</Text>
            </View>
          ) : null}
          <Button
            label={ending ? "Ending…" : "End stream"}
            variant="live"
            icon={ending ? <Loader size={16} color="#fff" /> : <Radio size={16} color="#fff" />}
            disabled={ending || isEnded}
            onPress={() => void endStream()}
            style={{ marginTop: 20 }}
          />
          <Text style={styles.legal}>
            {isLive
              ? "Ending the stream finalizes the Mux asset and auto-publishes a replay to your feed."
              : "Tap end stream to finalize the broadcast and create the replay."}
          </Text>
        </>
      )}
    </ScrollView>
  );
}

// ===========================================================================
// Permission gate
// ===========================================================================

function PermissionGate({
  status,
  message,
  insets,
  onRequest,
  onClose,
}: {
  status: string;
  message: string;
  insets: { top: number; bottom: number };
  onRequest: () => void;
  onClose: () => void;
}) {
  const isDenied = status === "denied";
  const isUnavailable = status === "unavailable";

  return (
    <View style={[styles.gateScreen, { paddingTop: insets.top + 24 }]}>
      <PressableScale onPress={onClose} scaleTo={0.9} style={styles.gateClose}>
        <View style={styles.closeCircle}>
          <X size={18} color={Colors.text} />
        </View>
      </PressableScale>
      <View style={styles.gateBody}>
        <View style={styles.gateIcon}>
          <Radio size={26} color={Colors.ink} />
        </View>
        <Text style={styles.gateTitle}>
          {isUnavailable ? "No camera available" : isDenied ? "Permissions blocked" : "Ready to monitor?"}
        </Text>
        <Text style={styles.gateMessage}>{message}</Text>
        <Button
          label={isDenied ? "Open Settings" : "Allow camera & mic"}
          variant="live"
          onPress={onRequest}
          style={{ marginTop: 22 }}
        />
      </View>
    </View>
  );
}

// ===========================================================================
// Small helpers
// ===========================================================================

function HealthRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={styles.healthRow}>
      <View style={[styles.healthDot, { backgroundColor: ok ? Colors.success : Colors.danger }]} />
      <Text style={styles.healthLabel}>{label}</Text>
      <Text style={styles.healthValue}>{value}</Text>
    </View>
  );
}

function EndedStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.endedStat}>
      <Text style={styles.endedStatLabel}>{label}</Text>
      <Text style={styles.endedStatValue}>{value}</Text>
    </View>
  );
}

function friendly(msg: string): string {
  if (msg.includes("Failed to fetch") || msg.includes("Network request failed")) {
    return "Network error. Check your connection and try again.";
  }
  if (msg.includes("exp") && msg.includes("claim")) {
    return "Your session expired. Please sign in again.";
  }
  return msg;
}

// ===========================================================================
// Styles
// ===========================================================================

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  onAirPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.magenta,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  onAirText: { color: "#fff", ...microLabel, fontSize: 10 },
  viewerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 9,
    height: 26,
    borderRadius: Radius.pill,
  },
  viewerText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  closeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: { gap: 8, marginBottom: 16 },
  streamTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  tagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: Colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    marginBottom: 16,
  },
  bannerText: { color: Colors.ink, fontSize: 12.5, fontWeight: "900", flex: 1 },
  kicker: { ...microLabel, color: Colors.lime, marginBottom: 10 },

  // encoder card
  encoderCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 16,
    gap: 12,
  },
  encoderHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  encoderTitle: { color: Colors.text, fontSize: 15, fontWeight: "900" },
  encoderHint: { color: Colors.textDim, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  rtmpRow: { gap: 6 },
  rtmpLabel: { ...microLabel, color: Colors.textDim, fontSize: 9.5 },
  rtmpValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 8,
  },
  rtmpValue: { flex: 1, color: Colors.text, fontSize: 12.5, fontWeight: "700" },
  copyBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
  },
  rtmpNote: { color: Colors.textDim, fontSize: 10.5, fontWeight: "600", marginTop: 2 },

  // health
  healthSection: { marginBottom: 16 },
  healthCard: {
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  healthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthLabel: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: "700" },
  healthValue: { color: Colors.textMid, fontSize: 12.5, fontWeight: "800" },

  // end
  errorBanner: {
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,59,48,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.3)",
    marginBottom: 12,
  },
  errorText: { color: Colors.danger, fontSize: 13, fontWeight: "700" },
  legal: { color: Colors.textDim, fontSize: 11, fontWeight: "600", lineHeight: 17, marginTop: 14 },

  // ended
  endedCard: {
    alignItems: "center",
    padding: 24,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 20,
  },
  endedIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(212,255,58,0.18)",
    borderWidth: 1,
    borderColor: "rgba(212,255,58,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  endedTitle: { color: Colors.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.7 },
  endedBody: {
    color: Colors.textMid,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
  },
  endedStats: { flexDirection: "row", gap: 12, marginTop: 24, width: "100%" },
  endedStat: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  endedStatLabel: { ...microLabel, color: Colors.textDim, fontSize: 9.5, marginBottom: 7 },
  endedStatValue: { color: Colors.text, fontSize: 19, fontWeight: "900", letterSpacing: -0.5 },

  // gate
  gateScreen: { flex: 1, backgroundColor: Colors.bg },
  gateClose: { position: "absolute", top: 0, right: 14, zIndex: 5 },
  gateBody: { flex: 1, justifyContent: "center", paddingHorizontal: 28, paddingBottom: 60 },
  gateIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  gateTitle: { color: Colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.8, marginBottom: 12 },
  gateMessage: { color: Colors.textMid, fontSize: 14.5, fontWeight: "500", lineHeight: 22 },
});
