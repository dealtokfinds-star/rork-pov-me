import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Radio } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LiveStreamCard } from "@/components/cards";
import { Avatar, Button, Chip, EmptyState, LiveBadge, PressableScale, SectionHeader, Tag } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import {
  CATEGORIES,
  categoryById,
  formatCount,
  formatMoney,
} from "@/constants/mock-data";
import { useCreators, useStreams } from "@/lib/data";
import { useApp } from "@/providers/app-provider";
import type { Creator, PovCategory } from "@/types";

export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isCreator } = useApp();
  const [category, setCategory] = useState<PovCategory | "all">("all");
  const { data: streamsData } = useStreams();
  const { data: creatorsData } = useCreators();
  const allStreams = streamsData ?? [];
  const allCreators = creatorsData ?? [];
  const creatorsById = useMemo(() => {
    const map = new Map<string, Creator>();
    allCreators.forEach((c) => map.set(c.id, c));
    return map;
  }, [allCreators]);
  const getCreator = useCallback((cid: string) => creatorsById.get(cid), [creatorsById]);

  const streams = useMemo(
    () => (category === "all" ? allStreams : allStreams.filter((s) => s.category === category)),
    [category, allStreams],
  );
  const featured = streams[0];
  const totalViewers = useMemo(() => allStreams.reduce((sum, s) => sum + s.viewers, 0), [allStreams]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            <LiveBadge />
            <Text style={styles.headerCount}>{formatCount(totalViewers)} watching now</Text>
          </View>
          <Text style={styles.title}>Live right now</Text>
        </View>
        <PressableScale
          onPress={() => router.push(isCreator ? "/golive" : "/become-creator")}
          scaleTo={0.94}
        >
          <View style={styles.goLive}>
            <Radio size={14} color="#fff" />
            <Text style={styles.goLiveText}>Go live</Text>
          </View>
        </PressableScale>
      </View>

      {featured ? (
        <PressableScale scaleTo={0.985} onPress={() => router.push(`/live/${featured.id}`)}>
          <View style={styles.featured}>
            <Image source={{ uri: featured.thumb }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
              colors={["rgba(255,45,111,0.25)", "rgba(8,8,10,0.35)", "rgba(8,8,10,0.96)"]}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.featuredTop}>
              <LiveBadge viewers={featured.viewers} />
              <Tag
                label={featured.access === "ppv" ? `PPV ${formatMoney(featured.ppvPrice ?? 0)}` : featured.access === "subscribers" ? "Subs only" : "Open to all"}
                color={featured.access === "ppv" ? Colors.ink : Colors.text}
                bg={featured.access === "ppv" ? Colors.cyan : "rgba(0,0,0,0.55)"}
              />
            </View>
            <View style={styles.featuredBody}>
              <View style={styles.rowCenter}>
                <Avatar uri={getCreator(featured.creatorId)?.avatar ?? ""} size={38} ring live />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.featuredName}>{getCreator(featured.creatorId)?.name ?? "Creator"}</Text>
                  <Text style={styles.featuredIdentity}>
                    {categoryById(featured.category).emoji} {getCreator(featured.creatorId)?.identity ?? ""}
                  </Text>
                </View>
              </View>
              <Text style={styles.featuredTitle}>{featured.title}</Text>
              <Button
                label="Enter the POV"
                variant="live"
                onPress={() => router.push(`/live/${featured.id}`)}
                style={{ marginTop: 12 }}
              />
            </View>
          </View>
        </PressableScale>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
        <Chip label="All" active={category === "all"} onPress={() => setCategory("all")} />
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
      </ScrollView>

      <SectionHeader kicker="Browse live" title="All channels" />
      {streams.length === 0 ? (
        <EmptyState
          icon={<Radio size={24} color={Colors.magenta} />}
          title={category === "all" ? "Nobody is live right now" : "Nothing live in this category"}
          body={
            category === "all"
              ? "Streams appear here the second a creator goes live. Explore creators and turn on notifications so you never miss one."
              : "Try another lifestyle filter, or browse all channels."
          }
          action={category === "all" ? "Explore creators" : "Show all channels"}
          onAction={() =>
            category === "all" ? router.push("/explore") : setCategory("all")
          }
        />
      ) : (
        <View style={styles.grid}>
          {streams.map((s) => (
            <View key={s.id} style={styles.gridItem}>
              <LiveStreamCard stream={s} wide />
            </View>
          ))}
        </View>
      )}

      <View style={styles.creatorPromo}>
        <Text style={styles.promoKicker}>For creators</Text>
        <Text style={styles.promoTitle}>Stream from a chest rig, phone, or desktop.</Text>
        <Text style={styles.promoBody}>
          Choose public, subscriber-only, or pay-per-view before you go live. Chat moderation,
          slow mode, co-hosts, paid replays, and live earnings — all built in. You keep 80%.
        </Text>
        <Button
          label={isCreator ? "Open the live console" : "Start earning on povme"}
          onPress={() => router.push(isCreator ? "/golive" : "/become-creator")}
          style={{ marginTop: 16 }}
        />
        <View style={styles.promoStats}>
          <Text style={styles.promoStat}>{allCreators.length} creators live weekly</Text>
          <Text style={styles.promoStat}>80/20 split</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 18, paddingBottom: 16, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 8 },
  headerCount: { color: Colors.textMid, fontSize: 12, fontWeight: "700" },
  title: { color: Colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1 },
  goLive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 15,
    borderRadius: Radius.pill,
    backgroundColor: Colors.magenta,
  },
  goLiveText: { color: "#fff", fontSize: 13.5, fontWeight: "900" },
  featured: {
    marginHorizontal: 14,
    height: 430,
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    justifyContent: "flex-end",
  },
  featuredTop: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  featuredBody: { padding: 18, gap: 10 },
  featuredName: { color: Colors.text, fontSize: 15, fontWeight: "900" },
  featuredIdentity: { color: Colors.textMid, fontSize: 12, fontWeight: "600", marginTop: 2 },
  featuredTitle: { color: Colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.7, lineHeight: 27 },
  chipRail: { paddingHorizontal: 18, gap: 8, paddingTop: 22 },
  grid: { paddingHorizontal: 14, gap: 14 },
  gridItem: { width: "100%" },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  creatorPromo: {
    margin: 18,
    marginTop: 28,
    padding: 22,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255,45,111,0.28)",
  },
  promoKicker: { ...microLabel, color: Colors.magenta, marginBottom: 9 },
  promoTitle: { color: Colors.text, fontSize: 20, fontWeight: "900", letterSpacing: -0.6, lineHeight: 25 },
  promoBody: { color: Colors.textMid, fontSize: 13, fontWeight: "500", lineHeight: 20, marginTop: 9 },
  promoStats: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  promoStat: { ...microLabel, color: Colors.textDim, fontSize: 9.5 },
});
