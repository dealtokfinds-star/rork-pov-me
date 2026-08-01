/**
 * PhoneBroadcast
 * --------------
 * Full-screen "go live from this phone" surface — the fix for streams that
 * never started. The old flow provisioned Mux, then waited forever for an
 * external RTMP encoder to connect (`is_live` never flipped, the stream never
 * appeared in feeds, and the host UI sat on "CONNECTING").
 *
 * This screen makes the phone itself the broadcast session:
 *  - Live camera viewfinder (expo-camera) with flip + torch controls
 *  - A real "Start stream" action that flips `live_streams.is_live = true`
 *    (RLS: creators may update their own stream rows) so the stream instantly
 *    shows up in the Live tab, feed cards, and creator LIVE badges (realtime)
 *  - Local video recording while live (native; becomes the replay reference)
 *  - Real chat via Supabase Realtime + presence-based viewer count
 *  - End stream → `end-live-stream` edge fn (finalizes + replay), with a
 *    client-side fallback that always flips the row off-air
 */

import { CameraView } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import {
  Eye,
  Radio,
  Send,
  SwitchCamera,
  X,
  Zap,
  ZapOff,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, PressableScale, Tag, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { formatCount, formatMoney } from "@/constants/mock-data";
import { useStreamChat } from "@/hooks/useChat";
import { endLiveStream } from "@/lib/streaming/muxLive";
import { supabase } from "@/lib/supabase";
import type { ChatMessage, PovCategory, StreamAccess } from "@/types";

type Phase = "preview" | "starting" | "live" | "ending" | "ended";

interface PhoneBroadcastProps {
  title: string;
  category: PovCategory;
  access: StreamAccess;
  ppvPrice?: number;
  streamId: string | null;
  /** Exit before going live (back to setup). */
  onExit: () => void;
  /** Called after the stream has ended and the host taps "Back to Studio". */
  onEnded: () => void;
}

/** Cross-platform destructive confirm (RN Alert buttons don't render on web). */
function confirmEnd(onConfirm: () => void): void {
  if (Platform.OS === "web") {
    const ok = typeof window !== "undefined" && window.confirm("End the stream?\n\nViewers will be disconnected and your replay will be finalized.");
    if (ok) onConfirm();
    return;
  }
  Alert.alert("End the stream?", "Viewers will be disconnected and your replay will be finalized.", [
    { text: "Keep streaming", style: "cancel" },
    { text: "End stream", style: "destructive", onPress: onConfirm },
  ]);
}

export default function PhoneBroadcast({
  title,
  category,
  access,
  ppvPrice,
  streamId,
  onExit,
  onEnded,
}: PhoneBroadcastProps): React.ReactElement {
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>("preview");
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [torch, setTorch] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");

  const cameraRef = useRef<CameraView>(null);
  const recordingPromise = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const peakViewers = useRef<number>(0);
  const pulse = useRef(new Animated.Value(0)).current;
  const phaseRef = useRef<Phase>("preview");
  phaseRef.current = phase;

  const isLive = phase === "live";
  const chatActive = phase === "live" || phase === "ending";
  const { messages, viewerCount, sendChat } = useStreamChat(chatActive && streamId ? streamId : null, 60);
  // Presence counts the host too — viewers are everyone else.
  const viewers = Math.max(0, viewerCount - 1);

  // ---- ON AIR pulse ----
  useEffect(() => {
    if (!isLive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLive, pulse]);

  // ---- elapsed clock ----
  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isLive]);

  // ---- push real presence viewers to the DB so feed cards show them ----
  useEffect(() => {
    if (!isLive || !streamId) return;
    peakViewers.current = Math.max(peakViewers.current, viewers);
    const t = setTimeout(() => {
      supabase
        .from("live_streams")
        .update({ viewers, max_viewers: peakViewers.current })
        .eq("id", streamId)
        .then(({ error: e }) => {
          if (e) console.log("[povme] viewer count sync failed", e.message);
        });
    }, 1500);
    return () => clearTimeout(t);
  }, [viewers, isLive, streamId]);

  // ---- best-effort off-air on unmount while still live ----
  useEffect(() => {
    return () => {
      if ((phaseRef.current === "live" || phaseRef.current === "starting") && streamId) {
        supabase
          .from("live_streams")
          .update({ is_live: false, ended_at: new Date().toISOString(), health_status: "ended" })
          .eq("id", streamId)
          .then(({ error: e }) => {
            if (e) console.log("[povme] off-air cleanup failed", e.message);
          });
      }
    };
  }, [streamId]);

  /** Flip the DB row live + start the local recording. */
  const startStream = useCallback(async (): Promise<void> => {
    if (!streamId) {
      setError("Stream session missing — go back and try again.");
      return;
    }
    setPhase("starting");
    setError(null);
    haptic("heavy");
    try {
      const { error: upErr } = await supabase
        .from("live_streams")
        .update({
          is_live: true,
          health_status: "live",
          started_at: new Date().toISOString(),
        })
        .eq("id", streamId);
      if (upErr) throw new Error(upErr.message);

      // Local recording — native only (web preview can't record); the file
      // doubles as the replay reference if Mux never receives RTMP.
      if (Platform.OS !== "web" && cameraRef.current) {
        try {
          recordingPromise.current = cameraRef.current.recordAsync({ maxDuration: 3600 });
        } catch (err) {
          console.log("[povme] local recording unavailable", err);
        }
      }

      setPhase("live");
      haptic("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start the stream.";
      setError(friendly(msg));
      setPhase("preview");
      haptic("heavy");
    }
  }, [streamId]);

  /** End: stop recording, finalize via edge fn, always flip the row off-air. */
  const doEndStream = useCallback(async (): Promise<void> => {
    setPhase("ending");
    haptic("heavy");
    try {
      cameraRef.current?.stopRecording();
    } catch {
      // camera may already be torn down
    }
    recordingPromise.current = null;

    if (streamId) {
      try {
        await endLiveStream(streamId, `Replay: ${title}`);
      } catch (err) {
        console.log("[povme] end-live-stream failed, falling back", err);
        const { error: e } = await supabase
          .from("live_streams")
          .update({ is_live: false, ended_at: new Date().toISOString(), health_status: "ended" })
          .eq("id", streamId);
        if (e) console.log("[povme] off-air fallback failed", e.message);
      }
    }
    setPhase("ended");
    haptic("success");
  }, [streamId, title]);

  const sendMessage = useCallback(async (): Promise<void> => {
    const text = draft.trim();
    if (text.length === 0) return;
    setDraft("");
    const result = await sendChat(text);
    if (!result.ok) {
      setChatError(result.error ?? "Message not sent");
      setTimeout(() => setChatError(null), 2500);
    }
  }, [draft, sendChat]);

  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;

  // ---- ended summary ----
  if (phase === "ended") {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 20, paddingHorizontal: 16 }]}>
        <View style={styles.endedCard}>
          <View style={styles.endedIcon}>
            <Radio size={26} color={Colors.lime} />
          </View>
          <Text style={styles.endedTitle}>Stream ended</Text>
          <Text style={styles.endedBody}>
            Nice broadcast. Your replay is being finalized and will publish to your feed shortly.
          </Text>
          <View style={styles.endedStats}>
            <View style={styles.endedStat}>
              <Text style={styles.endedStatLabel}>PEAK VIEWERS</Text>
              <Text style={styles.endedStatValue}>{formatCount(peakViewers.current)}</Text>
            </View>
            <View style={styles.endedStat}>
              <Text style={styles.endedStatLabel}>DURATION</Text>
              <Text style={styles.endedStatValue}>
                {mins}:{secs.toString().padStart(2, "0")}
              </Text>
            </View>
          </View>
          <Button label="Back to Studio" onPress={onEnded} style={{ marginTop: 24 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* ---- full-bleed viewfinder ---- */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
        active
        mirror={facing === "front"}
        enableTorch={torch}
        videoQuality="1080p"
        onMountError={(e) => {
          console.log("[povme] camera mount error", e.message);
          setError("Camera unavailable. Check permissions or try another device.");
        }}
      />
      <LinearGradient
        colors={["rgba(8,8,10,0.65)", "transparent", "rgba(8,8,10,0.82)"]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ---- top bar ---- */}
      <View style={[styles.topBar, { top: insets.top + 10 }]}>
        <Animated.View
          style={[
            styles.onAirPill,
            !isLive && { backgroundColor: "rgba(0,0,0,0.55)" },
            { opacity: isLive ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) : 1 },
          ]}
        >
          <Radio size={12} color="#fff" />
          <Text style={styles.onAirText}>
            {phase === "live" ? "ON AIR" : phase === "starting" ? "STARTING" : phase === "ending" ? "ENDING" : "PREVIEW"}
          </Text>
        </Animated.View>
        {isLive ? (
          <>
            <View style={styles.metaPill}>
              <Eye size={11} color="#fff" />
              <Text style={styles.metaPillText}>{formatCount(viewers)}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>
                {mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
              </Text>
            </View>
          </>
        ) : null}
        <PressableScale
          onPress={() => {
            if (isLive) {
              confirmEnd(() => void doEndStream());
            } else {
              onExit();
            }
          }}
          scaleTo={0.9}
          style={{ marginLeft: "auto" }}
        >
          <View style={styles.closeCircle}>
            <X size={18} color={Colors.text} />
          </View>
        </PressableScale>
      </View>

      {/* ---- title + access tags ---- */}
      <View style={[styles.titleBlock, { top: insets.top + 58 }]}>
        <Text style={styles.streamTitle} numberOfLines={1}>
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

      {/* ---- camera controls (right rail) ---- */}
      <View style={[styles.controlRail, { top: insets.top + 120 }]}>
        <PressableScale onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))} scaleTo={0.88}>
          <View style={styles.controlBtn}>
            <SwitchCamera size={19} color={Colors.text} />
          </View>
        </PressableScale>
        {facing === "back" ? (
          <PressableScale onPress={() => setTorch((t) => !t)} scaleTo={0.88}>
            <View style={[styles.controlBtn, torch && { backgroundColor: Colors.gold }]}>
              {torch ? <Zap size={19} color={Colors.ink} /> : <ZapOff size={19} color={Colors.text} />}
            </View>
          </PressableScale>
        ) : null}
      </View>

      {/* ---- bottom: preview CTA or live chat ---- */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {phase === "preview" || phase === "starting" ? (
          <>
            <Text style={styles.previewHint}>
              Frame your shot. The moment you start, this stream appears in the live feed and your
              subscribers get notified.
            </Text>
            <Button
              label={phase === "starting" ? "Starting…" : "Start stream"}
              variant="live"
              icon={<Radio size={17} color="#fff" />}
              disabled={phase === "starting" || !streamId}
              onPress={() => void startStream()}
            />
          </>
        ) : (
          <>
            {chatError ? (
              <View style={styles.chatErrorPill}>
                <Text style={styles.chatErrorText}>{chatError}</Text>
              </View>
            ) : null}
            <View style={styles.chatFeed} pointerEvents="none">
              {messages.slice(-6).map((m) => (
                <HostChatRow key={m.id} message={m} />
              ))}
              {messages.length === 0 ? (
                <Text style={styles.chatEmpty}>Chat is open — say hi to early viewers.</Text>
              ) : null}
            </View>
            <View style={styles.inputRow}>
              <View style={styles.inputBox}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Talk to your viewers…"
                  placeholderTextColor={Colors.textDim}
                  style={styles.input}
                  onSubmitEditing={() => void sendMessage()}
                  returnKeyType="send"
                  maxLength={240}
                />
                <PressableScale onPress={() => void sendMessage()} scaleTo={0.85}>
                  <View style={styles.sendCircle}>
                    <Send size={14} color={Colors.ink} />
                  </View>
                </PressableScale>
              </View>
              <PressableScale
                onPress={() => confirmEnd(() => void doEndStream())}
                scaleTo={0.92}
                disabled={phase === "ending"}
              >
                <View style={styles.endBtn}>
                  <Text style={styles.endBtnText}>{phase === "ending" ? "Ending…" : "End"}</Text>
                </View>
              </PressableScale>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function HostChatRow({ message }: { message: ChatMessage }) {
  if (message.kind === "tip" || message.kind === "gift") {
    return (
      <View style={styles.tipMsg}>
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
    <Text style={styles.chatText} numberOfLines={2}>
      <Text style={{ color: message.color, fontWeight: "900" as const }}>{message.user}</Text>
      <Text>  {message.text}</Text>
    </Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink },
  topBar: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 5,
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
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 9,
    height: 26,
    borderRadius: Radius.pill,
  },
  metaPillText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  closeCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: { position: "absolute", left: 14, right: 70, gap: 7, zIndex: 4 },
  streamTitle: { color: Colors.text, fontSize: 16, fontWeight: "900", letterSpacing: -0.4 },
  tagRow: { flexDirection: "row", gap: 6 },
  controlRail: { position: "absolute", right: 14, gap: 10, zIndex: 4 },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, gap: 12 },
  previewHint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 10,
  },
  errorBanner: {
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,59,48,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.4)",
  },
  errorText: { color: "#FF6B60", fontSize: 12.5, fontWeight: "700" },
  chatFeed: { gap: 6, paddingHorizontal: 2 },
  chatEmpty: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600" },
  chatText: { color: "#fff", fontSize: 13, fontWeight: "600", lineHeight: 18 },
  joinMsg: { color: "rgba(255,255,255,0.45)", fontSize: 11.5, fontWeight: "700" },
  tipMsg: {
    alignSelf: "flex-start",
    backgroundColor: Colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
  },
  tipMsgText: { color: Colors.ink, fontSize: 12, fontWeight: "900" },
  chatErrorPill: {
    alignSelf: "center",
    backgroundColor: "rgba(255,182,39,0.95)",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  chatErrorText: { color: Colors.ink, fontSize: 12, fontWeight: "900" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  endBtn: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: Radius.pill,
    backgroundColor: Colors.magenta,
    alignItems: "center",
    justifyContent: "center",
  },
  endBtnText: { color: "#fff", fontSize: 13.5, fontWeight: "900" },
  endedCard: {
    alignItems: "center",
    padding: 24,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 40,
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
});
