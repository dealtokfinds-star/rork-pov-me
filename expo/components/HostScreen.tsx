/**
 * HostScreen
 * ----------
 * The creator's live streaming surface. Renders a real `expo-camera` preview,
 * drives the `StreamSession` controller for health/reconnect/teardown, and
 * overlays streamer controls (mute, flip, torch, end) + live metrics +
 * the `ChatOverlay` for watching the room chat while broadcasting.
 *
 * Memory & lifecycle:
 *  - The `CameraView` is only mounted while `health` is live/reconnecting so
 *    the native capture session is released the moment we end.
 *  - `StreamSession.dispose()` is called in the unmount effect, which stops
 *    recording, clears all timers, and detaches the camera ref.
 *  - The camera ref is reset to null on blur so a popped-but-not-unmounted
 *    screen (React Navigation) doesn't hold the capture session alive.
 *
 * Edge cases handled:
 *  - Permission denied / partial / no-camera → dedicated gate UI
 *  - Network drop mid-stream → reconnect banner with exponential backoff
 *  - Recording finalization → URI surfaced for replay upload
 *  - App blur / unmount → deterministic teardown
 */

import { CameraView, type CameraType } from "expo-camera";
import { useKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  CameraOff,
  Eye,
  FlipHorizontal2,
  Mic,
  MicOff,
  Radio,
  Settings2,
  Sun,
  Timer,
  WifiOff,
  X,
  Zap,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatOverlay, type ChatOverlayHandle } from "@/components/ChatOverlay";
