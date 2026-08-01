import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { ArrowUpRight, Globe2, Repeat } from "lucide-react-native";

import { Chip, ProgressBar, SectionHeader, StatTile } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { formatCount, formatMoney } from "@/constants/mock-data";
import { fetchCreatorAnalytics, type CreatorAnalytics } from "@/hooks/useAnalytics";
import { useAuth } from "@/hooks/useAuth";

type Range = "7d" | "30d" | "90d";

const GEOS = [
  { label: "United States", pct: 0.38 },
  { label: "United Kingdom", pct: 0.16 },
  { label: "Germany", pct: 0.11 },
  { label: "Brazil", pct: 0.09 },
  { label: "Japan", pct: 0.07 },
];

const RETENTION = [1, 0.86, 0.79, 0.71, 0.66, 0.62];

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>("30d");
  const [analytics, setAnalytics] = useState<CreatorAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    fetchCreatorAnalytics(days, user?.id)
      .then((data) => {
        if (!cancelled) {
          setAnalytics(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Could not load analytics");
          setIsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [range, user?.id, retryTick]);

  const bars = useMemo(() => {
    if (!analytics || analytics.revenueTrend.length === 0) {
      return Array.from({ length: 10 }, () => 0.3);
    }
    const max = Math.max(...analytics.revenueTrend.map((d) => d.sub_revenue + d.ppv_revenue + d.tip_revenue), 1);
    return analytics.revenueTrend.map((d) => (d.sub_revenue + d.ppv_revenue + d.tip_revenue) / max);
  }, [analytics]);

  if (isLoading) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={Colors.lime} size="large" />
        <Text style={{ color: Colors.textDim, fontSize: 13, fontWeight: "600", marginTop: 12 }}>
          Loading your analytics…
        </Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center", padding: 24 }]}>
        <Text style={{ color: Colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" }}>
          Couldn&apos;t load analytics
        </Text>
        <Text style={{ color: Colors.textDim, fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 16, marginTop: 8 }}>
          {loadError}
        </Text>
        <Chip label="Retry" onPress={() => setRetryTick((t) => t + 1)} active />
      </View>
    );
  }

  if (!analytics) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center", padding: 24 }]}>
        <Text style={{ color: Colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" }}>
          Analytics are for creators only
        </Text>
        <Text style={{ color: Colors.textDim, fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 8 }}>
          Become a creator to unlock earnings, retention, and audience insights.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.rangeRow}>
        {(["7d", "30d", "90d"] as Range[]).map((r) => (
          <Chip key={r} label={r.toUpperCase()} active={range === r} onPress={() => setRange(r)} />
        ))}
      </View>

      <View style={styles.statRow}>
        <StatTile label="Total views" value={formatCount(analytics.totalViews)} sub={range} />
        <StatTile label="Net revenue" value={formatMoney(analytics.netRevenue)} sub="80% share" accent={Colors.success} />
      </View>
      <View style={styles.statRow}>
        <StatTile label="Active subs" value={formatCount(analytics.totalSubs)} sub={range} accent={Colors.cyan} />
        <StatTile label="Tips received" value={formatMoney(analytics.totalTips)} sub={range} accent={Colors.gold} />
      </View>

      <SectionHeader kicker="Momentum" title="Revenue trend" />
      <View style={styles.chartCard}>
        <View style={styles.chart}>
          {bars.map((h, i) => (
            <View key={`bar-${i}`} style={styles.barWrap}>
              <View style={[styles.bar, { height: `${Math.max(h * 100, 4)}%`, backgroundColor: i === bars.length - 1 ? Colors.lime : "rgba(204,255,0,0.28)" }]} />
            </View>
          ))}
        </View>
        <View style={styles.chartFooter}>
          <Text style={styles.chartMeta}>{range === "7d" ? "Last 7 days" : range === "30d" ? "Last 30 days" : "Last 90 days"}</Text>
          <View style={styles.rowGap4}>
            <ArrowUpRight size={13} color={Colors.lime} />
            <Text style={styles.chartUp}>Live data</Text>
          </View>
        </View>
      </View>

      <SectionHeader kicker="Cohorts" title="Subscriber retention" />
      <View style={styles.retentionCard}>
        <View style={styles.rowGap6}>
          <Repeat size={14} color={Colors.lime} />
          <Text style={styles.retentionTitle}>Month-over-month survival</Text>
        </View>
        {RETENTION.map((r, i) => (
          <View key={`m${i}`} style={{ gap: 6, marginTop: 12 }}>
            <View style={styles.mixRow}>
              <Text style={styles.mixLabel}>Month {i}</Text>
              <Text style={styles.mixValue}>{Math.round(r * 100)}%</Text>
            </View>
            <ProgressBar progress={r} />
          </View>
        ))}
      </View>

      <SectionHeader kicker="Geography" title="Who's living your life" />
      <View style={styles.listCard}>
        <View style={styles.rowGap6}>
          <Globe2 size={14} color={Colors.gold} />
          <Text style={styles.retentionTitle}>Top territories</Text>
        </View>
        {GEOS.map((g) => (
          <View key={g.label} style={{ gap: 7, marginTop: 12 }}>
            <View style={styles.mixRow}>
              <Text style={styles.mixLabel}>{g.label}</Text>
              <Text style={styles.mixValue}>{Math.round(g.pct * 100)}%</Text>
            </View>
            <ProgressBar progress={g.pct} color={Colors.gold} />
          </View>
        ))}
      </View>

      {analytics.topEpisodes.length > 0 ? (
        <>
          <SectionHeader kicker="Best performers" title="Top episodes" />
          <View style={{ paddingHorizontal: 18, gap: 10 }}>
            {analytics.topEpisodes.map((e, i) => (
              <View key={e.episode_id} style={styles.topRow}>
                <Text style={styles.topRank}>{i + 1}</Text>
                {e.thumb_url ? (
                  <Image source={{ uri: e.thumb_url }} style={styles.topThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.topThumb, { backgroundColor: Colors.surfaceHi }]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.topTitle} numberOfLines={2}>{e.title}</Text>
                  <Text style={styles.topMeta}>
                    {formatCount(e.total_views)} views · {e.total_unlocks} unlocks · {e.total_likes} likes
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  rangeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16 },
  statRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18, marginBottom: 10 },
  chartCard: {
    marginHorizontal: 18,
    padding: 18,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chart: { height: 150, flexDirection: "row", alignItems: "flex-end", gap: 7 },
  barWrap: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 6 },
  chartFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  chartMeta: { color: Colors.textDim, fontSize: 11.5, fontWeight: "700" },
  chartUp: { color: Colors.lime, fontSize: 12.5, fontWeight: "900" },
  retentionCard: {
    marginHorizontal: 18,
    padding: 18,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retentionTitle: { color: Colors.text, fontSize: 13.5, fontWeight: "800" },
  listCard: {
    marginHorizontal: 18,
    padding: 18,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  mixRow: { flexDirection: "row", justifyContent: "space-between" },
  mixLabel: { color: Colors.text, fontSize: 12.5, fontWeight: "700" },
  mixValue: { color: Colors.textMid, fontSize: 12.5, fontWeight: "900" },
  rowGap4: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowGap6: { flexDirection: "row", alignItems: "center", gap: 7 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topRank: { color: Colors.lime, fontSize: 15, fontWeight: "900", width: 16 },
  topThumb: { width: 58, height: 58, borderRadius: 10, backgroundColor: Colors.surfaceHi },
  topTitle: { color: Colors.text, fontSize: 13, fontWeight: "800", lineHeight: 17 },
  topMeta: { color: Colors.textDim, fontSize: 11, fontWeight: "700", marginTop: 4 },
  microRef: { ...microLabel },
});
