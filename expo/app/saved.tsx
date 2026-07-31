import { useRouter } from "expo-router";
import { Bookmark, Lock } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { EpisodeTile } from "@/components/cards";
import { Chip, EmptyState } from "@/components/ui";
import Colors, { microLabel } from "@/constants/colors";
import { useEpisodes } from "@/lib/data";
import { useApp } from "@/providers/app-provider";

type Filter = "saved" | "unlocked" | "liked";

export default function SavedScreen() {
  const router = useRouter();
  const { savedEpisodes, likedEpisodes } = useApp();
  const [filter, setFilter] = useState<Filter>("saved");
  const { data: allEpisodes = [] } = useEpisodes();

  const ids = filter === "saved" ? savedEpisodes : likedEpisodes;
  const list = useMemo(() => allEpisodes.filter((e) => ids.includes(e.id)), [ids, allEpisodes]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.filterRow}>
        <Chip label={`Saved ${savedEpisodes.length}`} active={filter === "saved"} onPress={() => setFilter("saved")} />
        <Chip
          label={`Liked ${likedEpisodes.length}`}
          accent={Colors.magenta}
          active={filter === "liked"}
          onPress={() => setFilter("liked")}
        />
      </View>

      {filter === "unlocked" ? (
        <View style={styles.note}>
          <Lock size={13} color={Colors.cyan} />
          <Text style={styles.noteText}>
            Pay-per-view unlocks are permanent. They stay watchable even if you cancel a
            subscription.
          </Text>
        </View>
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          icon={<Bookmark size={22} color={Colors.textMid} />}
          title={
            filter === "saved" ? "Nothing saved yet" : filter === "unlocked" ? "No unlocks yet" : "No likes yet"
          }
          body={
            filter === "saved"
              ? "Tap the bookmark on any POV episode to keep it here for later."
              : filter === "unlocked"
                ? "Premium POV experiences you buy once will live here forever."
                : "Like the episodes that hit — creators see what to film next."
          }
          action="Browse POVs"
          onAction={() => router.push("/(tabs)/explore")}
        />
      ) : (
        <View style={styles.grid}>
          {list.map((e) => (
            <EpisodeTile key={e.id} episode={e} width={168} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingVertical: 14 },
  note: {
    flexDirection: "row",
    gap: 9,
    marginHorizontal: 18,
    marginBottom: 14,
    padding: 13,
    borderRadius: 14,
    backgroundColor: "rgba(53,231,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(53,231,255,0.2)",
  },
  noteText: { flex: 1, color: Colors.textMid, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 18 },
  microRef: { ...microLabel },
});
