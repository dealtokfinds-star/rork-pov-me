import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Search, SlidersHorizontal, TrendingUp, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CreatorCard, CreatorRow, EpisodeTile } from "@/components/cards";
import { Chip, EmptyState, PressableScale, SectionHeader, Tag } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { CATEGORIES, formatCount, formatMoney } from "@/lib/format";
import { useCreators, useEpisodes } from "@/lib/data";
import {
  useCategories,
  useRecommendations,
  useSearch,
  type RecommendMode,
  type SearchSort,
} from "@/hooks/useDiscovery";
import type { PovCategory } from "@/types";

type SortKey = "trending" | "rising" | "new" | "cheap" | "top";

const SORTS: { id: SortKey; label: string; mode: RecommendMode | null; searchSort: SearchSort }[] = [
  { id: "trending", label: "Trending", mode: "trending", searchSort: "relevance" },
  { id: "rising", label: "Rising", mode: "rising", searchSort: "relevance" },
  { id: "new", label: "Newest", mode: null, searchSort: "new" },
  { id: "cheap", label: "Under $10", mode: null, searchSort: "price" },
  { id: "top", label: "Most subs", mode: null, searchSort: "subs" },
];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState<string>("");
  const [category, setCategory] = useState<PovCategory | "all">("all");
  const [sort, setSort] = useState<SortKey>("trending");

  const { data: creatorsData } = useCreators();
  const { data: episodesData } = useEpisodes();
  const { data: dbCategories } = useCategories();
  const allCategories = dbCategories ?? CATEGORIES;
  const allCreators = creatorsData ?? [];
  const allEpisodes = episodesData ?? [];

  const activeSortDef = SORTS.find((s) => s.id === sort) ?? SORTS[0];
  const q = query.trim();

  // Live FTS search via /search edge function
  const searchQuery = useSearch(q, { category, sort: activeSortDef.searchSort, limit: 30 });

  // Ranked recommendations via /recommend edge function (when not searching)
  const trendingQuery = useRecommendations("trending", { category, limit: 24 });
  const risingQuery = useRecommendations("rising", { category, limit: 12 });

  const creators = useMemo(() => {
    if (q.length > 0) {
      // Use FTS results from the search edge function
      return searchQuery.data ?? [];
    }
    // Ranked results from the recommend edge function, fall back to client-side ranking
    if (activeSortDef.mode === "trending") return trendingQuery.data ?? allCreators;
    if (activeSortDef.mode === "rising") return risingQuery.data ?? allCreators;

    // Client-side fallback for new/cheap/top sorts
    let list = [...allCreators];
    if (category !== "all") list = list.filter((c) => c.categories.includes(category));
    if (sort === "top") list.sort((a, b) => b.subscribers - a.subscribers);
    if (sort === "cheap") list = list.filter((c) => c.subPrice < 10).concat(list.filter((c) => c.subPrice >= 10));
    if (sort === "new") list.sort((a, b) => a.episodes - b.episodes);
    return list;
  }, [q, searchQuery.data, activeSortDef.mode, trendingQuery.data, risingQuery.data, allCreators, category, sort]);

  const episodes = useMemo(() => {
    const ql = query.trim().toLowerCase();
    let list = category === "all" ? allEpisodes : allEpisodes.filter((e) => e.category === category);
    if (ql.length > 0) list = list.filter((e) => e.title.toLowerCase().includes(ql));
    return list;
  }, [category, query, allEpisodes]);

  const hero = creators[0] ?? allCreators[0];
  const searching = q.length > 0;
  const isFetching = searching ? searchQuery.isFetching : (activeSortDef.mode === "trending" ? trendingQuery.isFetching : activeSortDef.mode === "rising" ? risingQuery.isFetching : false);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Explore lives</Text>
        <Text style={styles.subtitle}>
          {allCreators.length} creators · {allEpisodes.length} POV episodes
        </Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={16} color={Colors.textDim} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search creators, cities, lifestyles"
            placeholderTextColor={Colors.textDim}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searching ? (
            <PressableScale onPress={() => setQuery("")} scaleTo={0.85}>
              <X size={16} color={Colors.textMid} />
            </PressableScale>
          ) : null}
        </View>
        <View style={styles.filterBtn}>
          <SlidersHorizontal size={17} color={Colors.lime} />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRail}
      >
        <Chip label="All" active={category === "all"} onPress={() => setCategory("all")} />
        {allCategories.map((c) => (
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRail}
      >
        {SORTS.map((s) => (
          <PressableScale key={s.id} onPress={() => setSort(s.id)} scaleTo={0.94}>
            <Text style={[styles.sortLabel, sort === s.id && styles.sortLabelActive]}>
              {s.label}
            </Text>
          </PressableScale>
        ))}
      </ScrollView>

      {isFetching && creators.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.lime} />
          <Text style={styles.loadingText}>Ranking creators…</Text>
        </View>
      ) : creators.length === 0 ? (
        <EmptyState
          icon={<Search size={24} color={Colors.textMid} />}
          title="No creators found"
          body={`Nothing matches "${query}". Try a city, a lifestyle, or clear your filters.`}
          action="Clear search"
          onAction={() => {
            setQuery("");
            setCategory("all");
          }}
        />
      ) : (
        <>
          {!searching ? (
            <PressableScale scaleTo={0.98} onPress={() => router.push(`/creator/${hero.id}`)}>
              <View style={styles.hero}>
                <Image source={{ uri: hero.cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <LinearGradient
                  colors={["rgba(8,8,10,0.2)", "rgba(8,8,10,0.75)", Colors.bg]}
                  locations={[0, 0.55, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.heroBody}>
                  <View style={styles.heroTags}>
                    <Tag label="Editor's pick" color={Colors.ink} bg={Colors.lime} />
                    <Tag
                      label={`${formatCount(hero.subscribers)} living this life`}
                      color={Colors.text}
                      bg="rgba(0,0,0,0.5)"
                    />
                  </View>
                  <Text style={styles.heroTitle}>
                    Today, you wake up as {hero.name.split(" ")[0]}.
                  </Text>
                  <Text style={styles.heroSub} numberOfLines={2}>
                    {hero.bio}
                  </Text>
                  <View style={styles.heroFooter}>
                    <Text style={styles.heroPrice}>{formatMoney(hero.subPrice)}/mo</Text>
                    <Text style={styles.heroCta}>Live as them →</Text>
                  </View>
                </View>
              </View>
            </PressableScale>
          ) : null}

          <SectionHeader
            kicker={searching ? "Search results" : "Handpicked"}
            title={searching ? `${creators.length} creators` : "POV identities"}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            {creators.map((c) => (
              <CreatorCard key={c.id} creator={c} />
            ))}
          </ScrollView>

          {episodes.length > 0 ? (
            <>
              <SectionHeader
                kicker="Unlockable"
                title="Premium POV experiences"
                action="See all"
                onAction={() => setSort("trending")}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rail}
              >
                {episodes
                  .filter((e) => e.access === "ppv")
                  .concat(episodes.filter((e) => e.access !== "ppv"))
                  .slice(0, 8)
                  .map((e) => (
                    <EpisodeTile key={e.id} episode={e} />
                  ))}
              </ScrollView>
            </>
          ) : null}

          {!searching && sort === "trending" ? (
            <>
              <SectionHeader kicker="Climbing fast" title="Rising this week" />
              <View style={styles.risingWrap}>
                {(risingQuery.data ?? creators.slice(0, 5)).slice(0, 5).map((c, i) => (
                  <View key={c.id}>
                    <CreatorRow
                      creator={c}
                      right={
                        <View style={styles.risingRight}>
                          <TrendingUp size={13} color={Colors.lime} />
                          <Text style={styles.risingPct}>+{18 + i * 7}%</Text>
                        </View>
                      }
                    />
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <SectionHeader kicker="Browse by life" title="Categories" />
          <View style={styles.catGrid}>
            {allCategories.map((c) => (
              <PressableScale key={c.id} onPress={() => setCategory(c.id)} scaleTo={0.96}>
                <View style={[styles.catCard, { borderColor: `${c.accent}33` }]}>
                  <Text style={styles.catEmoji}>{c.emoji}</Text>
                  <Text style={styles.catLabel}>{c.label} POV</Text>
                  <Text style={styles.catTag}>{c.tagline}</Text>
                </View>
              </PressableScale>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 18, paddingBottom: 16 },
  title: { color: Colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1 },
  subtitle: { color: Colors.textDim, fontSize: 12.5, fontWeight: "600", marginTop: 4 },
  searchRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14.5, fontWeight: "600" },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(204,255,0,0.1)",
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  chipRail: { paddingHorizontal: 18, gap: 8, paddingTop: 14 },
  sortRail: { paddingHorizontal: 18, gap: 18, paddingTop: 16 },
  sortLabel: { ...microLabel, color: Colors.textDim, fontSize: 11 },
  sortLabelActive: { color: Colors.text, textDecorationLine: "underline" },
  loadingWrap: { alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 80 },
  loadingText: { color: Colors.textDim, fontSize: 12.5, fontWeight: "700" },
  hero: {
    margin: 18,
    marginBottom: 0,
    height: 330,
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    justifyContent: "flex-end",
  },
  heroBody: { padding: 20, gap: 8 },
  heroTags: { flexDirection: "row", gap: 6, marginBottom: 4 },
  heroTitle: { color: Colors.text, fontSize: 25, fontWeight: "900", letterSpacing: -0.8, lineHeight: 29 },
  heroSub: { color: Colors.textMid, fontSize: 13, fontWeight: "500", lineHeight: 19 },
  heroFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  heroPrice: { color: Colors.text, fontSize: 15, fontWeight: "900" },
  heroCta: { color: Colors.lime, fontSize: 13.5, fontWeight: "800" },
  rail: { paddingHorizontal: 18, gap: 12 },
  risingWrap: {
    marginHorizontal: 18,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 6,
  },
  risingRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  risingPct: { color: Colors.lime, fontSize: 12.5, fontWeight: "900" },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
  },
  catCard: {
    width: 168,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
  },
  catEmoji: { fontSize: 20, marginBottom: 8 },
  catLabel: { color: Colors.text, fontSize: 14, fontWeight: "800" },
  catTag: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 3 },
});
