import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Camera,
  Check,
  Gauge,
  Lock,
  Loader,
  MessageSquareOff,
  Monitor,
  Radio,
  ShieldCheck,
  Smartphone,
  Timer,
  UserPlus,
  Users,
} from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import { Animated, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { Button, Chip, PressableScale, Tag, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { CATEGORIES, formatCount, formatMoney } from "@/constants/mock-data";
import { useApp } from "@/providers/app-provider";
import { createLiveStream, type CreatedLiveStream } from "@/lib/streaming/muxLive";
import { callEdge } from "@/lib/edge";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import type { PovCategory, StreamAccess } from "@/types";

type Source = "chest" | "phone" | "desktop";

const PPV_PRICES = [3.99, 6.99, 9.99, 14.99];

export default function GoLiveScreen() {
  const router = useRouter();
  const { creatorPrice, creatorStats, kycStatus } = useApp();
  const track = useTrackEvent();
  const isVerified = kycStatus === "verified";
  const [title, setTitle] = useState<string>("");
  const [category, setCategory] = useState<PovCategory>("founder");
  const [access, setAccess] = useState<StreamAccess>("public");
  const [ppvPrice, setPpvPrice] = useState<number>(6.99);
  const [source, setSource] = useState<Source>("phone");
  const [slowMode, setSlowMode] = useState<boolean>(true);
  const [replay, setReplay] = useState<boolean>(true);
  const [coHost, setCoHost] = useState<boolean>(false);
  const [subOnlyChat, setSubOnlyChat] = useState<boolean>(false);

  // Provisioning state — calling create-live-stream (real Mux).
  const [provisioning, setProvisioning] = useState<boolean>(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  const [showConsent, setShowConsent] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);

  /** Show the one-time 18+/consent sheet, then run the start-stream action. */
  const gateWithConsent = useCallback(async (action: () => void): Promise<void> => {
    const ack = await AsyncStorage.getItem("golive_consent_v1");
    if (ack === "true") {
      action();
      return;
    }
    setPendingAction(() => action);
    setShowConsent(true);
  }, []);

  const confirmConsent = useCallback(async (): Promise<void> => {
    await AsyncStorage.setItem("golive_consent_v1", "true");
    haptic("success");
    setShowConsent(false);
    const action = pendingAction;
    setPendingAction(null);
    if (action) action();
  }, [pendingAction]);

  /**
   * Provision a real Mux Live Stream, then route to the host screen with the
   * stream id + RTMP key so the host UI can show the encoder-connect card and
   * poll real health.
   */
  const goLive = useCallback(async (): Promise<void> => {
    setProvisioning(true);
    setProvisionError(null);
    haptic("heavy");
    try {
      const stream: CreatedLiveStream = await createLiveStream({
        title: title.trim().length > 0 ? title.trim() : "Untitled POV stream",
        category,
        access,
        ppvPrice: access === "ppv" ? ppvPrice : undefined,
        streamSource: source,
        replayEnabled: replay,
        slowMode,
        subOnlyChat,
        latencyMode: "low",
      });

      haptic("success");
      // Record go-live + fan out push notifications to followers (fire-and-forget).
      track("go_live", { stream_id: stream.streamId });
      callEdge("notify-live", { stream_id: stream.streamId }).catch(() => {});
      // Route to the host screen with the real stream data.
      const qp = new URLSearchParams({
        title: title.trim().length > 0 ? title.trim() : "Untitled POV stream",
        category,
        access,
        streamId: stream.streamId,
        rtmpUrl: stream.rtmpIngestUrl ?? "",
        rtmpKey: stream.rtmpStreamKey ?? "",
        hlsUrl: stream.hlsPlaybackUrl ?? "",
        source,
      });
      if (access === "ppv" && ppvPrice) qp.set("ppvPrice", String(ppvPrice));
      router.push(`/host?${qp.toString()}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start the live stream.";
      setProvisionError(friendly(msg));
      haptic("heavy");
    } finally {
      setProvisioning(false);
    }
  }, [title, category, access, ppvPrice, source, replay, slowMode, subOnlyChat, router, track]);

  // ---- KYC verification gate ----
  if (!isVerified) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center", padding: 30 }]}>
        <View style={styles.kycGateIcon}>
          <ShieldCheck size={28} color={Colors.lime} />
        </View>
        <Text style={styles.kycGateTitle}>Verify your identity to go live</Text>
        <Text style={styles.kycGateBody}>
          {kycStatus === "pending"
            ? "Your verification is under review. You'll be able to go live once it's approved."
            : kycStatus === "rejected"
              ? "Your verification was rejected. Please resubmit from the creator setup."
              : "Complete identity verification to start broadcasting live POV streams."}
        </Text>
        <Button
          label={kycStatus === "pending" ? "View status" : "Go to verification"}
          onPress={() => router.push("/become-creator")}
          style={{ marginTop: 24 }}
        />
        <Button label="Back" variant="ghost" onPress={() => router.back()} style={{ marginTop: 10 }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 44 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>Set up your live POV</Text>

      <Text style={styles.label}>Stream title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="LIVE: closing the round, ride with me"
        placeholderTextColor={Colors.textDim}
        style={styles.input}
        maxLength={80}
      />

      <Text style={styles.label}>Camera source</Text>
      <View style={{ gap: 9 }}>
        <SourceOption
          icon={<Smartphone size={17} color={source === "phone" ? Colors.ink : Colors.magenta} />}
          title="This phone's camera"
          body="Go live straight from this phone — camera, chat and viewers in one screen"
          active={source === "phone"}
          onPress={() => setSource("phone")}
        />
        <SourceOption
          icon={<Camera size={17} color={source === "chest" ? Colors.ink : Colors.magenta} />}
          title="Chest rig / action cam"
          body="RTMP key — GoPro, Insta360, glasses cam"
          active={source === "chest"}
          onPress={() => setSource("chest")}
        />
        <SourceOption
          icon={<Monitor size={17} color={source === "desktop" ? Colors.ink : Colors.magenta} />}
          title="Desktop encoder"
          body="OBS / Streamlabs with overlays"
          active={source === "desktop"}
          onPress={() => setSource("desktop")}
        />
      </View>

      <Text style={styles.label}>Category</Text>
      <View style={styles.chipWrap}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c.id}
            label={c.label}
            emoji={c.emoji}
            accent={c.accent}
            active={category === c.id}
            onPress={() => setCategory(c.id)}
          />
        ))}
      </View>

      <Text style={styles.label}>Who can watch</Text>
      <View style={{ gap: 9 }}>
        <SourceOption
          icon={<Users size={17} color={access === "public" ? Colors.ink : Colors.lime} />}
          title="Public"
          body="Anyone can watch, chat, clip and share"
          active={access === "public"}
          accent={Colors.lime}
          onPress={() => setAccess("public")}
        />
        <SourceOption
          icon={<Lock size={17} color={access === "subscribers" ? Colors.ink : Colors.lime} />}
          title={`Subscribers only · ${formatMoney(creatorPrice)}/mo`}
          body={`Your ${formatCount(creatorStats.subscriberCount)} subs get in free`}
          active={access === "subscribers"}
          accent={Colors.lime}
          onPress={() => setAccess("subscribers")}
        />
        <SourceOption
          icon={<Gauge size={17} color={access === "ppv" ? Colors.ink : Colors.cyan} />}
          title="Pay-per-view event"
          body="One-time ticket for a special POV"
          active={access === "ppv"}
          accent={Colors.cyan}
          onPress={() => setAccess("ppv")}
        />
      </View>

      {access === "ppv" ? (
        <>
          <Text style={styles.label}>Ticket price</Text>
          <View style={styles.chipWrap}>
            {PPV_PRICES.map((p) => (
              <Chip key={p} label={`$${p}`} accent={Colors.cyan} active={ppvPrice === p} onPress={() => setPpvPrice(p)} />
            ))}
          </View>
          <Text style={styles.hint}>You keep {formatMoney(ppvPrice * 0.8)} per ticket sold.</Text>
        </>
      ) : null}

      <Text style={styles.label}>Chat & replay</Text>
      <View style={styles.healthCard}>
        <ToggleRow icon={<Timer size={16} color={Colors.lime} />} label="Slow mode (10s between messages)" value={slowMode} onChange={setSlowMode} />
        <ToggleRow icon={<Lock size={16} color={Colors.lime} />} label="Subscriber-only chat" value={subOnlyChat} onChange={setSubOnlyChat} />
        <ToggleRow icon={<UserPlus size={16} color={Colors.lime} />} label="Allow co-host (dual POV)" value={coHost} onChange={setCoHost} />
        <ToggleRow icon={<Radio size={16} color={Colors.lime} />} label="Save paid replay after stream" value={replay} onChange={setReplay} />
      </View>

      <View style={styles.previewBox}>
        <Tag label="PRE-FLIGHT" color={Colors.ink} bg={Colors.magenta} />
        <Text style={styles.previewText}>
          {access === "public"
            ? "Open stream — appears in the live feed for everyone."
            : access === "subscribers"
              ? "Subscriber gate on — non-subs see a subscribe screen."
              : `Ticketed event at ${formatMoney(ppvPrice)} — non-buyers see the unlock screen.`}
        </Text>
      </View>

      {provisionError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{provisionError}</Text>
        </View>
      ) : null}

      <Button
        label={provisioning ? "Setting up your stream…" : source === "phone" ? "Open camera & go live" : "Go live now"}
        variant="live"
        icon={provisioning ? <Loader size={17} color="#fff" /> : <Radio size={17} color="#fff" />}
        disabled={provisioning}
        onPress={() => void gateWithConsent(() => void goLive())}
        style={{ marginTop: 24 }}
      />
      <Text style={styles.legal}>
        Streams are monitored for guideline violations. Everyone appearing on camera must be 18+
        and have consented to being filmed and broadcast.
      </Text>

      {/* One-time 18+/consent sheet */}
      <Modal
        visible={showConsent}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConsent(false)}
      >
        <View style={styles.consentOverlay}>
          <View style={styles.consentSheet}>
            <View style={styles.consentIcon}>
              <ShieldCheck size={26} color={Colors.ink} />
            </View>
            <Text style={styles.consentTitle}>Before you go live</Text>
            <Text style={styles.consentBody}>
              Everyone appearing on camera must be 18+ and must have consented to being filmed and
              broadcast. POVMe is an 18+ platform. You&apos;re responsible for confirming everyone
              on your stream has agreed.
            </Text>
            <Button label="I understand — start stream" onPress={() => void confirmConsent()} />
            <Button
              label="Cancel"
              variant="dark"
              onPress={() => {
                setShowConsent(false);
                setPendingAction(null);
              }}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function SourceOption({
  icon,
  title,
  body,
  active,
  onPress,
  accent = Colors.magenta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  active: boolean;
  onPress: () => void;
  accent?: string;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.98}>
      <View style={[styles.optionCard, active && { borderColor: accent, backgroundColor: `${accent}12` }]}>
        <View style={[styles.optionIcon, active && { backgroundColor: accent }]}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.optionTitle}>{title}</Text>
          <Text style={styles.optionBody}>{body}</Text>
        </View>
        <View style={[styles.radio, active && { backgroundColor: accent, borderColor: accent }]}>
          {active ? <Check size={12} color={Colors.ink} /> : null}
        </View>
      </View>
    </PressableScale>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      {icon}
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: Colors.limeDark, false: Colors.surfaceTop }}
        thumbColor={value ? Colors.lime : Colors.textDim}
      />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  kicker: { ...microLabel, color: Colors.magenta, marginBottom: 14 },
  label: { ...microLabel, color: Colors.textDim, marginTop: 22, marginBottom: 9 },
  input: {
    height: 54,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    color: Colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: { color: Colors.text, fontSize: 14, fontWeight: "800" },
  optionBody: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.borderHi,
    alignItems: "center",
    justifyContent: "center",
  },
  healthCard: {
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  toggleLabel: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: "700" },
  hint: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 10 },
  previewBox: {
    marginTop: 22,
    padding: 15,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,45,111,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,45,111,0.22)",
    gap: 9,
    alignItems: "flex-start",
  },
  previewText: { color: Colors.text, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  errorBanner: {
    marginTop: 16,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,59,48,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.3)",
  },
  errorText: { color: Colors.danger, fontSize: 13, fontWeight: "700" },
  legal: { color: Colors.textDim, fontSize: 11, fontWeight: "600", lineHeight: 17, marginTop: 16 },
  consentOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  consentSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 38,
    gap: 14,
  },
  consentIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  consentTitle: { color: Colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.6 },
  consentBody: { color: Colors.textMid, fontSize: 13.5, fontWeight: "500", lineHeight: 20 },
  kycGateIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "rgba(204,255,0,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(204,255,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  kycGateTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 20,
    textAlign: "center",
  },
  kycGateBody: {
    color: Colors.textMid,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
  },
});
