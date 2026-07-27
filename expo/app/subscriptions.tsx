import { useRouter } from "expo-router";
import { CalendarClock, RotateCcw, Wallet2, XCircle } from "lucide-react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar, Button, EmptyState, PressableScale, Tag, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { formatMoney } from "@/lib/format";
import { useCreatorMap } from "@/hooks/useCreatorMap";
import { useApp } from "@/providers/app-provider";

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { subscriptions, cancelSubscriptionViaStripe, monthlySpend, balance } = useApp();
  const { get: getCreator } = useCreatorMap();

  const active = subscriptions.filter((s) => s.active);
  const cancelled = subscriptions.filter((s) => !s.active);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryKicker}>Monthly commitment</Text>
          <Text style={styles.summaryValue}>{formatMoney(monthlySpend)}</Text>
          <Text style={styles.summarySub}>
            {active.length} active {active.length === 1 ? "life" : "lives"} · wallet {formatMoney(balance)}
          </Text>
        </View>
        <PressableScale onPress={() => router.push("/wallet")} scaleTo={0.92}>
          <View style={styles.walletBtn}>
            <Wallet2 size={17} color={Colors.lime} />
          </View>
        </PressableScale>
      </View>

      {subscriptions.length === 0 ? (
        <EmptyState
          icon={<CalendarClock size={22} color={Colors.textMid} />}
          title="No subscriptions yet"
          body="When you subscribe to a creator, billing, renewal dates, and cancellation live here."
          action="Find a life to live"
          onAction={() => router.push("/explore")}
        />
      ) : null}

      {active.length > 0 ? (
        <>
          <Text style={styles.kicker}>Active</Text>
          <View style={{ gap: 10 }}>
            {active.map((sub) => {
              const creator = getCreator(sub.creatorId);
              if (!creator) return null;
              return (
                <View key={sub.creatorId} style={styles.card}>
                  <PressableScale onPress={() => router.push(`/creator/${creator.id}`)} scaleTo={0.98}>
                    <View style={styles.cardHead}>
                      <Avatar uri={creator.avatar} size={44} ring live={creator.isLive} />
                      <View style={{ flex: 1, marginLeft: 11 }}>
                        <Text style={styles.name}>{creator.name}</Text>
                        <Text style={styles.identity}>{creator.identity}</Text>
                      </View>
                      <Tag label={`${formatMoney(sub.price)}/mo`} color={Colors.ink} bg={Colors.lime} />
                    </View>
                  </PressableScale>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      Renews{" "}
                      {new Date(sub.renewsAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                    <Text style={styles.metaText}>
                      Creator gets {formatMoney(sub.price * 0.8)}
                    </Text>
                  </View>
                  <View style={styles.actions}>
                    <Button
                      label="Send a tip"
                      variant="dark"
                      small
                      onPress={() => router.push(`/tip/${creator.id}`)}
                      style={{ flex: 1 }}
                    />
                    <PressableScale
                      onPress={() => {
                        void cancelSubscriptionViaStripe(creator.id);
                        haptic("medium");
                      }}
                      scaleTo={0.95}
                      style={{ flex: 1 }}
                    >
                      <View style={styles.cancelBtn}>
                        <XCircle size={14} color={Colors.danger} />
                        <Text style={styles.cancelText}>Cancel</Text>
                      </View>
                    </PressableScale>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      {cancelled.length > 0 ? (
        <>
          <Text style={styles.kicker}>Cancelled</Text>
          <View style={{ gap: 10 }}>
            {cancelled.map((sub) => {
              const creator = getCreator(sub.creatorId);
              if (!creator) return null;
              return (
                <View key={sub.creatorId} style={[styles.card, { opacity: 0.75 }]}>
                  <View style={styles.cardHead}>
                    <Avatar uri={creator.avatar} size={40} />
                    <View style={{ flex: 1, marginLeft: 11 }}>
                      <Text style={styles.name}>{creator.name}</Text>
                      <Text style={styles.identity}>
                        Access ended · {formatMoney(sub.price)}/mo
                      </Text>
                    </View>
                  </View>
                  <Button
                    label="Resubscribe"
                    small
                    icon={<RotateCcw size={13} color={Colors.ink} />}
                    onPress={() => router.push(`/subscribe/${creator.id}`)}
                    style={{ marginTop: 12 }}
                  />
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={styles.legal}>
        Cancelling keeps your access until the end of the current billing period. Pay-per-view
        unlocks you already bought stay yours forever.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.2)",
  },
  summaryKicker: { ...microLabel, color: Colors.lime },
  summaryValue: { color: Colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1.3, marginTop: 6 },
  summarySub: { color: Colors.textDim, fontSize: 12, fontWeight: "600", marginTop: 4 },
  walletBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(204,255,0,0.1)",
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: { ...microLabel, color: Colors.textDim, marginTop: 26, marginBottom: 12 },
  card: {
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHead: { flexDirection: "row", alignItems: "center" },
  name: { color: Colors.text, fontSize: 14.5, fontWeight: "900" },
  identity: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  metaText: { color: Colors.textDim, fontSize: 11.5, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  cancelBtn: {
    height: 42,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.3)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  cancelText: { color: Colors.danger, fontSize: 13.5, fontWeight: "800" },
  legal: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", lineHeight: 18, marginTop: 26 },
});
