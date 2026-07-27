import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Heart, Sparkles } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Avatar, Button, PressableScale, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { GIFTS, formatMoney } from "@/lib/format";
import { useCreator } from "@/lib/data";
import { useApp } from "@/providers/app-provider";

const PRESETS = [2, 5, 10, 20, 50, 100];

export default function TipScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tipViaStripe, balance, tipTotals } = useApp();
  const [amount, setAmount] = useState<number>(5);
  const [custom, setCustom] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);

  const { data: creator } = useCreator(id);
  if (!creator) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Creator not found</Text>
      </View>
    );
  }

  const resolved = custom.trim().length > 0 ? Number(custom) : amount;
  const valid = Number.isFinite(resolved) && resolved >= 1;
  const already = tipTotals[creator.id] ?? 0;

  if (sent !== null) {
    return (
      <View style={[styles.screen, styles.successWrap]}>
        <View style={styles.successIcon}>
          <Check size={28} color={Colors.ink} />
        </View>
        <Text style={styles.successTitle}>{formatMoney(sent)} sent</Text>
        <Text style={styles.successBody}>
          {creator.name.split(" ")[0]} keeps {formatMoney(sent * 0.8)}. Your name shows up in their
          top supporters this week.
        </Text>
        <Button label="Done" onPress={() => router.back()} style={{ marginTop: 26 }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={styles.header}>
        <Avatar uri={creator.avatar} size={58} ring live={creator.isLive} />
        <Text style={styles.title}>Tip {creator.name.split(" ")[0]}</Text>
        <Text style={styles.subtitle}>
          {creator.identity} · {already > 0 ? `you've tipped ${formatMoney(already)}` : "first tip"}
        </Text>
      </View>

      <Text style={styles.kicker}>Amount</Text>
      <View style={styles.grid}>
        {PRESETS.map((p) => {
          const active = custom.trim().length === 0 && amount === p;
          return (
            <PressableScale
              key={p}
              onPress={() => {
                setAmount(p);
                setCustom("");
              }}
              scaleTo={0.93}
            >
              <View style={[styles.amountCard, active && styles.amountCardActive]}>
                <Text style={[styles.amountText, active && { color: Colors.ink }]}>${p}</Text>
              </View>
            </PressableScale>
          );
        })}
      </View>

      <TextInput
        value={custom}
        onChangeText={setCustom}
        placeholder="Custom amount"
        placeholderTextColor={Colors.textDim}
        keyboardType="decimal-pad"
        style={styles.input}
      />

      <Text style={styles.kicker}>Add a note</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Best POV I've seen all week…"
        placeholderTextColor={Colors.textDim}
        style={[styles.input, { height: 88, textAlignVertical: "top", paddingTop: 14 }]}
        multiline
        maxLength={140}
      />

      <Text style={styles.kicker}>Or send a gift</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
        {GIFTS.map((g) => (
          <PressableScale
            key={g.id}
            scaleTo={0.9}
            onPress={async () => {
              setProcessing(true);
              setError(null);
              try {
                const result = await tipViaStripe(creator.id, g.price, g.name);
                if (result.success) {
                  haptic("success");
                  setSent(g.price);
                  return;
                }
                setError(result.error ?? "Tip failed");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Tip failed");
              } finally {
                setProcessing(false);
              }
            }}
          >
            <View style={styles.giftCard}>
              <Text style={styles.giftEmoji}>{g.emoji}</Text>
              <Text style={styles.giftName}>{g.name}</Text>
              <Text style={styles.giftPrice}>{formatMoney(g.price)}</Text>
            </View>
          </PressableScale>
        ))}
      </ScrollView>

      <View style={styles.walletRow}>
        <Sparkles size={14} color={Colors.gold} />
        <Text style={styles.walletLabel}>Wallet</Text>
        <Text style={styles.walletValue}>{formatMoney(balance)}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label={processing ? "Opening checkout…" : valid ? `Send ${formatMoney(resolved)}` : "Enter an amount"}
        icon={<Heart size={16} color={Colors.ink} fill={Colors.ink} />}
        disabled={!valid || processing}
        onPress={async () => {
          setProcessing(true);
          setError(null);
          try {
            const result = await tipViaStripe(creator.id, resolved, note || undefined);
            if (result.success) {
              haptic("success");
              setSent(resolved);
              return;
            }
            setError(result.error ?? `Tip failed. Top up your wallet and try again.`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Tip failed");
          } finally {
            setProcessing(false);
          }
        }}
        style={{ marginTop: 20 }}
      />
      <PressableScale onPress={() => router.push("/wallet")}>
        <Text style={styles.link}>Add funds to wallet</Text>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { alignItems: "center", marginBottom: 24 },
  title: { color: Colors.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.9, marginTop: 12 },
  subtitle: { color: Colors.textDim, fontSize: 12.5, fontWeight: "600", marginTop: 4 },
  kicker: { ...microLabel, color: Colors.gold, marginTop: 18, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  amountCard: {
    width: 100,
    height: 58,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  amountCardActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  amountText: { color: Colors.text, fontSize: 19, fontWeight: "900" },
  input: {
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    color: Colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 12,
  },
  giftCard: {
    width: 84,
    padding: 11,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  giftEmoji: { fontSize: 22 },
  giftName: { color: Colors.text, fontSize: 11, fontWeight: "800", marginTop: 6 },
  giftPrice: { color: Colors.gold, fontSize: 11, fontWeight: "900", marginTop: 2 },
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 20,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  walletLabel: { flex: 1, color: Colors.text, fontSize: 13.5, fontWeight: "700" },
  walletValue: { color: Colors.lime, fontSize: 13.5, fontWeight: "900" },
  error: { color: Colors.danger, fontSize: 12.5, fontWeight: "700", marginTop: 12 },
  link: {
    color: Colors.textDim,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 16,
    textDecorationLine: "underline",
  },
  successWrap: { alignItems: "center", justifyContent: "center", padding: 30 },
  successIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { color: Colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1.2, marginTop: 18 },
  successBody: {
    color: Colors.textMid,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
  },
});
