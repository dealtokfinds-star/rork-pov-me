import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  BadgeCheck,
  ChevronLeft,
  MapPin,
  MessageCircle,
  Radio,
  Sparkles,
  Star,
  Users,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EpisodeCard, EpisodeTile, LiveStreamCard } from "@/components/cards";
import { Avatar, Button, Chip, PressableScale, SectionHeader, Tag } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { categoryById, formatCount, formatMoney } from "@/lib/format";
import { useCreator, useCreatorEpisodes, useStreams } from "@/lib/data";
import { useApp } from "@/providers/app-provider";

type Tab = "episodes" | "premium" | "about";

export default function CreatorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSubscribed, tipTotals } = useApp();
  const [tab, setTab] = useState<Tab>("episodes");

  const { data: creator, isLoading } = useCreator(id ?? "");
  const { data: episodes = [] } = useCreatorEpisodes(id ?? "");
  const { data: streams = [] } = useStreams();
  const stream = useMemo(
    () => streams.find((s) => s.creatorId === id),
    [streams, id],
  );

  if (isLoading) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: Colors.textMid, fontSize: 14, fontWeight: 700 }}>Loading…</Text>
      </View>
    );
  }

  if (!creator) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 60, paddingHorizontal: 24 }]}>
        <Text style={styles.bigTitle}>Creator not found</Text>
        <Button label="Back" onPress={() => router.back()} style={{ marginTop: 18 }} />
      </View>
    );
  }

  const subbed = isSubscribed(creator.id);
  const tipped = tipTotals[creator.id] ?? 0;
  const premium = episodes.filter((e) => e.access === "ppv");
  const free = episodes.filter((e) => e.access === "free");

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        <View style={styles.cover}>
          <Image source={{ uri: creator.cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors=  {["rgba(8,8,10,0.45)", "rgba(8,8,10,0.55)", Colors.bg]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <PressableScale onPress={() => router.back()} scaleTo={0.9} style={[styles.backBtn, { top: insets.top + 10 }]}>
            <View style={styles.backCircle}>
              <ChevronLeft size={20} color={Colors.text} />
            </View>
          </PressableScale>
          {creator.isLive && stream ? (
            <PressableScale onPress={() => router.push(`/live/${stream.id}`)} style={[styles.liveTop, { top: insets.top + 12 }]}>
              <View style={styles.liveTopPill}>
                <Radio size={12} color="#fff" />
                <Text style={styles.liveTopText}>WATCH LIVE</Text>
              </View>
            </PressableScale>
          ) : null}
        </View>

        <View style={styles.headerBody}>
          <Avatar uri={creator.avatar} size={80} ring live={creator.isLive} />
          <View style={styles.nameRow}>
            <Text style={styles.bigTitle}>{creator.name}</Text>
            {creator.verified ? <BadgeCheck size={19} color={Colors.lime} /> : null}
          </View>
          <Text style={styles.handle}>@{creator.handle}</Text>

          <View style={styles.tagRow}>
            {creator.categories.map((c) => {
              const cat = categoryById(c);
              return <Tag key={c} label={`${cat.emoji} ${cat.label}`} color={Colors.text} bg="rgba(255,255,255,0.08)" />;
            })}
          </View>

          <Text style={styles.bio}>{creator.bio}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Users size={13} color={Colors.textDim} />
              <Text style={styles.metaText}>{formatCount(creator.subscribers)} subs</Text>
            </View>
            <View style={styles.metaItem}>
              <MapPin size={13} color={Colors.textDim} />
              <Text style={styles.metaText}>{creator.location}</Text>
            </View>
            <View style={styles.metaItem}>
              <Star size={13} color={Colors.gold} fill={Colors.gold} />
              <Text style={styles.metaText}>{creator.rating.toFixed(1)}</Text>
            </View>
          </View>

          {subbed ? (
            <View style={styles.subbedBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subbedKicker}>You are living this life</Text>
                <Text style={styles.subbedText}>
                  Full feed unlocked · {formatMoney(creator.subPrice)}/mo
                  {tipped > 0 ? ` · ${formatMoney(tipped)} tipped` : ""}
                </Text>
              </View>
              <PressableScale onPress={() => router.push("/messages")} scaleTo={0.9}>
                <View style={styles.iconSquare}>
                  <MessageCircle size={17} color={Colors.lime} />
                </View>
              </PressableScale>
              <PressableScale onPress={() => router.push(`/tip/${creator.id}`)} scaleTo={0.9}>
                <View style={[styles.iconSquare, { backgroundColor: "rgba(255,182,39,0.12)", borderColor: "rgba(255,182,39,0.3)" }]}>
                  <Sparkles size={17} color={Colors.gold} />
                </View>
              </PressableScale>
            </View>
          ) : (
            <View style={{ width: "100%", gap: 10, marginTop: 20 }}>
              <Button
                label={`Subscribe to live as them · ${formatMoney(creator.subPrice)}/mo`}
                onPress={() => router.push(`/subscribe/${creator.id}`)}
              />
              <View style={styles.secondaryRow}>
                <Button
                  label="Send a tip"
                  variant="dark"
                  small
                  onPress={() => router.push(`/tip/${creator.id}`)}
                  style={{ flex: 1 }}
                />
                <Button
                  label={`${free.length} free POVs`}
                  variant="ghost"
                  small
                  onPress={() => setTab("episodes")}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}
        </View>

        {creator.isLive && stream ? (
          <>
            <SectionHeader kicker="Streaming now" title="Live POV" />
            <View style={{ paddingHorizontal: 14 }}>
              <LiveStreamCard stream={stream} wide />
            </View>
          </>
        ) : null}

        <View style={styles.tabRow}>
          <Chip label={`Episodes ${episodes.length}`} active={tab === "episodes"} onPress={() => setTab("episodes")} />
          <Chip label={`Premium ${premium.length}`} active={tab === "premium"} accent={Colors.cyan} onPress={() => setTab("premium")} />
          <Chip label="About" active={tab === "about"} onPress={() => setTab("about")} />
        </View>

        {tab === "episodes" ? (
          <View style={{ marginTop: 20 }}>
            {episodes.map((e) => (
              <EpisodeCard key={e.id} episode={e} />
            ))}
          </View>
        ) : null}

        {tab === "premium" ? (
          <View style={{ marginTop: 18, paddingHorizontal: 18 }}>
            <Text style={styles.premiumIntro}>
              One-time unlocks. Yours forever, no subscription needed.
            </Text>
            <View style={styles.premiumGrid}>
              {premium.length > 0 ? (
                premium.map((e) => <EpisodeTile key={e.id} episode={e} width={168} />)
              ) : (
                <Text style={styles.metaText}>No premium experiences posted yet.</Text>
              )}
            </View>
          </View>
        ) : null}

        {tab === "about" ? (
          <View style={styles.about}>
            <Text style={styles.aboutKicker}>Identity</Text>
            <Text style={styles.aboutText}>
              {creator.identity} based in {creator.location}. {episodes.length} POV episodes filmed
              on chest rig and glasses cam.
            </Text>
            <Text style={styles.aboutKicker}>What you get</Text>
            <Text style={styles.aboutText}>
              • Full POV feed, new episodes weekly{"\n"}• Chapters: work, gym, night out, travel
              {"\n"}• Direct messages with {creator.name.split(" ")[0]}
              {"\n"}• Early access to live streams and paid replays
            </Text>
            <Text style={styles.aboutKicker}>Pricing</Text>
            <Text style={styles.aboutText}>
              {formatMoney(creator.subPrice)}/mo · cancel anytime · premium POVs sold separately.
              Creator keeps 80%.
            </Text>
            <PressableScale onPress={() => router.push("/guidelines")}>
              <Text style={styles.reportLink}>Report this creator or content</Text>
            </PressableScale>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  cover: { height: 250 },
  backBtn: { position: "absolute", left: 14 },
  backCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  liveTop: { position: "absolute", right: 14 },
  liveTopPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.magenta,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: Radius.pill,
  },
  liveTopText: { color: "#fff", ...microLabel, fontSize: 10 },
  headerBody: { alignItems: "center", paddingHorizontal: 20, marginTop: -46 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12 },
  bigTitle: { color: Colors.text, fontSize: 25, fontWeight: "900", letterSpacing: -0.9 },
  handle: { color: Colors.textDim, fontSize: 13, fontWeight: "700", marginTop: 3 },
  tagRow: { flexDirection: "row", gap: 6, marginTop: 12, flexWrap: "wrap", justifyContent: "center" },
  bio: {
    color: Colors.textMid,
    fontSize: 13.5,
    fontWeight: "500",
    lineHeight: 20,
    textAlign: "center",
    marginTop: 14,
  },
  metaRow: { flexDirection: "row", gap: 18, marginTop: 14 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: Colors.textDim, fontSize: 12, fontWeight: "700" },
  secondaryRow: { flexDirection: "row", gap: 10 },
  subbedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    marginTop: 20,
    padding: 15,
    borderRadius: Radius.md,
    backgroundColor: "rgba(204,255,0,0.07)",
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.25)",
  },
  subbedKicker: { ...microLabel, color: Colors.lime },
  subbedText: { color: Colors.text, fontSize: 12.5, fontWeight: "700", marginTop: 5 },
  iconSquare: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(204,255,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18, marginTop: 26 },
  premiumIntro: { color: Colors.textMid, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  premiumGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
  about: { paddingHorizontal: 20, marginTop: 22, gap: 8 },
  aboutKicker: { ...microLabel, color: Colors.lime, marginTop: 14 },
  aboutText: { color: Colors.textMid, fontSize: 13.5, fontWeight: "500", lineHeight: 21 },
  reportLink: {
    color: Colors.textDim,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 26,
    textDecorationLine: "underline",
  },
});
