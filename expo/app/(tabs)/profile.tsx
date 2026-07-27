import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Bell,
  Bookmark,
  ChevronRight,
  CreditCard,
  Heart,
  Inbox,
  LogOut,
  Radio,
  Shield,
  Sparkles,
  Users,
  Wallet2,
} from "lucide-react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EpisodeTile } from "@/components/cards";
import { Avatar, Button, PressableScale, SectionHeader, StatTile, Tag } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { formatMoney } from "@/constants/mock-data";
import { useAuth } from "@/hooks/useAuth";
import { useCreators, useEpisodes, useCreator } from "@/lib/data";
import { useApp } from "@/providers/app-provider";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const {
    displayName,
    handle,
    balance,
    activeSubs,
    monthlySpend,
    savedEpisodes,
    likedEpisodes,
    unlockedEpisodes,
    isCreator,
    totalSpent,
    resetAccount,
  } = useApp();

  const { data: creatorsData = [] } = useCreators();
  const { data: episodesData = [] } = useEpisodes();

  const profileName = user?.name ?? displayName;
  const profileHandle = user?.email?.split("@")[0] ?? handle;
  const profileAvatar = user?.picture ?? "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&w=300&q=80";

  const saved = episodesData.filter((e) => savedEpisodes.includes(e.id));

  const handleSignOut = async (): Promise<void> => {
    resetAccount();
    await signOut();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.coverWrap}>
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=900&q=80",
          }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <LinearGradient
          colors={["rgba(8,8,10,0.5)", "rgba(8,8,10,0.85)", Colors.bg]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.coverBody, { paddingTop: insets.top + 30 }]}>
          <Avatar
            uri={profileAvatar}
            size={74}
            ring
          />
          <Text style={styles.name}>{profileName}</Text>
          <Text style={styles.handle}>@{profileHandle}</Text>
          <View style={styles.badgeRow}>
            {isCreator ? <Tag label="Creator" color={Colors.ink} bg={Colors.lime} /> : null}
            <Tag label={`${activeSubs.length} lives subscribed`} color={Colors.text} bg="rgba(255,255,255,0.1)" />
            <Tag label={`${unlockedEpisodes.length} POVs unlocked`} color={Colors.cyan} bg="rgba(53,231,255,0.12)" />
          </View>
        </View>
      </View>

      <View style={styles.walletCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.walletLabel}>povme wallet</Text>
          <Text style={styles.walletValue}>{formatMoney(balance)}</Text>
          <Text style={styles.walletSub}>
            {formatMoney(monthlySpend)}/mo in subs · {formatMoney(totalSpent)} lifetime
          </Text>
        </View>
        <Button label="Top up" small full={false} onPress={() => router.push("/wallet")} />
      </View>

      <View style={styles.statRow}>
        <StatTile label="Subscribed" value={`${activeSubs.length}`} sub="active creators" />
        <StatTile label="Saved" value={`${savedEpisodes.length}`} sub="POV episodes" accent={Colors.cyan} />
        <StatTile label="Liked" value={`${likedEpisodes.length}`} sub="all time" accent={Colors.magenta} />
      </View>

      <SectionHeader
        kicker="Your lives"
        title="Subscriptions"
        action="Manage"
        onAction={() => router.push("/subscriptions")}
      />
      {activeSubs.length === 0 ? (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>
            You&apos;re not living anyone else&apos;s life yet. Subscribe to start.
          </Text>
          <Button label="Explore creators" small full={false} onPress={() => router.push("/explore")} />
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {activeSubs.map((sub) => (
            <SubCard key={sub.creatorId} creatorId={sub.creatorId} price={sub.price} renewsAt={sub.renewsAt} />
          ))}
        </ScrollView>
      )}

      {saved.length > 0 ? (
        <>
          <SectionHeader kicker="Watch later" title="Saved POVs" action="See all" onAction={() => router.push("/saved")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            {saved.map((e) => (
              <EpisodeTile key={e.id} episode={e} width={170} />
            ))}
          </ScrollView>
        </>
      ) : null}

      <SectionHeader kicker="Account" title="Settings" />
      <View style={styles.menu}>
        <MenuRow icon={<Wallet2 size={17} color={Colors.lime} />} label="Wallet & payment methods" onPress={() => router.push("/wallet")} />
        <MenuRow icon={<CreditCard size={17} color={Colors.textMid} />} label="Subscriptions & billing" onPress={() => router.push("/subscriptions")} />
        <MenuRow icon={<Bookmark size={17} color={Colors.textMid} />} label="Saved POVs" onPress={() => router.push("/saved")} />
        <MenuRow icon={<Inbox size={17} color={Colors.textMid} />} label="Messages" onPress={() => router.push("/messages")} />
        <MenuRow icon={<Bell size={17} color={Colors.textMid} />} label="Notifications" onPress={() => router.push("/notifications")} />
        <MenuRow icon={<Shield size={17} color={Colors.cyan} />} label="Content guidelines" onPress={() => router.push("/guidelines")} />
        <MenuRow icon={<Users size={17} color={Colors.textMid} />} label="Trust & safety center" onPress={() => router.push("/admin")} />
        <MenuRow icon={<Sparkles size={17} color={Colors.gold} />} label="Preferences" onPress={() => router.push("/settings")} />
      </View>

      {!isCreator ? (
        <PressableScale onPress={() => router.push("/become-creator")}>
          <View style={styles.creatorCta}>
            <Radio size={18} color={Colors.magenta} />
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>Film your life instead</Text>
              <Text style={styles.ctaBody}>Keep 80% of subs, tips, PPV, and live gifts.</Text>
            </View>
            <ChevronRight size={18} color={Colors.textDim} />
          </View>
        </PressableScale>
      ) : null}

      <PressableScale onPress={() => void handleSignOut()}>
        <View style={styles.signOut}>
          <LogOut size={16} color={Colors.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </View>
      </PressableScale>

      <Text style={styles.footer}>
        povme · {creatorsData.length} creators · 18+ platform · 80/20 creator split
      </Text>
    </ScrollView>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.99}>
      <View style={styles.menuRow}>
        <View style={styles.menuIcon}>{icon}</View>
        <Text style={styles.menuLabel}>{label}</Text>
        <ChevronRight size={17} color={Colors.textDim} />
      </View>
    </PressableScale>
  );
}

