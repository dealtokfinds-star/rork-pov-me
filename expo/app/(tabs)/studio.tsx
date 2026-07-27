import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  BarChart3,
  Banknote,
  CircleDollarSign,
  Clock,
  FileEdit,
  Lock,
  Plus,
  Radio,
  Shield,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Chip, EmptyState, PressableScale, ProgressBar, SectionHeader, StatTile, Tag } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { formatCount, formatMoney } from "@/constants/mock-data";
import { useStudioEpisodes } from "@/lib/data";
import { useAuth } from "@/hooks/useAuth";
import { useApp } from "@/providers/app-provider";
import type { StudioEpisode } from "@/types";

type Filter = "all" | "published" | "scheduled" | "draft";

export default function StudioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isCreator, studio: localStudio, creatorStats, creatorPrice, deleteStudioEpisode, displayName } = useApp();
  const { user } = useAuth();
  const { data: dbEpisodes } = useStudioEpisodes(user?.id ?? null);
  const [filter, setFilter] = useState<Filter>("all");

  // Merge real DB episodes with any optimistic local entries. DB wins on id
  // collision so a just-published episode shows its real status/thumbnail.
  const studio = useMemo<StudioEpisode[]>(() => {
    if (!dbEpisodes || dbEpisodes.length === 0) return localStudio;
    const localById = new Map(localStudio.map((e) => [e.id, e]));
    const merged: StudioEpisode[] = [...dbEpisodes];
    for (const [id, ep] of localById) {
      if (!dbEpisodes.some((d) => d.id === id)) merged.push(ep);
    }
    return merged;
  }, [dbEpisodes, localStudio]);

  const list = useMemo<StudioEpisode[]>(
    () => (filter === "all" ? studio : studio.filter((e) => e.status === filter)),
    [studio, filter],
  );

  if (!isCreator) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.pitchHero, { paddingTop: insets.top + 40 }]}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=900&q=80",
            }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={["rgba(8,8,10,0.45)", "rgba(8,8,10,0.9)", Colors.bg]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.pitchKicker}>Creator studio</Text>
          <Text style={styles.pitchTitle}>Turn your day into a series people pay to live.</Text>
          <Text style={styles.pitchBody}>
            Strap on a chest rig. Upload the raw day. Set your price. Keep 80% of every
            subscription, tip, PPV unlock, and live gift.
          </Text>
          <Button
            label="Become a creator"
            onPress={() => router.push("/become-creator")}
            style={{ marginTop: 20 }}
          />
        </View>

        <SectionHeader kicker="What you get" title="Everything to run the business" />
        <View style={styles.featureGrid}>
          {[
            { icon: <CircleDollarSign size={18} color={Colors.lime} />, t: "Subscriptions", b: "$4.99–$49.99/mo, you set it" },
            { icon: <Lock size={18} color={Colors.cyan} />, t: "PPV episodes", b: "One-time unlocks & bundles" },
            { icon: <Radio size={18} color={Colors.magenta} />, t: "Live POV", b: "Public, subs-only, or paid" },
            { icon: <Sparkles size={18} color={Colors.gold} />, t: "Tips & gifts", b: "On posts, DMs, and live" },
            { icon: <BarChart3 size={18} color={Colors.lime} />, t: "Analytics", b: "Retention, LTV, top episodes" },
            { icon: <Banknote size={18} color={Colors.success} />, t: "Fast payouts", b: "Weekly, KYC verified" },
          ].map((f) => (
            <View key={f.t} style={styles.featureCard}>
              {f.icon}
              <Text style={styles.featureTitle}>{f.t}</Text>
              <Text style={styles.featureBody}>{f.b}</Text>
            </View>
          ))}
        </View>

        <View style={styles.splitCard}>
          <Text style={styles.splitKicker}>The split</Text>
          <View style={styles.splitRow}>
            <Text style={styles.splitBig}>80%</Text>
            <Text style={styles.splitLabel}>you keep</Text>
          </View>
          <ProgressBar progress={0.8} />
          <Text style={styles.splitBody}>
            povme takes 20% to cover hosting, video processing, payments, moderation, and support.
            No upload fees, no minimums.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Creator studio</Text>
          <Text style={styles.title}>@{displayName.toLowerCase()}</Text>
        </View>
        <PressableScale onPress={() => router.push("/upload")} scaleTo={0.93}>
          <View style={styles.plusBtn}>
            <Plus size={20} color={Colors.ink} />
          </View>
        </PressableScale>
      </View>

      <View style={styles.balanceCard}>
        <LinearGradient
          colors={["rgba(204,255,0,0.16)", "rgba(19,19,24,0.2)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.balanceLabel}>Available to withdraw</Text>
        <Text style={styles.balanceValue}>{formatMoney(creatorStats.net)}</Text>
        <View style={styles.balanceMeta}>
          <View style={styles.rowGap4}>
            <TrendingUp size={12} color={Colors.lime} />
            <Text style={styles.balanceMetaText}>
              {formatMoney(creatorStats.gross)} gross · 80% share
            </Text>
          </View>
        </View>
        <View style={styles.balanceActions}>
          <Button label="Withdraw" small full={false} onPress={() => router.push("/earnings")} />
          <Button
            label="Analytics"
            variant="dark"
            small
            full={false}
            onPress={() => router.push("/analytics")}
          />
        </View>
      </View>

      <View style={styles.statRow}>
        <StatTile label="Subscribers" value={formatCount(creatorStats.subs)} sub="+42 this week" />
        <StatTile
          label="PPV unlocks"
          value={`${creatorStats.ppvUnlocks}`}
          sub="last 30 days"
          accent={Colors.cyan}
        />
      </View>
      <View style={styles.statRow}>
        <StatTile
          label="Tips"
          value={formatMoney(creatorStats.tips)}
          sub="this month"
          accent={Colors.gold}
        />
        <StatTile
          label="Retention"
          value={`${Math.round(creatorStats.retention * 100)}%`}
          sub="30-day"
          accent={Colors.magenta}
        />
      </View>

      <View style={styles.quickRow}>
        <QuickAction
          icon={<Radio size={17} color={Colors.magenta} />}
          label="Go live"
          onPress={() => router.push("/golive")}
        />
        <QuickAction
          icon={<Plus size={17} color={Colors.lime} />}
          label="Upload"
          onPress={() => router.push("/upload")}
        />
        <QuickAction
          icon={<Banknote size={17} color={Colors.success} />}
          label="Payouts"
          onPress={() => router.push("/earnings")}
        />
        <QuickAction
          icon={<Shield size={17} color={Colors.cyan} />}
          label="Safety"
          onPress={() => router.push("/admin")}
        />
      </View>

      <View style={styles.priceCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.priceLabel}>Your subscription price</Text>
          <Text style={styles.priceValue}>{formatMoney(creatorPrice)}/mo</Text>
          <Text style={styles.priceHint}>Sweet spot for your niche: $9.99–$14.99</Text>
        </View>
        <Button label="Edit" variant="dark" small full={false} onPress={() => router.push("/settings")} />
      </View>

      <SectionHeader kicker="My episodes" title={`${studio.length} in the vault`} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
        {(["all", "published", "scheduled", "draft"] as Filter[]).map((f) => (
          <Chip
            key={f}
            label={f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            active={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </ScrollView>

      {list.length === 0 ? (
        <EmptyState
          icon={<FileEdit size={22} color={Colors.textMid} />}
          title="Nothing here yet"
          body="Upload a POV episode or schedule one for later — your vault keeps everything."
          action="New episode"
          onAction={() => router.push("/upload")}
        />
      ) : (
        <View style={styles.epList}>
          {list.map((ep) => (
            <View key={ep.id} style={styles.epRow}>
              <Image source={{ uri: ep.thumb }} style={styles.epThumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.epTitle} numberOfLines={2}>
                  {ep.title}
                </Text>
                <View style={styles.epTags}>
                  {ep.status === "published" ? (
                    <Tag label="Published" color={Colors.ink} bg={Colors.lime} />
                  ) : ep.status === "scheduled" ? (
                    <Tag
                      label={`Scheduled · ${ep.postedAt}`}
                      color={Colors.ink}
                      bg={Colors.gold}
                      icon={<Clock size={9} color={Colors.ink} />}
                    />
                  ) : (
                    <Tag label="Draft" color={Colors.textMid} bg="rgba(255,255,255,0.1)" />
                  )}
                  <Tag
                    label={
                      ep.access === "ppv"
                        ? `PPV ${formatMoney(ep.ppvPrice ?? 0)}`
                        : ep.access === "free"
                          ? "Free"
                          : "Subs"
                    }
                    color={ep.access === "ppv" ? Colors.ink : Colors.textMid}
                    bg={ep.access === "ppv" ? Colors.cyan : "rgba(255,255,255,0.07)"}
                  />
                </View>
                <View style={styles.epStats}>
                  <View style={styles.rowGap4}>
                    <Users size={11} color={Colors.textDim} />
                    <Text style={styles.epStatText}>{formatCount(ep.views)}</Text>
                  </View>
                  <Text style={[styles.epStatText, { color: Colors.lime }]}>
                    {formatMoney(ep.earned)}
                  </Text>
                </View>
              </View>
              <PressableScale onPress={() => deleteStudioEpisode(ep.id)} scaleTo={0.85}>
                <View style={styles.trash}>
                  <Trash2 size={15} color={Colors.textDim} />
                </View>
              </PressableScale>
            </View>
          ))}
        </View>
      )}

      <PressableScale onPress={() => router.push("/guidelines")}>
        <View style={styles.guideRow}>
          <Shield size={16} color={Colors.cyan} />
          <Text style={styles.guideText}>Content guidelines & payout compliance</Text>
        </View>
      </PressableScale>
    </ScrollView>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.94} style={{ flex: 1 }}>
      <View style={styles.quickAction}>
        {icon}
        <Text style={styles.quickLabel}>{label}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 18, paddingBottom: 16, gap: 12 },
  kicker: { ...microLabel, color: Colors.lime, marginBottom: 6 },
  title: { color: Colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -1 },
  plusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  pitchHero: {
    paddingHorizontal: 22,
    paddingBottom: 32,
    minHeight: 480,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  pitchKicker: { ...microLabel, color: Colors.lime, marginBottom: 10 },
  pitchTitle: { color: Colors.text, fontSize: 32, fontWeight: "900", letterSpacing: -1.2, lineHeight: 36 },
  pitchBody: { color: Colors.textMid, fontSize: 14, fontWeight: "500", lineHeight: 21, marginTop: 12 },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 18 },
  featureCard: {
    width: 168,
    padding: 15,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 7,
  },
  featureTitle: { color: Colors.text, fontSize: 14, fontWeight: "800", marginTop: 4 },
  featureBody: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", lineHeight: 16 },
  splitCard: {
    margin: 18,
    padding: 20,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  splitKicker: { ...microLabel, color: Colors.lime },
  splitRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  splitBig: { color: Colors.text, fontSize: 44, fontWeight: "900", letterSpacing: -2 },
  splitLabel: { color: Colors.textMid, fontSize: 14, fontWeight: "700", marginBottom: 8 },
  splitBody: { color: Colors.textDim, fontSize: 12.5, fontWeight: "500", lineHeight: 19 },
  balanceCard: {
    marginHorizontal: 18,
    padding: 20,
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.24)",
  },
  balanceLabel: { ...microLabel, color: Colors.lime },
  balanceValue: {
    color: Colors.text,
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: -1.8,
    marginTop: 8,
  },
  balanceMeta: { marginTop: 6 },
  balanceMetaText: { color: Colors.textMid, fontSize: 12, fontWeight: "700" },
  balanceActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  statRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18, marginTop: 10 },
  quickRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18, marginTop: 14 },
  quickAction: {
    height: 74,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  quickLabel: { color: Colors.textMid, fontSize: 11.5, fontWeight: "800" },
  priceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 18,
    marginTop: 14,
    padding: 16,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  priceLabel: { ...microLabel, color: Colors.textDim },
  priceValue: { color: Colors.text, fontSize: 20, fontWeight: "900", marginTop: 6 },
  priceHint: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 3 },
  chipRail: { paddingHorizontal: 18, gap: 8, paddingBottom: 6 },
  epList: { paddingHorizontal: 18, gap: 10, marginTop: 14 },
  epRow: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  epThumb: { width: 74, height: 74, borderRadius: 12, backgroundColor: Colors.surfaceHi },
  epTitle: { color: Colors.text, fontSize: 13.5, fontWeight: "800", lineHeight: 18 },
  epTags: { flexDirection: "row", gap: 6, marginTop: 7 },
  epStats: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 7 },
  epStatText: { color: Colors.textDim, fontSize: 11.5, fontWeight: "800" },
  rowGap4: { flexDirection: "row", alignItems: "center", gap: 4 },
  trash: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceHi,
  },
  guideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 18,
    padding: 15,
    borderRadius: Radius.md,
    backgroundColor: "rgba(53,231,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(53,231,255,0.2)",
  },
  guideText: { color: Colors.text, fontSize: 13, fontWeight: "700" },
});
