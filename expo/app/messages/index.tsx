import { useRouter } from "expo-router";
import { Inbox, Lock, Search } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar, Chip, EmptyState, PressableScale, Tag } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { formatMoney } from "@/constants/mock-data";
import { useDmThreads, type DmThreadWithProfile } from "@/hooks/useDMs";
import { useProfile } from "@/hooks/useProfile";

export default function MessagesScreen() {
  const router = useRouter();
  const { threads, isLoading } = useDmThreads();
  const { account } = useProfile();
  const [filter, setFilter] = useState<"all" | "unread" | "paid">("all");

  const myId = account?.id ?? "";

  const filtered = threads.filter((t) => {
    const unread = (t.creator_id === myId ? t.creator_unread_count : t.fan_unread_count) > 0;
    if (filter === "unread") return unread;
    if (filter === "paid") return t.last_is_paid === true;
    return true;
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.searchBox}>
        <Search size={16} color={Colors.textDim} />
        <Text style={styles.searchText}>Search messages</Text>
      </View>

      <View style={styles.filterRow}>
        <Chip label="All" active={filter === "all"} onPress={() => setFilter("all")} />
        <Chip label="Unread" active={filter === "unread"} onPress={() => setFilter("unread")} />
        <Chip label="Paid requests" active={filter === "paid"} onPress={() => setFilter("paid")} accent={Colors.cyan} />
      </View>

      {isLoading ? (
        <Text style={styles.loading}>Loading conversations…</Text>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox size={22} color={Colors.textMid} />}
          title="No conversations yet"
          body="Direct messages open up with creators you subscribe to. Say hi, request a POV, or ask for a custom episode."
          action="Find creators"
          onAction={() => router.push("/(tabs)/explore")}
        />
      ) : (
        <View style={{ paddingHorizontal: 18, gap: 9 }}>
          {filtered.map((thread) => {
            const lastText = thread.last_is_paid ? "Paid message" : (thread.last_text ?? "");
            const unread = (thread.creator_id === myId ? thread.creator_unread_count : thread.fan_unread_count) > 0;
            return (
              <PressableScale
                key={thread.id}
                scaleTo={0.98}
                onPress={() => router.push(`/messages/${thread.id}`)}
              >
                <View style={styles.row}>
                  <Avatar uri={thread.other_avatar ?? ""} size={48} ring />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.rowHead}>
                      <Text style={styles.name} numberOfLines={1}>
                        {thread.other_name ?? thread.other_handle ?? "Creator"}
                      </Text>
                      <Text style={styles.time}>
                        {thread.last_message_at
                          ? new Date(thread.last_message_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                          : ""}
                      </Text>
                    </View>
                    <Text style={styles.preview} numberOfLines={1}>
                      {lastText}
                    </Text>
                    {thread.last_is_paid ? (
                      <View style={{ marginTop: 6, alignSelf: "flex-start" }}>
                        <Tag label={`UNLOCK ${formatMoney(thread.last_price ?? 0)}`} color={Colors.ink} bg={Colors.cyan} />
                      </View>
                    ) : null}
                  </View>
                  {unread ? <View style={styles.dot} /> : null}
                </View>
              </PressableScale>
            );
          })}
        </View>
      )}

      <View style={styles.note}>
        <Lock size={13} color={Colors.textDim} />
        <Text style={styles.noteText}>
          Creators can send paid messages with custom POV content. You always see the price before
          anything is charged.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginHorizontal: 18,
    marginTop: 12,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchText: { color: Colors.textDim, fontSize: 14, fontWeight: "600" },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingVertical: 14 },
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
  rowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, color: Colors.text, fontSize: 14.5, fontWeight: "900" },
  time: { ...microLabel, color: Colors.textDim, fontSize: 9.5 },
  preview: { color: Colors.textMid, fontSize: 12.5, fontWeight: "600", marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.lime, marginLeft: 8 },
  note: {
    flexDirection: "row",
    gap: 9,
    margin: 18,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noteText: { flex: 1, color: Colors.textDim, fontSize: 11.5, fontWeight: "600", lineHeight: 18 },
});
