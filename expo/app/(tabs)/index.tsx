import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useRouter } from "expo-router";
import { Bell, Inbox, Wallet2, Zap } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CreatorCard, EpisodeCard, LiveStreamCard } from "@/components/cards";
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  PressableScale,
  SectionHeader,
} from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { CATEGORIES, CREATORS, formatMoney } from "@/constants/mock-data";
import { useCreators, useEpisodes, useStreams } from "@/lib/data";
import { useApp } from "@/providers/app-provider";
import type { Episode, PovCategory } from "@/types";

type FeedMode = "following" | "for-you";

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { onboarded, hydrated, activeSubs, balance, displayName, interests } = useApp();
  const [mode, setMode] = useState<FeedMode>(activeSubs.length > 0 ? "following" : "for-you");
  const [category, setCategory] = useState<PovCategory | "all">("all");

  const { data: streamsData } = useStreams();
  const { data: episodesData } = useEpisodes();
  const { data: creatorsData } = useCreators();

  const liveNow = useMemo(() => (streamsData ?? []).filter((s) => s.viewers > 0), [streamsData]);
  const allEpisodes = episodesData ?? [];
  const allCreators = creatorsData ?? CREATORS;

  const episodes = useMemo<Episode[]>(() => {
    const subIds = new Set(activeSubs.map((s) => s.creatorId));
    let list =
      mode === "following" ? allEpisodes.filter((e) => subIds.has(e.creatorId)) : [...allEpisodes];
    if (mode === "for-you" && interests.length > 0) {
      list = [
        ...list.filter((e) => interests.includes(e.category)),
        ...list.filter((e) => !interests.includes(e.category)),
      ];
    }
    if (category !== "all") list = list.filter((e) => e.category === category);
    return list;
  }, [mode, activeSubs, category, interests, allEpisodes]);

  if (!hydrated) return <View style={styles.screen} />;
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <View style={styles.screen}>
      <FlatList
        data={episodes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <EpisodeCard episode={item} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        ListHeaderComponent={
          <View>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.wordmark}>
                  POV<Text style={{ color: Colors.lime }}>ME</Text>
                </Text>
                <Text style={styles.greeting}>
                  Today you can be anyone, {displayName}.
                </Text>
              </View>
              <PressableScale onPress={() => router.push("/wallet")} scaleTo={0.92}>
                <View style={styles.walletPill}>
                  <Wallet2 size={13} color={Colors.lime} />
                  <Text style={styles.walletText}>{formatMoney(balance)}</Text>
                </View>
              </PressableScale>
              <PressableScale onPress={() => router.push("/messages")} scaleTo={0.9}>
                <View style={styles.iconCircle}>
                  <Inbox size={17} color={Colors.textMid} />
                </View>
              </PressableScale>
              <PressableScale onPress={() => router.push("/notifications")} scaleTo={0.9}>
                <View style={styles.iconCircle}>
                  <Bell size={17} color={Colors.textMid} />
                  <View style={styles.dot} />
                </View>
              </PressableScale>
            </View>

            <View style={styles.modeRow}>
              <ModeTab
                label="Following"
                active={mode === "following"}
                onPress={() => setMode("following")}
                count={activeSubs.length}
              />
              <ModeTab
                label="Discover"
                active={mode === "for-you"}
                onPress={() => setMode("for-you")}
              />
            </View>

            {liveNow.length > 0 ? (
              <>
                <SectionHeader
                  kicker="Happening now"
                  title="Live POVs"
                  action="All live"
                  onAction={() => router.push("/live")}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rail}
                >
                  {liveNow.map((s) => (
                    <LiveStreamCard key={s.id} stream={s} />
                  ))}
                </ScrollView>
              </>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRail}
            >
              <Chip label="All POVs" active={category === "all"} onPress={() => setCategory("all")} />
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

            <SectionHeader
              kicker={mode === "following" ? "From your subscriptions" : "Fresh drops"}
              title={mode === "following" ? "Your timeline" : "New POV episodes"}
            />
          </View>
        }
        ListEmptyComponent={
          mode === "following" ? (
            <View>
              <EmptyState
                icon={<Zap size={26} color={Colors.lime} />}
                title="Your timeline is empty"
                body="Subscribe to a creator and their POV episodes land here the moment they drop."
                action="Find creators"
                onAction={() => router.push("/explore")}
              />
              <SectionHeader kicker="Start here" title="Most-watched lives" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rail}
              >
                {allCreators.slice(0, 6).map((c) => (
                  <CreatorCard key={c.id} creator={c} />
                ))}
              </ScrollView>
            </View>
          ) : (
            <EmptyState
              title="Nothing in this category yet"
              body="Try another lifestyle filter — new POVs drop every hour."
            />
          )
        }
        ListFooterComponent={
          episodes.length > 0 ? (
            <PressableScale onPress={() => router.push("/explore")}>
              <View style={styles.promo}>
                <Image
                  source={{ uri: allCreators[3]?.cover ?? "" }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
                <LinearGradient
                  colors={["rgba(8,8,10,0.35)", "rgba(8,8,10,0.95)"]}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.promoKicker}>Keep going</Text>
                <Text style={styles.promoTitle}>
                  You&apos;ve seen the day. Now live somebody else&apos;s.
                </Text>
                <Button
                  label="Explore creators"
                  full={false}
                  small
                  style={{ marginTop: 14 }}
                  onPress={() => router.push("/explore")}
                />
              </View>
            </PressableScale>
          ) : null
        }
      />
    </View>
  );
}

function ModeTab({
  label,
  active,
  onPress,
  count,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.95} style={{ flex: 1 }}>
      <View style={[styles.modeTab, active && styles.modeTabActive]}>
        <Text style={[styles.modeLabel, active && { color: Colors.ink }]}>{label}</Text>
        {count !== undefined && count > 0 ? (
          <View style={[styles.modeCount, active && { backgroundColor: "rgba(0,0,0,0.15)" }]}>
            <Text style={[styles.modeCountText, active && { color: Colors.ink }]}>{count}</Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  wordmark: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  greeting: { color: Colors.textDim, fontSize: 12, fontWeight: "600", marginTop: 2 },
  walletPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(204,255,0,0.1)",
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.28)",
  },
  walletText: { color: Colors.lime, fontSize: 12.5, fontWeight: "900" },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 7,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.magenta,
    borderWidth: 1.5,
    borderColor: Colors.bg,
  },
  modeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18 },
  modeTab: {
    height: 42,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  modeTabActive: { backgroundColor: Colors.lime, borderColor: Colors.lime },
  modeLabel: { color: Colors.textMid, fontSize: 14, fontWeight: "800" },
  modeCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  modeCountText: { color: Colors.textMid, fontSize: 11, fontWeight: "900" },
  rail: { paddingHorizontal: 14, gap: 12, paddingBottom: 4 },
  chipRail: { paddingHorizontal: 18, gap: 8, marginTop: 22 },
  promo: {
    margin: 14,
    marginTop: 4,
    padding: 22,
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    minHeight: 190,
    justifyContent: "flex-end",
  },
  promoKicker: { ...microLabel, color: Colors.lime, marginBottom: 8 },
  promoTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.6,
    lineHeight: 27,
  },
});
