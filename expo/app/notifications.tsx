import { useRouter } from "expo-router";
import { Bell, Lock, Radio, Sparkles, Upload, UserPlus } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar, Chip, EmptyState, PressableScale, Tag } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { formatMoney } from "@/lib/format";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { useApp } from "@/providers/app-provider";

const ICONS = {
  live: <Radio size={13} color="#fff" />,
  drop: <Upload size={13} color={Colors.ink} />,
  ppv: <Lock size={13} color={Colors.ink} />,
  tip: <Sparkles size={13} color={Colors.ink} />,
  sub: <UserPlus size={13} color={Colors.ink} />,
} as const;

const BG = {
  live: Colors.magenta,
  drop: Colors.lime,
  ppv: Colors.cyan,
  tip: Colors.gold,
  sub: Colors.lime,
} as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return `${Math.floor(day / 7)}w`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { activeSubs, monthlySpend } = useApp();
  const { notifications, isLoading } = useNotifications();
  const [filter, setFilter] = useState<"all" | "live" | "drops" | "billing">("all");

  const filtered = useMemo(() => {
    if (filter === "live") return notifications.filter((n) => n.kind === "live");
    if (filter === "drops") return notifications.filter((n) => n.kind === "drop" || n.kind === "ppv");
    if (filter === "billing") return notifications.filter((n) => n.kind === "sub" || n.kind === "tip");
    return notifications;
  }, [notifications, filter]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.filterRow}>
        <Chip label="All" active={filter === "all"} onPress={() => setFilter("all")} />
        <Chip label="Live" active={filter === "live"} onPress={() => setFilter("live")} />
        <Chip label="New drops" active={filter === "drops"} onPress={() => setFilter("drops")} />
        <Chip label="Billing" active={filter === "billing"} onPress={() => setFilter("billing")} />
      </View>

      <View style={styles.banner}>
        <Bell size={16} color={Colors.lime} />
        <Text style={styles.bannerText}>
          {activeSubs.length > 0
            ? `You're notified for ${activeSubs.length} creators · ${formatMoney(monthlySpend)}/mo`
            : "Subscribe to a creator to get notified the second they drop or go live."}
        </Text>
      </View>

      {isLoading ? (
        <Text style={styles.loading}>Loading notifications…</Text>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Bell size={22} color={Colors.textMid} />}
          title="No notifications yet"
          body="Subscribe to creators to get live alerts, new episode drops, and billing reminders here."
          action="Explore creators"
          onAction={() => router.push("/(tabs)/explore")}
        />
      ) : (
        <View style={{ gap: 8, paddingHorizontal: 18 }}>
          {filtered.map((n) => (
            <NotificationRow key={n.id} n={n} onPress={() => router.push(n.href as never)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function NotificationRow({ n, onPress }: { n: AppNotification; onPress: () => void }) {
  return (
    <PressableScale scaleTo={0.98} onPress={onPress}>
      <View style={[styles.row, n.unread && styles.rowUnread]}>
        <View>
          <Avatar uri={n.creatorAvatar ?? ""} size={44} ring live={n.kind === "live"} />
          <View style={[styles.kindBadge, { backgroundColor: BG[n.kind] }]}>{ICONS[n.kind]}</View>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.text}>
            <Text style={styles.name}>{n.creatorName} </Text>
            {n.text}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.when}>{timeAgo(n.when)} ago</Text>
            {n.kind === "live" ? <Tag label="LIVE" color="#fff" bg={Colors.magenta} /> : null}
            {n.kind === "ppv" ? <Tag label="PPV" color={Colors.ink} bg={Colors.cyan} /> : null}
          </View>
        </View>
        {n.unread ? <View style={styles.dot} /> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingVertical: 14 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 18,
    marginBottom: 16,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: "rgba(204,255,0,0.07)",
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.2)",
  },
  bannerText: { flex: 1, color: Colors.text, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },
  loading: { color: Colors.textDim, fontSize: 13, fontWeight: "600", padding: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowUnread: { borderColor: "rgba(204,255,0,0.22)", backgroundColor: "rgba(204,255,0,0.04)" },
  kindBadge: {
    position: "absolute",
    bottom: -2,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  text: { color: Colors.textMid, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  name: { color: Colors.text, fontWeight: "900" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  when: { ...microLabel, color: Colors.textDim, fontSize: 9.5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.lime, marginLeft: 8 },
});
