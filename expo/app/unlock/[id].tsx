import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Infinity as InfinityIcon, Lock, Play, Wallet2 } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar, Button, PressableScale, Tag, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import {
  categoryById,
  formatDuration,
  formatMoney,
} from "@/constants/mock-data";
import { useEpisode, useCreator } from "@/lib/data";
import { useApp } from "@/providers/app-provider";
import { useTrackEvent } from "@/hooks/useTrackEvent";

export default function UnlockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { unlockViaStripe, balance } = useApp();
  const track = useTrackEvent();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);

  const { data: episode, isLoading } = useEpisode(id);
  const { data: creator } = useCreator(episode?.creatorId);

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Loading…</Text>
      </View>
    );
  }
  if (!episode || !creator) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Episode not found</Text>
      </View>
    );
  }

  const price = episode.ppvPrice ?? 0;
  const cat = categoryById(episode.category);

  if (done) {
    return (
      <View style={[styles.screen, styles.successWrap]}>
        <View style={styles.successIcon}>
          <Check size={26} color={Colors.ink} />
        </View>
        <Text style={styles.successTitle}>Payment processing</Text>
        <Text style={styles.successBody}>
          Your unlock is being confirmed. You'll be able to watch {episode.title} once the payment clears.
        </Text>
        <Button label="Back to episode" onPress={() => router.back()} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Image source={{ uri: episode.thumb }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={26} />
        <LinearGradient colors={["rgba(53,231,255,0.18)", "rgba(8,8,10,0.9)", Colors.bg]} style={StyleSheet.absoluteFill} />
        <View style={styles.heroBody}>
          <View style={styles.lockIcon}>
            <Lock size={20} color={Colors.ink} />
          </View>
          <View style={styles.tagRow}>
            <Tag label="PAY-PER-VIEW" color={Colors.ink} bg={Colors.cyan} />
            <Tag label={cat.label} color={Colors.text} bg="rgba(0,0,0,0.5)" />
            <Tag label={formatDuration(episode.durationSec)} color={Colors.text} bg="rgba(0,0,0,0.5)" />
          </View>
          <Text style={styles.heroTitle}>{episode.title}</Text>
        </View>
      </View>

      <View style={styles.creatorRow}>
        <Avatar uri={creator.avatar} size={40} ring live={creator.isLive} />
        <View style={{ marginLeft: 11, flex: 1 }}>
          <Text style={styles.creatorName}>{creator.name}</Text>
          <Text style={styles.creatorSub}>{creator.identity} · {creator.location}</Text>
        </View>
      </View>

      <Text style={styles.description}>{episode.description}</Text>

      <View style={styles.priceCard}>
        <Text style={styles.priceKicker}>One-time unlock</Text>
        <Text style={styles.priceValue}>{formatMoney(price)}</Text>
        <View style={styles.perks}>
          <Perk icon={<InfinityIcon size={13} color={Colors.cyan} />} text="Yours forever — no subscription required" />
          <Perk icon={<Play size={13} color={Colors.cyan} />} text="Full-length episode, original audio, 4K" />
          <Perk icon={<Check size={13} color={Colors.cyan} />} text={`${formatMoney(price * 0.8)} goes to ${creator.name.split(" ")[0]}`} />
        </View>
      </View>

      <View style={styles.walletRow}>
        <Wallet2 size={15} color={Colors.lime} />
        <Text style={styles.walletLabel}>Wallet balance</Text>
        <Text style={styles.walletValue}>{formatMoney(balance)}</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <PressableScale onPress={() => router.push("/wallet")}>
            <Text style={styles.errorLink}>Add funds →</Text>
          </PressableScale>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 18, marginTop: 20, gap: 12 }}>
        <Button
          label={processing ? "Opening checkout…" : `Unlock this POV · ${formatMoney(price)}`}
          variant="ppv"
          disabled={processing}
          onPress={async () => {
            setProcessing(true);
            setError(null);
            try {
              const result = await unlockViaStripe(episode.id, price, creator.id);
              if (result.success) {
                haptic("success");
                track("unlock", { episode_id: episode.id, creator_id: creator.id, value: price });
                setDone(true);
              } else {
                setError(result.error ?? "Checkout was cancelled or failed.");
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : "Unlock failed");
            } finally {
              setProcessing(false);
            }
          }}
        />
        <Button
          label={`Or subscribe · ${formatMoney(creator.subPrice)}/mo for everything`}
          variant="ghost"
          small
          onPress={() => router.replace(`/subscribe/${creator.id}`)}
        />
      </View>
    </ScrollView>
  );
}

function Perk({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.perkRow}>
      {icon}
      <Text style={styles.perkText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  title: { color: Colors.text, fontSize: 20, fontWeight: "900", padding: 24 },
  hero: { minHeight: 260, justifyContent: "flex-end" },
  heroBody: { padding: 20, gap: 10 },
  lockIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
  tagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  heroTitle: { color: Colors.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.9, lineHeight: 29 },
  creatorRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, marginTop: 18 },
  creatorName: { color: Colors.text, fontSize: 14.5, fontWeight: "900" },
  creatorSub: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  description: {
    color: Colors.textMid,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    paddingHorizontal: 18,
    marginTop: 16,
  },
  priceCard: {
    marginHorizontal: 18,
    marginTop: 20,
    padding: 18,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(53,231,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(53,231,255,0.24)",
  },
  priceKicker: { ...microLabel, color: Colors.cyan },
  priceValue: { color: Colors.text, fontSize: 38, fontWeight: "900", letterSpacing: -1.6, marginTop: 6 },
  perks: { gap: 9, marginTop: 14 },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  perkText: { flex: 1, color: Colors.textMid, fontSize: 12.5, fontWeight: "600" },
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 18,
    marginTop: 14,
    padding: 15,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  walletLabel: { flex: 1, color: Colors.text, fontSize: 13.5, fontWeight: "700" },
  walletValue: { color: Colors.lime, fontSize: 13.5, fontWeight: "900" },
  errorBox: {
    marginHorizontal: 18,
    marginTop: 14,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,77,77,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.25)",
    gap: 7,
  },
  errorText: { color: Colors.text, fontSize: 13, fontWeight: "700" },
  errorLink: { color: Colors.cyan, fontSize: 13, fontWeight: "900" },
  successWrap: { alignItems: "center", justifyContent: "center", padding: 30 },
  successIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: Colors.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { color: Colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -1, marginTop: 20 },
  successBody: {
    color: Colors.textMid,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
  },
});
