import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Banknote, Check, Clock, Landmark, RefreshCw, TrendingUp, Wallet } from "lucide-react-native";
import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, PressableScale, ProgressBar, SectionHeader, StatTile, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { formatMoney } from "@/constants/mock-data";
import { fetchCreatorBalance, requestPayout, type CreatorBalance } from "@/lib/payments";
import { useApp } from "@/providers/app-provider";

const BREAKDOWN = [
  { label: "Subscriptions", pct: 0.58, color: Colors.lime },
  { label: "Pay-per-view", pct: 0.24, color: Colors.cyan },
  { label: "Tips & gifts", pct: 0.13, color: Colors.gold },
  { label: "Paid replays", pct: 0.05, color: Colors.magenta },
];

export default function EarningsScreen() {
  const { creatorStats } = useApp();
  const [requested, setRequested] = useState<boolean>(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<boolean>(false);

  // Real Stripe Connect balance via edge function
  const { data: balance, isLoading, refetch } = useQuery<CreatorBalance>({
    queryKey: ["creator-balance"],
    queryFn: fetchCreatorBalance,
    retry: 1,
  });

  const available = balance?.available ?? 0;
  const pending = balance?.pending ?? 0;
  const lifetime = balance?.lifetime_earnings ?? creatorStats.gross;
  const payoutsEnabled = balance?.payouts_enabled ?? false;
  const payouts = balance?.payouts ?? [];
  const payoutMethod = balance?.payout_method ?? null;
  const payoutHandle = balance?.payout_handle ?? null;
  const destinationSummary = balance?.destination_summary ?? null;
  const payoutLabel = balance?.payout_label ?? null;

  const handleWithdraw = async (): Promise<void> => {
    setWithdrawing(true);
    setPayoutError(null);
    try {
      const result = await requestPayout(); // full available balance
      setRequested(true);
      haptic("success");
      void refetch();
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : "Payout failed");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <LinearGradient
          colors={["rgba(61,220,151,0.18)", "rgba(19,19,24,0.1)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cardHeader}>
          <Text style={styles.cardKicker}>Available balance</Text>
          <PressableScale onPress={() => void refetch()} scaleTo={0.85}>
            <RefreshCw size={14} color={Colors.textMid} />
          </PressableScale>
        </View>
        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.lime} style={{ marginTop: 10, marginBottom: 6 }} />
        ) : (
          <Text style={styles.cardValue}>{formatMoney(available)}</Text>
        )}
        <Text style={styles.cardSub}>
          {formatMoney(pending)} pending · {formatMoney(lifetime)} lifetime · povme fee {formatMoney(lifetime * 0.2)}
        </Text>
        {requested ? (
          <View style={styles.pending}>
            <Clock size={14} color={Colors.gold} />
            <Text style={styles.pendingText}>
              Payout requested — sent to your {destinationSummary ?? payoutMethod ?? "payout"} within 1–2 business days
            </Text>
          </View>
        ) : payoutsEnabled ? (
          <Button
            label={withdrawing ? "Processing…" : `Withdraw to ${destinationSummary ?? payoutMethod ?? "payout"}`}
            icon={<Banknote size={16} color={Colors.ink} />}
            onPress={() => void handleWithdraw()}
            disabled={withdrawing || available < 1}
            style={{ marginTop: 18 }}
          />
        ) : (
          <View style={styles.disabledBox}>
            <Text style={styles.disabledText}>
              Add a payout destination (USDC, bank ACH, PayPal, Venmo, Cash App, or Zelle) in Become a Creator to
              withdraw earnings.
            </Text>
          </View>
        )}
        {payoutError ? (
          <Text style={styles.payoutError}>{payoutError}</Text>
        ) : null}
      </View>

      <View style={styles.statRow}>
        <StatTile label="This month" value={formatMoney(available)} sub="available now" />
        <StatTile label="Lifetime" value={formatMoney(lifetime)} sub="gross earnings" accent={Colors.cyan} />
      </View>

      <SectionHeader kicker="Where it comes from" title="Revenue mix" />
      <View style={styles.mixCard}>
        {BREAKDOWN.map((b) => (
          <View key={b.label} style={{ gap: 8 }}>
            <View style={styles.mixRow}>
              <Text style={styles.mixLabel}>{b.label}</Text>
              <Text style={[styles.mixValue, { color: b.color }]}>
                {formatMoney(lifetime * b.pct)}
              </Text>
            </View>
            <ProgressBar progress={b.pct} color={b.color} />
          </View>
        ))}
      </View>

      <SectionHeader kicker="Destination" title="Payout account" />
      <View style={styles.accountCard}>
        <View style={styles.accountIcon}>
          {payoutMethod ? <Wallet size={18} color={Colors.success} /> : <Landmark size={18} color={Colors.textDim} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.accountLabel}>
            {payoutLabel ?? destinationSummary ?? (payoutMethod ? `${payoutMethod} · ${payoutHandle ?? ""}` : "No payout destination set")}
          </Text>
          <Text style={styles.accountSub}>
            {payoutMethod
              ? payoutMethod === "usdc"
                ? "USDC stablecoin · instant · global"
                : payoutMethod === "bank"
                  ? "Bank ACH · 1–2 business days"
                  : "Manual payouts · processed within 1–2 business days"
              : "Add USDC, bank ACH, PayPal, Venmo, Cash App, or Zelle in Become a Creator"}
          </Text>
        </View>
        {payoutMethod ? <Check size={17} color={Colors.success} /> : null}
      </View>

      <SectionHeader kicker="History" title="Recent payouts" />
      {payouts.length === 0 ? (
        <Text style={styles.empty}>No payouts yet. Your withdrawals will appear here.</Text>
      ) : (
        <View style={styles.payoutList}>
          {payouts.map((p) => (
            <View key={p.id} style={styles.payoutRow}>
              <View style={styles.payoutIcon}>
                <TrendingUp size={14} color={Colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.payoutAmount}>{formatMoney(p.amount)}</Text>
                <Text style={styles.payoutMeta}>
                  {p.arrival_date ? new Date(p.arrival_date).toLocaleDateString() : "—"} · {p.method}
                </Text>
              </View>
              <Text style={[styles.payoutStatus, p.status === "failed" && { color: Colors.danger }]}>
                {p.status}
              </Text>
            </View>
          ))}
        </View>
      )}

      <PressableScale>
        <Text style={styles.legal}>
          povme keeps 20% of gross revenue. Payouts are sent to your saved destination (USDC, bank ACH, or P2P handle).
          Taxes are your responsibility — export your annual statement from Settings.
        </Text>
      </PressableScale>
    </ScrollView>
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
    borderColor: "rgba(61,220,151,0.25)",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardKicker: { ...microLabel, color: Colors.success },
  cardValue: { color: Colors.text, fontSize: 40, fontWeight: "900", letterSpacing: -1.8, marginTop: 8 },
  cardSub: { color: Colors.textMid, fontSize: 12, fontWeight: "700", marginTop: 6 },
  pending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
    padding: 13,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,182,39,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,182,39,0.25)",
  },
  pendingText: { flex: 1, color: Colors.text, fontSize: 12.5, fontWeight: "700" },
  disabledBox: {
    marginTop: 18,
    padding: 13,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disabledText: { color: Colors.textDim, fontSize: 12.5, fontWeight: "600", lineHeight: 18 },
  payoutError: { color: Colors.danger, fontSize: 12.5, fontWeight: "700", marginTop: 10 },
  statRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18 },
  mixCard: {
    marginHorizontal: 18,
    padding: 18,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 16,
  },
  mixRow: { flexDirection: "row", justifyContent: "space-between" },
  mixLabel: { color: Colors.text, fontSize: 13, fontWeight: "700" },
  mixValue: { fontSize: 13, fontWeight: "900" },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 18,
    padding: 15,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  accountIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(61,220,151,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  accountLabel: { color: Colors.text, fontSize: 13.5, fontWeight: "800" },
  accountSub: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  empty: {
    color: Colors.textDim,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    paddingHorizontal: 18,
  },
  payoutList: { paddingHorizontal: 18, gap: 8 },
  payoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  payoutIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
  },
  payoutAmount: { color: Colors.text, fontSize: 13.5, fontWeight: "900" },
  payoutMeta: { color: Colors.textDim, fontSize: 11, fontWeight: "600", marginTop: 2 },
  payoutStatus: { color: Colors.success, fontSize: 11.5, fontWeight: "900" },
  legal: {
    color: Colors.textDim,
    fontSize: 11.5,
    fontWeight: "600",
    lineHeight: 18,
    paddingHorizontal: 18,
    marginTop: 26,
  },
});
