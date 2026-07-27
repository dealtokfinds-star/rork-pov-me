import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, CreditCard, Lock, Sparkles, Wallet2 } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar, Button, PressableScale, Tag, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { formatCount, formatMoney } from "@/lib/format";
import { useApp } from "@/providers/app-provider";
import { useCreator, useCreatorEpisodes } from "@/lib/data";

interface Tier {
  id: string;
  name: string;
  multiplier: number;
  perks: string[];
}

const TIERS: Tier[] = [
  {
    id: "basic",
    name: "Basic",
    multiplier: 1,
    perks: ["Full POV episode feed", "Subscriber-only chapters", "Comment on every episode"],
  },
  {
    id: "plus",
    name: "Plus",
    multiplier: 1.8,
    perks: [
      "Everything in Basic",
      "Bonus & behind-the-scenes POVs",
      "Direct messages",
      "Paid replays included",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    multiplier: 3.4,
    perks: [
      "Everything in Plus",
      "Live POV streams, always in",
      "Priority POV requests",
      "Monthly 1:1 voice note",
    ],
  },
];

export default function SubscribeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { subscribeViaStripe, balance, isSubscribed } = useApp();
  const [tierId, setTierId] = useState<string>("basic");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);

  const { data: creator } = useCreator(id);
  const { data: episodes = [] } = useCreatorEpisodes(id);
  if (!creator) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Creator not found</Text>
      </View>
    );
  }

  const tier = TIERS.find((t) => t.id === tierId) ?? TIERS[0];
  const price = Math.round(creator.subPrice * tier.multiplier * 100) / 100;
  const already = isSubscribed(creator.id);

  const confirm = async (): Promise<void> => {
    setProcessing(true);
    setError(null);
    try {
      const result = await subscribeViaStripe(creator.id, price);
      if (result.success) {
        setDone(true);
        haptic("success");
        return;
      }
      setError(result.error ?? "Subscription failed. Please try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscription failed");
    } finally {
      setProcessing(false);
    }
  };

  if (done || already) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.successWrap}>
        <View style={styles.successIcon}>
          <Check size={30} color={Colors.ink} />
        </View>
        <Text style={styles.successTitle}>You&apos;re living as {creator.name.split(" ")[0]}.</Text>
        <Text style={styles.successBody}>
          {episodes.length} POV episodes just unlocked. New drops land in your Following feed the
          moment they publish.
        </Text>
        <View style={styles.receipt}>
          <ReceiptRow label="Creator" value={`@${creator.handle}`} />
          <ReceiptRow label="Tier" value={tier.name} />
          <ReceiptRow label="Billed monthly" value={formatMoney(price)} />
          <ReceiptRow label="Creator keeps" value={`${formatMoney(price * 0.8)} (80%)`} />
          <ReceiptRow label="Renews" value={new Date(Date.now() + 30 * 86400000).toLocaleDateString()} />
        </View>
        <Button label="Start watching" onPress={() => router.back()} style={{ marginTop: 24 }} />
        <PressableScale onPress={() => router.push("/subscriptions")}>
          <Text style={styles.manageLink}>Manage subscriptions</Text>
        </PressableScale>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Image source={{ uri: creator.cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={["rgba(8,8,10,0.4)", Colors.bg]} style={StyleSheet.absoluteFill} />
        <View style={styles.heroBody}>
          <Avatar uri={creator.avatar} size={56} ring live={creator.isLive} />
          <Text style={styles.heroTitle}>Live as {creator.name}</Text>
          <Text style={styles.heroSub}>
            {creator.identity} · {formatCount(creator.subscribers)} subscribers · {episodes.length} episodes
          </Text>
        </View>
      </View>

      <Text style={styles.sectionKicker}>Choose your access</Text>
      <View style={styles.tierList}>
        {TIERS.map((t) => {
          const p = Math.round(creator.subPrice * t.multiplier * 100) / 100;
          const active = t.id === tierId;
          return (
            <PressableScale key={t.id} onPress={() => setTierId(t.id)} scaleTo={0.98}>
              <View style={[styles.tierCard, active && styles.tierCardActive]}>
                <View style={styles.tierHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowGap6}>
                      <Text style={styles.tierName}>{t.name}</Text>
                      {t.id === "plus" ? <Tag label="Popular" color={Colors.ink} bg={Colors.lime} /> : null}
                    </View>
                    <Text style={styles.tierPrice}>{formatMoney(p)}/mo</Text>
                  </View>
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active ? <Check size={13} color={Colors.ink} /> : null}
                  </View>
                </View>
                <View style={{ gap: 6, marginTop: 10 }}>
                  {t.perks.map((perk) => (
                    <View key={perk} style={styles.perkRow}>
                      <Check size={12} color={active ? Colors.lime : Colors.textDim} />
                      <Text style={[styles.perkText, active && { color: Colors.text }]}>{perk}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </PressableScale>
          );
        })}
      </View>

      <View style={styles.payBox}>
        <View style={styles.payRow}>
          <Wallet2 size={16} color={Colors.lime} />
          <Text style={styles.payLabel}>povme wallet</Text>
          <Text style={styles.payValue}>{formatMoney(balance)}</Text>
        </View>
        <View style={styles.payDivider} />
        <View style={styles.payRow}>
          <CreditCard size={16} color={Colors.textDim} />
          <Text style={[styles.payLabel, { color: Colors.textDim }]}>Visa ···· 4242</Text>
          <Text style={[styles.payValue, { color: Colors.textDim }]}>Backup</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <PressableScale onPress={() => router.push("/wallet")}>
            <Text style={styles.errorLink}>Add funds →</Text>
          </PressableScale>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Button label={processing ? "Opening checkout…" : `Subscribe · ${formatMoney(price)}/mo`} onPress={() => void confirm()} disabled={processing} />
        <View style={styles.trustRow}>
          <Lock size={11} color={Colors.textDim} />
          <Text style={styles.trustText}>
            Cancel anytime. Billed monthly. {formatMoney(price * 0.8)} of every payment goes
            straight to {creator.name.split(" ")[0]}.
          </Text>
        </View>
        <View style={styles.tipHint}>
          <Sparkles size={12} color={Colors.gold} />
          <Text style={styles.tipHintText}>
            Want a single episode instead? Premium POVs unlock one at a time.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <Text style={styles.receiptValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  title: { color: Colors.text, fontSize: 20, fontWeight: "900", padding: 24 },
  hero: { height: 210, justifyContent: "flex-end" },
  heroBody: { paddingHorizontal: 20, paddingBottom: 6, gap: 6 },
  heroTitle: { color: Colors.text, fontSize: 25, fontWeight: "900", letterSpacing: -0.9, marginTop: 10 },
  heroSub: { color: Colors.textMid, fontSize: 12.5, fontWeight: "600" },
  sectionKicker: { ...microLabel, color: Colors.lime, paddingHorizontal: 20, marginTop: 22 },
  tierList: { paddingHorizontal: 18, gap: 10, marginTop: 12 },
  tierCard: {
    padding: 16,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tierCardActive: { borderColor: Colors.lime, backgroundColor: "rgba(204,255,0,0.05)" },
  tierHeader: { flexDirection: "row", alignItems: "center" },
  rowGap6: { flexDirection: "row", alignItems: "center", gap: 7 },
  tierName: { color: Colors.text, fontSize: 16, fontWeight: "900" },
  tierPrice: { color: Colors.lime, fontSize: 19, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderHi,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { backgroundColor: Colors.lime, borderColor: Colors.lime },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  perkText: { color: Colors.textDim, fontSize: 12.5, fontWeight: "600" },
  payBox: {
    marginHorizontal: 18,
    marginTop: 18,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  payRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 15 },
  payLabel: { flex: 1, color: Colors.text, fontSize: 13.5, fontWeight: "700" },
  payValue: { color: Colors.lime, fontSize: 13.5, fontWeight: "900" },
  payDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginHorizontal: 15 },
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
  errorLink: { color: Colors.lime, fontSize: 13, fontWeight: "900" },
  footer: { paddingHorizontal: 18, marginTop: 20, gap: 12 },
  trustRow: { flexDirection: "row", gap: 7, alignItems: "flex-start" },
  trustText: { flex: 1, color: Colors.textDim, fontSize: 11.5, fontWeight: "600", lineHeight: 17 },
  tipHint: { flexDirection: "row", gap: 7, alignItems: "center" },
  tipHintText: { flex: 1, color: Colors.textDim, fontSize: 11.5, fontWeight: "600" },
  successWrap: { padding: 24, paddingTop: 46, alignItems: "center" },
  successIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    color: Colors.text,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -1,
    textAlign: "center",
    marginTop: 20,
    lineHeight: 32,
  },
  successBody: {
    color: Colors.textMid,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
  },
  receipt: {
    width: "100%",
    marginTop: 24,
    padding: 16,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 11,
  },
  receiptRow: { flexDirection: "row", justifyContent: "space-between" },
  receiptLabel: { color: Colors.textDim, fontSize: 12.5, fontWeight: "600" },
  receiptValue: { color: Colors.text, fontSize: 12.5, fontWeight: "800" },
  manageLink: {
    color: Colors.textDim,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 18,
    textDecorationLine: "underline",
  },
});