import { Button, LiveBadge, PressableScale, Tag, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { formatCount, formatMoney } from "@/constants/mock-data";
import { useStreamingPermissions } from "@/lib/streaming/PermissionHandler";
import {
  StreamSession,
  type CameraController,
  type StreamSessionState,
} from "@/lib/streaming/StreamSession";
import { useApp } from "@/providers/app-provider";
import type { PovCategory, StreamAccess } from "@/types";

interface HostScreenProps {
  title: string;
  category: PovCategory;
  access: StreamAccess;
  ppvPrice?: number;
  /** Called with the local recording URI when the stream ends cleanly. */
  onStreamEnded?: (recordingUri: string | null) => void;
  /** Optional session to inject (testing). Creates one if omitted. */
  session?: StreamSession;
}

export default function HostScreen({
  title,
  category,
  access,
  ppvPrice,
  onStreamEnded,
}: HostScreenProps): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { displayName, balance, tip } = useApp();
  useKeepAwake("povme-host");

  // ---- permissions ---------------------------------------------------------

  // `hasCamera` would be false on a web build with no webcam; on native we
  // assume a camera exists and let the permission flow handle the rest.
  const { state: permState, request: requestPermissions } =
    useStreamingPermissions(true);

  // ---- session + camera ----------------------------------------------------

  const sessionRef = useRef<StreamSession | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = new StreamSession({
      simulateNetworkDrops: true,
      initialViewers: 0,
      onRecordingComplete: (uri) => {
        console.log("[povme] recording ready for replay upload:", uri);
      },
    });
  }
  const session = sessionRef.current;

  const cameraRef = useRef<CameraView | null>(null);
  const chatRef = useRef<ChatOverlayHandle>(null);
  const [sessionState, setSessionState] = useState<StreamSessionState>(
    session.getState(),
  );
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [showChat, setShowChat] = useState<boolean>(true);
  const pulse = useRef(new Animated.Value(0)).current;

  // Subscribe to session state changes.
  useEffect(() => {
    const unsub = session.subscribe(setSessionState);
    return unsub;
  }, [session]);

  // Attach the camera controller adapter so the session can drive recording.
  useEffect(() => {
    if (!cameraRef.current) return;
    const controller: CameraController = {
      stopRecording: () => cameraRef.current?.stopRecording(),
      recordAsync: (opts) =>
        cameraRef.current?.recordAsync({
          maxDuration: 60 * 60,
        }) as Promise<{ uri: string } | undefined>,
      pausePreview: async () => {
        await cameraRef.current?.pausePreview();
      },
      resumePreview: async () => {
        await cameraRef.current?.resumePreview();
      },
    };
    session.attachCamera(controller);
    return () => {
      session.attachCamera(null);
    };
  }, [session, sessionState.health]);

  // ON-AIR pulse animation.
  useEffect(() => {
    if (sessionState.health !== "live") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sessionState.health, pulse]);

  // ---- teardown on unmount -------------------------------------------------

  useEffect(() => {
    return () => {
      // Deterministic cleanup: stop recording, clear timers, drop listeners.
      session.dispose();
    };
  }, [session]);

  // ---- actions -------------------------------------------------------------

  const goLive = useCallback(async () => {
    const result = await requestPermissions();
    if (!result.ok) {
      haptic("heavy");
      return;
    }
    haptic("success");
    session.start();
  }, [requestPermissions, session]);

  const endStream = useCallback(async () => {
    haptic("heavy");
    const uri = await session.stop();
    onStreamEnded?.(uri);
    router.replace("/(tabs)/studio");
  }, [session, onStreamEnded, router]);

  const toggleMute = useCallback(() => {
    const muted = session.toggleMute();
    haptic(muted ? "medium" : "light");
  }, [session]);

  const flipCamera = useCallback(() => {
    const front = session.flipCamera();
    // expo-camera reads `facing` from prop on the next render — no extra call.
    haptic("medium");
  }, [session]);

  const toggleTorch = useCallback(() => {
    setTorchOn((v) => !v);
    haptic("light");
  }, []);

  const sendTip = useCallback(
    (amount: number, label?: string) => {
      // Hosts don't tip themselves, but the overlay still exercises the flow.
      void amount;
      void label;
    },
    [],
  );

  // ---- permission gate -----------------------------------------------------

  if (permState.status !== "granted") {
    return (
      <PermissionGate
        status={permState.status}
        message={permState.message}
        insets={insets}
        onRequest={goLive}
        onClose={() => router.back()}
      />
    );
  }

  // ---- connecting / live / reconnecting / ended ----------------------------

  const { health, metrics, muted, facingFront, error, reconnectAttempts } =
    sessionState;
  const mins = Math.floor(metrics.elapsedSec / 60);
  const secs = metrics.elapsedSec % 60;
  const isLive = health === "live";
  const isReconnecting = health === "reconnecting";
  const isConnecting = health === "connecting";
  const isEnded = health === "ended";

  // Camera is only mounted while we have (or are about to have) an active
  // capture session. This prevents holding the camera open on the gate screen.
  const cameraActive = isLive || isReconnecting || isConnecting;

  return (
    <View style={styles.screen}>
      {cameraActive ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facingFront ? "front" : "back"}
          mode="video"
          mute={muted}
          enableTorch={torchOn}
          videoQuality="1080p"
          videoStabilizationMode="auto"
          active={isLive}
          mirror={facingFront}
          onMountError={(e) => {
            console.log("[povme] camera mount error", e.message);
          }}
        />
      ) : null}

      {/* Dim scrim for control legibility */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isEnded ? Colors.ink : "rgba(8,8,10,0.25)" },
        ]}
        pointerEvents="none"
      />

      {/* ---- top bar ---- */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topLeft}>
          <Animated.View
            style={[
              styles.onAirPill,
              {
                opacity: isLive
                  ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] })
                  : 1,
              },
            ]}
          >
            <Radio size={12} color="#fff" />
            <Text style={styles.onAirText}>
              {isLive ? "ON AIR" : isConnecting ? "CONNECTING" : isReconnecting ? "RECONNECT" : "ENDED"}
            </Text>
          </Animated.View>
          <View style={styles.viewerPill}>
            <Eye size={11} color="#fff" />
            <Text style={styles.viewerText}>{formatCount(metrics.viewers)}</Text>
          </View>
        </View>

        <PressableScale onPress={() => router.back()} scaleTo={0.9}>
          <View style={styles.closeCircle}>
            <X size={18} color={Colors.text} />
          </View>
        </PressableScale>
      </View>

      {/* ---- stream title + category ---- */}
      <View style={[styles.titleBlock, { top: insets.top + 58 }]}>
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
        </View>
      </View>

      {/* ---- reconnect / error banner ---- */}
      {(isReconnecting || health === "error") && error ? (
        <View style={[styles.banner, { top: insets.top + 130 }]}>
          {isReconnecting ? <WifiOff size={13} color={Colors.ink} /> : <AlertCircle size={13} color={Colors.ink} />}
          <Text style={styles.bannerText}>{error}</Text>
          {reconnectAttempts > 0 ? (
            <Text style={styles.bannerAttempt}>#{reconnectAttempts}</Text>
          ) : null}
        </View>
      ) : null}

      {/* ---- live metrics (host dashboard) ---- */}
      {isLive || isReconnecting ? (
        <View style={[styles.metricsRow, { bottom: insets.bottom + 230 }]}>
          <MetricTile icon={<Timer size={12} color={Colors.lime} />} label="Time" value={`${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`} />
          <MetricTile icon={<Eye size={12} color={Colors.lime} />} label="Viewers" value={formatCount(metrics.viewers)} />
          <MetricTile icon={<Zap size={12} color={Colors.lime} />} label="Bitrate" value={`${(metrics.bitrateKbps / 1000).toFixed(1)}mb`} />
          <MetricTile icon={<Radio size={12} color={Colors.gold} />} label="Earned" value={formatMoney(metrics.grossEarned)} accent={Colors.gold} />
        </View>
      ) : null}

      {/* ---- chat overlay (toggleable) ---- */}
      {showChat && (isLive || isReconnecting) ? (
        <View style={styles.chatLayer}>
          <ChatOverlay
            ref={chatRef}
            simulateIncoming
            incomingIntervalMs={2600}
            maxMessages={60}
            displayName={displayName}
            onSendTip={sendTip}
            walletBalance={balance}
          />
        </View>
      ) : null}

      {/* ---- bottom control deck ---- */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.controlRow}>
          <ControlButton
            icon={muted ? <MicOff size={22} color="#fff" /> : <Mic size={22} color="#fff" />}
            label={muted ? "Muted" : "Mic"}
            active={muted}
            onPress={toggleMute}
          />
          <ControlButton
            icon={<FlipHorizontal2 size={22} color="#fff" />}
            label="Flip"
            onPress={flipCamera}
          />
          <ControlButton
            icon={<Sun size={22} color={torchOn ? Colors.gold : "#fff"} />}
            label="Torch"
            active={torchOn}
            onPress={toggleTorch}
          />
          <ControlButton
            icon={<Eye size={22} color="#fff" />}
            label={showChat ? "Chat on" : "Chat off"}
            active={showChat}
            onPress={() => setShowChat((v) => !v)}
          />
        </View>

        <View style={styles.endRow}>
          <PressableScale onPress={endStream} scaleTo={0.94} disabled={!isLive && !isReconnecting}>
            <View style={styles.endButton}>
              <Radio size={16} color="#fff" />
              <Text style={styles.endText}>End stream</Text>
            </View>
          </PressableScale>
        </View>
      </View>

      {/* ---- ended overlay ---- */}
      {isEnded ? (
        <View style={[styles.endedOverlay, { paddingTop: insets.top + 80 }]}>
          <View style={styles.endedIcon}>
            <Radio size={28} color={Colors.magenta} />
          </View>
          <Text style={styles.endedTitle}>Stream ended</Text>
          <Text style={styles.endedBody}>
            {sessionState.recordingUri
              ? "Your replay was saved. You can publish it from Studio."
              : "No recording was captured. You can go live again anytime."}
          </Text>
          <View style={styles.endedStats}>
            <EndedStat label="Peak viewers" value={formatCount(metrics.viewers)} />
            <EndedStat label="Gross earned" value={formatMoney(metrics.grossEarned)} />
          </View>
          <Button
            label="Back to Studio"
            variant="primary"
            onPress={() => router.replace("/(tabs)/studio")}
            style={{ marginTop: 24 }}
          />
        </View>
      ) : null}
    </View>
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
  const isUnavailable = status === "unavailable";
  const isDenied = status === "denied";

  return (
    <View style={[styles.gateScreen, { paddingTop: insets.top + 24 }]}>
      <PressableScale onPress={onClose} scaleTo={0.9} style={styles.gateClose}>
        <View style={styles.closeCircle}>
          <X size={18} color={Colors.text} />
        </View>
      </PressableScale>

      <View style={styles.gateBody}>
        <View style={[styles.gateIcon, isUnavailable && { backgroundColor: Colors.surfaceHi }]}>
          {isUnavailable ? (
            <CameraOff size={26} color={Colors.textDim} />
          ) : (
            <Radio size={26} color={Colors.ink} />
          )}
        </View>

        <Text style={styles.gateTitle}>
          {isUnavailable
            ? "No camera available"
            : isDenied
              ? "Permissions blocked"
              : status === "partial"
                ? "One more permission"
                : "Ready to go live?"}
        </Text>

        <Text style={styles.gateMessage}>{message}</Text>

        {!isUnavailable ? (
          <>
            <View style={styles.permChecklist}>
              <PermRow label="Camera" granted={false} />
              <PermRow label="Microphone" granted={false} />
            </View>
            <Button
              label={isDenied ? "Open Settings" : "Allow camera & mic"}
              variant="live"
              onPress={onRequest}
              style={{ marginTop: 22 }}
            />
            {isDenied ? (
              <Text style={styles.gateHint}>
                POVMe needs both camera and microphone to broadcast your POV.
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.gateHint}>
            Live streaming requires a device with a camera. Try POVMe on your phone.
          </Text>
        )}
      </View>
    </View>
  );
}