function SubCard({ creatorId, price, renewsAt }: { creatorId: string; price: number; renewsAt: number }) {
  const router = useRouter();
  const { data: creator } = useCreator(creatorId);
  if (!creator) return null;
  return (
    <PressableScale
      scaleTo={0.95}
      onPress={() => router.push(`/creator/${creator.id}`)}
    >
      <View style={styles.subCard}>
        <Avatar uri={creator.avatar} size={52} ring live={creator.isLive} />
        <Text style={styles.subName} numberOfLines={1}>
          {creator.name}
        </Text>
        <Text style={styles.subMeta}>{formatMoney(price)}/mo</Text>
        <Text style={styles.subRenew}>
          Renews {new Date(renewsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  coverWrap: { minHeight: 300, justifyContent: "flex-end" },
  coverBody: { alignItems: "center", paddingBottom: 22, paddingHorizontal: 20 },
  name: { color: Colors.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.8, marginTop: 12 },
  handle: { color: Colors.textDim, fontSize: 13, fontWeight: "700", marginTop: 3 },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 14, flexWrap: "wrap", justifyContent: "center" },
  walletCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 18,
    padding: 18,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.2)",
  },
  walletLabel: { ...microLabel, color: Colors.lime },
  walletValue: { color: Colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -1.2, marginTop: 6 },
  walletSub: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 4 },
  statRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18, marginTop: 12 },
  rail: { paddingHorizontal: 18, gap: 12 },
  subCard: {
    width: 128,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    gap: 3,
  },
  subName: { color: Colors.text, fontSize: 13, fontWeight: "800", marginTop: 8 },
  subMeta: { color: Colors.lime, fontSize: 12, fontWeight: "800" },
  subRenew: { color: Colors.textDim, fontSize: 10.5, fontWeight: "600" },
  emptyRow: { paddingHorizontal: 18, gap: 12, alignItems: "flex-start" },
  emptyText: { color: Colors.textDim, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  menu: {
    marginHorizontal: 18,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { flex: 1, color: Colors.text, fontSize: 14, fontWeight: "700" },
  creatorCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    margin: 18,
    padding: 16,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,45,111,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,45,111,0.25)",
  },
  ctaTitle: { color: Colors.text, fontSize: 14.5, fontWeight: "800" },
  ctaBody: { color: Colors.textMid, fontSize: 12, fontWeight: "600", marginTop: 3 },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 18,
    paddingVertical: 15,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.25)",
  },
  signOutText: { color: Colors.danger, fontSize: 13.5, fontWeight: "800" },
  footer: {
    color: Colors.textDim,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 22,
    paddingHorizontal: 40,
    lineHeight: 17,
  },
});
