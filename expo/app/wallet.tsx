import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Gift,
  Lock,
  Plus,
  Shield,
  Sparkles,
} from "lucide-react-native";
import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, PressableScale, SectionHeader, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { formatMoney } from "@/lib/format";
import { useCreatorMap } from "@/hooks/useCreatorMap";
import { useApp } from "@/providers/app-provider";
import type { Transaction } from "@/types";

const TOPUPS = [25, 50, 100, 250];

export default function WalletScreen() {
  const router = useRouter();
  const { balance, topUpViaStripe, transactions, monthlySpend, totalSpent, refreshWallet } = useApp();
  const { get: getCreator } = useCreatorMap();
  const [processing, setProcessing] = useState<number | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const handleTopUp = async (amount: number): Promise<void> => {
    setPayError(null);
    setProcessing(amount);
    try {
      const result = await topUpViaStripe(amount);
      if (result.success) {
        haptic("success");
        // The webhook credits the wallet; refresh after a short delay
        setTimeout(() => { void refreshWallet(); }, 2000);
      } else {
        setPayError(result.error ?? "Payment failed");
      }
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <LinearGradient
          colors={["rgba(204,255,0,0.2)", "rgba(19,19,24,0.1)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.cardKicker}>povme wallet</Text>
        <Text style={styles.cardValue}>{formatMoney(balance)}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.cardMetaText}>{formatMoney(monthlySpend)}/mo committed</Text>
          <Text style={styles.cardMetaText}>{formatMoney(totalSpent)} lifetime</Text>
        </View>
      </View>

      <SectionHeader kicker="Stripe Checkout" title="Add funds" />
      {payError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{payError}</Text>
        </View>
      ) : null}
      <View style={styles.topRow}>
        {TOPUPS.map((amount) => (
          <PressableScale
            key={amount}
            style={{ flex: 1 }}
            scaleTo={0.93}
            disabled={processing !== null}
            onPress={() => void handleTopUp(amount)}
          >
            <View style={[styles.topCard, processing === amount && styles.topCardBusy]}>
              {processing === amount ? (
                <Text style={styles.topText}>···</Text>
              ) : (
                <>
                  <Plus size={14} color={Colors.lime} />
                  <Text style={styles.topText}>${amount}</Text>
                </>
              )}
            </View>
          </PressableScale>
        ))}
      </View>

      <SectionHeader kicker="Payment methods" title="How you pay" />
      <View style={styles.methods}>
        <MethodRow
          icon={<CreditCard size={17} color={Colors.text} />}
          label="Visa ···· 4242"
          sub="Default · expires 09/29"
        />
        <MethodRow
          icon={<Shield size={17} color={Colors.cyan} />}
          label="Discreet billing"
          sub="Statements show POVM DIGITAL LLC"
        />
        <MethodRow
          icon={<Gift size={17} color={Colors.gold} />}
          label="Redeem a gift code"
          sub="Creator promo codes and bundles"
        />
      </View>

      <SectionHeader kicker="Activity" title="Transactions" />
      {transactions.length === 0 ? (
        <Text style={styles.empty}>
          Nothing yet. Subscribe, unlock a premium POV, or tip a creator and it shows up here.
        </Text>
      ) : (
        <View style={styles.txList}>
          {transactions.map((tx) => (
            <TxRow key={tx.id} tx={tx} />
          ))}
        </View>
      )}

      <View style={styles.noteBox}>
        <Lock size={14} color={Colors.textDim} />
        <Text style={styles.noteText}>
          Payments are processed by our PSP with 3-D Secure. povme never stores full card
          numbers. Creators are paid out weekly after KYC verification.
        </Text>
      </View>

      <Button label="Back to feed" variant="dark" onPress={() => router.back()} style={{ marginHorizontal: 18, marginTop: 20 }} />
    </ScrollView>
  );
}

function MethodRow({
  icon,
  label,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <View style={styles.methodRow}>
      <View style={styles.methodIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.methodLabel}>{label}</Text>
        <Text style={styles.methodSub}>{sub}</Text>
      </View>
    </View>
  );
}

function TxRow({ tx }: { tx: Transaction }) {
  const inbound = tx.kind === "topup";
  const { get: getCreator } = useCreatorMap();
  const creator = tx.creatorId ? getCreator(tx.creatorId) : undefined;
  const icon = inbound ? (
    <ArrowDownLeft size={15} color={Colors.success} />
  ) : tx.kind === "tip" || tx.kind === "gift" ? (
    <Sparkles size={15} color={Colors.gold} />
  ) : (
    <ArrowUpRight size={15} color={Colors.textMid} />
  );

  return (
    <View style={styles.txRow}>
      <View style={styles.txIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.txLabel} numberOfLines={1}>
          {tx.label}
        </Text>
        <Text style={styles.txMeta}>
          {new Date(tx.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
          {creator ? creator.identity : tx.kind.toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.txAmount, inbound && { color: Colors.success }]}>
        {inbound ? "+" : "−"}
        {formatMoney(tx.amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  card: {
    margin: 18,
    padding: 22,
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.25)",
  },
  cardKicker: { ...microLabel, color: Colors.lime },
  cardValue: { color: Colors.text, fontSize: 42, fontWeight: "900", letterSpacing: -2, marginTop: 8 },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  cardMetaText: { color: Colors.textMid, fontSize: 11.5, fontWeight: "700" },
  topRow: { flexDirection: "row", gap: 9, paddingHorizontal: 18 },
  topCard: {
    height: 62,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  topCardBusy: { borderColor: Colors.lime, opacity: 0.6 },
  errorBox: {
    marginHorizontal: 18,
    marginBottom: 10,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,77,77,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.25)",
  },
  errorText: { color: Colors.danger, fontSize: 12.5, fontWeight: "700" },
  topText: { color: Colors.text, fontSize: 15, fontWeight: "900" },
  methods: {
    marginHorizontal: 18,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  methodIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
  },
  methodLabel: { color: Colors.text, fontSize: 13.5, fontWeight: "800" },
  methodSub: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  empty: {
    color: Colors.textDim,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    paddingHorizontal: 18,
  },
  txList: { paddingHorizontal: 18, gap: 8 },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  txIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
  },
  txLabel: { color: Colors.text, fontSize: 13, fontWeight: "800" },
  txMeta: { color: Colors.textDim, fontSize: 11, fontWeight: "600", marginTop: 2 },
  txAmount: { color: Colors.text, fontSize: 13.5, fontWeight: "900" },
  noteBox: {
    flexDirection: "row",
    gap: 10,
    margin: 18,
    padding: 15,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noteText: { flex: 1, color: Colors.textDim, fontSize: 11.5, fontWeight: "600", lineHeight: 18 },
});