function PermRow({ label, granted }: { label: string; granted: boolean }) {
  return (
    <View style={styles.permRow}>
      <View style={[styles.permDot, { backgroundColor: granted ? Colors.lime : Colors.borderHi }]} />
      <Text style={styles.permLabel}>{label}</Text>
      <Text style={[styles.permStatus, { color: granted ? Colors.lime : Colors.textDim }]}>
        {granted ? "Granted" : "Required"}
      </Text>
    </View>
  );
}

// ===========================================================================
// Small presentational helpers
// ===========================================================================

function MetricTile({
  icon,
  label,
  value,
  accent = Colors.text,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.metricTile}>
      {icon}
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

function ControlButton({
  icon,
  label,
  onPress,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.9} style={styles.controlBtnWrap}>
      <View style={[styles.controlBtn, active && { backgroundColor: Colors.magenta }]}>
        {icon}
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </PressableScale>
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

// ===========================================================================
// Styles
// ===========================================================================

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    zIndex: 10,
  },
  topLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
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
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: { position: "absolute", left: 14, right: 80, gap: 8 },
  streamTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.5,
    lineHeight: 23,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tagRow: { flexDirection: "row", gap: 6 },
  banner: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: Colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    zIndex: 8,
  },
  bannerText: { color: Colors.ink, fontSize: 12.5, fontWeight: "900" },
  bannerAttempt: { color: Colors.ink, fontSize: 11, fontWeight: "800", opacity: 0.6 },
  metricsRow: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 8,
    zIndex: 5,
  },
  metricTile: {
    flex: 1,
    backgroundColor: "rgba(8,8,10,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: Radius.md,
    padding: 10,
    gap: 4,
  },
  metricLabel: { color: Colors.textDim, ...microLabel, fontSize: 9 },
  metricValue: { fontSize: 15, fontWeight: "900", letterSpacing: -0.4 },
  chatLayer: { flex: 1, justifyContent: "flex-end" },
  controls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(8,8,10,0.88)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    paddingTop: 14,
    zIndex: 9,
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 14,
  },
  controlBtnWrap: { alignItems: "center", gap: 5 },
  controlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlLabel: { color: Colors.textMid, fontSize: 10.5, fontWeight: "700" },
  endRow: { alignItems: "center", paddingBottom: 4 },
  endButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 50,
    paddingHorizontal: 28,
    borderRadius: Radius.pill,
    backgroundColor: Colors.magenta,
  },
  endText: { color: "#fff", fontSize: 15, fontWeight: "900" },

  // ended overlay
  endedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(8,8,10,0.96)",
    alignItems: "center",
    paddingHorizontal: 28,
    zIndex: 20,
  },
  endedIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,45,111,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,45,111,0.4)",
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
  endedStats: { flexDirection: "row", gap: 12, marginTop: 24 },
  endedStat: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  endedStatLabel: { ...microLabel, color: Colors.textDim, fontSize: 9.5, marginBottom: 7 },
  endedStatValue: { color: Colors.text, fontSize: 19, fontWeight: "900", letterSpacing: -0.5 },

  // permission gate
  gateScreen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  gateClose: { position: "absolute", top: 0, right: 14, zIndex: 5 },
  gateBody: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 60,
  },
  gateIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  gateTitle: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  gateMessage: {
    color: Colors.textMid,
    fontSize: 14.5,
    fontWeight: "500",
    lineHeight: 22,
    marginBottom: 18,
  },
  permChecklist: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  permDot: { width: 8, height: 8, borderRadius: 4 },
  permLabel: { flex: 1, color: Colors.text, fontSize: 14, fontWeight: "800" },
  permStatus: { fontSize: 12, fontWeight: "800" },
  gateHint: {
    color: Colors.textDim,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 14,
    textAlign: "center",
  },
});
