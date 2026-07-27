import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Calendar, Radio, Scissors, Users } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LiveStreamCard } from "@/components/cards";
import { Avatar, Button, Chip, LiveBadge, PressableScale, SectionHeader, Tag } from "@/components/ui";
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

const SCHEDULED: never[] = [];
const CLIPS: never[] = [];

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
      <View style={styles.grid}>
        {streams.map((s) => (
          <View key={s.id} style={styles.gridItem}>
            <LiveStreamCard stream={s} wide />
          </View>
        ))}
      </View>

      <SectionHeader kicker="Fan-made" title="Top clips" action="Clip guide" onAction={() => router.push("/guidelines")} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {CLIPS.map((clip) => {
          const c = clip as unknown as { id: string; creatorId: string; label: string; views: number };
          const creator = getCreator(c.creatorId);
          return (
            <PressableScale key={c.id} scaleTo={0.96} onPress={() => router.push(`/creator/${c.creatorId}`)}>
              <View style={styles.clip}>
                {creator?.cover ? (
                  <Image source={{ uri: creator.cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.ink }]} />}
                <LinearGradient colors={["transparent", "rgba(8,8,10,0.95)"]} style={StyleSheet.absoluteFill} />
                <View style={styles.clipBadge}>
                  <Scissors size={11} color={Colors.ink} />
                  <Text style={styles.clipBadgeText}>CLIP</Text>
                </View>
                <View style={styles.clipBody}>
                  <Text style={styles.clipLabel} numberOfLines={2}>
                    {c.label}
                  </Text>
                  <View style={styles.rowGap4}>
                    <Users size={10} color={Colors.textDim} />
                    <Text style={styles.clipViews}>{formatCount(c.views)}</Text>
                  </View>
                </View>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>

      <SectionHeader kicker="Set a reminder" title="Scheduled POVs" />
      <View style={styles.schedWrap}>
        {SCHEDULED.map((item) => {
          const s = item as unknown as { id: string; creatorId: string; title: string; when: string; access: string };
          const creator = getCreator(s.creatorId);
          return (
            <PressableScale key={s.id} scaleTo={0.98} onPress={() => router.push(`/creator/${s.creatorId}`)}>
              <View style={styles.schedRow}>
                <View style={styles.schedWhen}>
                  <Calendar size={13} color={Colors.lime} />
                  <Text style={styles.schedWhenText}>{s.when}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.schedTitle} numberOfLines={1}>
                    {s.title}
                  </Text>
                  <Text style={styles.schedSub}>
                    @{creator?.handle ?? "creator"} · {s.access}
                  </Text>
                </View>
              </View>
            </PressableScale>
          );
        })}
      </View>

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
  rail: { paddingHorizontal: 18, gap: 12 },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  rowGap4: { flexDirection: "row", alignItems: "center", gap: 4 },
  clip: {
    width: 140,
    height: 210,
    borderRadius: Radius.md,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    justifyContent: "flex-end",
  },
  clipBadge: {
    position: "absolute",
    top: 9,
    left: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.lime,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  clipBadgeText: { color: Colors.ink, ...microLabel, fontSize: 9 },
  clipBody: { padding: 11, gap: 5 },
  clipLabel: { color: Colors.text, fontSize: 12.5, fontWeight: "800", lineHeight: 16 },
  clipViews: { color: Colors.textDim, fontSize: 10.5, fontWeight: "700" },
  schedWrap: {
    marginHorizontal: 18,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  schedRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  schedWhen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(204,255,0,0.1)",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  schedWhenText: { color: Colors.lime, fontSize: 11.5, fontWeight: "900" },
  schedTitle: { color: Colors.text, fontSize: 13.5, fontWeight: "800" },
  schedSub: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 2 },
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
