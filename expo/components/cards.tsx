import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Bookmark,
  Eye,
  Heart,
  Lock,
  Play,
  Radio,
  Sparkles,
  Users,
} from "lucide-react-native";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import Colors, { Radius, microLabel } from "@/constants/colors";
import {
  categoryById,
  creatorById,
  formatCount,
  formatDuration,
  formatMoney,
} from "@/constants/mock-data";
import { useApp } from "@/providers/app-provider";
import type { Creator, Episode, LiveStream } from "@/types";
import { Avatar, LiveBadge, PressableScale, Tag } from "@/components/ui";

export function AccessTag({ episode }: { episode: Episode }) {
  if (episode.access === "free") {
    return <Tag label="Free" color={Colors.ink} bg={Colors.lime} />;
  }
  if (episode.access === "subscribers") {
    return <Tag label="Subs only" color={Colors.text} bg="rgba(255,255,255,0.14)" />;
  }
  return (
    <Tag
      label={`PPV ${formatMoney(episode.ppvPrice ?? 0)}`}
      color={Colors.ink}
      bg={Colors.cyan}
    />
  );
}

/** Large cinematic feed card for a POV episode. */
export function EpisodeCard({ episode }: { episode: Episode }) {
  const router = useRouter();
  const { canWatch, toggleSaved, savedEpisodes, likedEpisodes, toggleLiked } = useApp();
  const creator = creatorById(episode.creatorId);
  const locked = !canWatch(episode);
  const cat = categoryById(episode.category);
  const saved = savedEpisodes.includes(episode.id);
  const liked = likedEpisodes.includes(episode.id);

  return (
    <View style={styles.card}>
      <PressableScale
        scaleTo={0.985}
        onPress={() => router.push(`/episode/${episode.id}`)}
      >
        <View style={styles.thumbWrap}>
          <Image
            source={{ uri: episode.thumb }}
            style={styles.thumb}
            contentFit="cover"
            transition={220}
            blurRadius={locked ? 22 : 0}
          />
          <LinearGradient
            colors={["rgba(8,8,10,0.55)", "transparent", "rgba(8,8,10,0.92)"]}
            locations={[0, 0.42, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.thumbTop}>
            <View style={styles.rowGap6}>
              <Tag label={cat.label} color={Colors.ink} bg={cat.accent} />
              <Tag label={episode.chapter} color={Colors.text} bg="rgba(0,0,0,0.5)" />
            </View>
            <Tag
              label={formatDuration(episode.durationSec)}
              color={Colors.text}
              bg="rgba(0,0,0,0.55)"
            />
          </View>

          {locked ? (
            <View style={styles.lockCenter}>
              <View style={styles.lockPill}>
                <Lock size={13} color={Colors.ink} />
                <Text style={styles.lockPillText}>
                  {episode.access === "ppv"
                    ? `Unlock ${formatMoney(episode.ppvPrice ?? 0)}`
                    : "Subscribers only"}
                </Text>
              </View>
              <Text style={styles.lockHint}>Step into this POV</Text>
            </View>
          ) : (
            <View style={styles.playCenter}>
              <View style={styles.playCircle}>
                <Play size={20} color={Colors.ink} fill={Colors.ink} />
              </View>
            </View>
          )}

          <View style={styles.thumbBottom}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {episode.title}
            </Text>
          </View>
        </View>
      </PressableScale>

      <View style={styles.cardMeta}>
        <PressableScale
          scaleTo={0.95}
          onPress={() => router.push(`/creator/${episode.creatorId}`)}
          style={{ flex: 1 }}
        >
          <View style={styles.rowCenter}>
            <Avatar uri={creator?.avatar ?? ""} size={34} ring live={creator?.isLive} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.metaName} numberOfLines={1}>
                {creator?.name}
              </Text>
              <Text style={styles.metaSub} numberOfLines={1}>
                {creator?.identity} · {episode.postedAt}
              </Text>
            </View>
          </View>
        </PressableScale>

        <View style={styles.actionsRow}>
          <PressableScale onPress={() => toggleLiked(episode.id)} scaleTo={0.85}>
            <View style={styles.iconBtn}>
              <Heart
                size={16}
                color={liked ? Colors.magenta : Colors.textMid}
                fill={liked ? Colors.magenta : "transparent"}
              />
            </View>
          </PressableScale>
          <PressableScale onPress={() => toggleSaved(episode.id)} scaleTo={0.85}>
            <View style={styles.iconBtn}>
              <Bookmark
                size={16}
                color={saved ? Colors.lime : Colors.textMid}
                fill={saved ? Colors.lime : "transparent"}
              />
            </View>
          </PressableScale>
          <PressableScale onPress={() => router.push(`/tip/${episode.creatorId}`)} scaleTo={0.85}>
            <View style={[styles.iconBtn, { backgroundColor: "rgba(255,182,39,0.14)" }]}>
              <Sparkles size={16} color={Colors.gold} />
            </View>
          </PressableScale>
        </View>
      </View>

      <View style={styles.statsRow}>
        <AccessTag episode={episode} />
        <View style={styles.rowGap10}>
          <View style={styles.rowGap4}>
            <Eye size={12} color={Colors.textDim} />
            <Text style={styles.statText}>{formatCount(episode.views)}</Text>
          </View>
          <View style={styles.rowGap4}>
            <Heart size={12} color={Colors.textDim} />
            <Text style={styles.statText}>{formatCount(episode.likes)}</Text>
          </View>
          <View style={styles.rowGap4}>
            <Sparkles size={12} color={Colors.gold} />
            <Text style={styles.statText}>{formatMoney(episode.tips)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Compact horizontal episode tile used in rails. */
export function EpisodeTile({ episode, width = 190 }: { episode: Episode; width?: number }) {
  const router = useRouter();
  const { canWatch } = useApp();
  const locked = !canWatch(episode);
  const creator = creatorById(episode.creatorId);

  return (
    <PressableScale scaleTo={0.96} onPress={() => router.push(`/episode/${episode.id}`)}>
      <View style={{ width }}>
        <View style={[styles.tileThumbWrap, { width }]}>
          <Image
            source={{ uri: episode.thumb }}
            style={styles.tileThumb}
            contentFit="cover"
            transition={200}
            blurRadius={locked ? 14 : 0}
          />
          <LinearGradient
            colors={["transparent", "rgba(8,8,10,0.85)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.tileBadge}>
            {locked ? (
              episode.access === "ppv" ? (
                <Tag
                  label={formatMoney(episode.ppvPrice ?? 0)}
                  color={Colors.ink}
                  bg={Colors.cyan}
                />
              ) : (
                <View style={styles.tileLock}>
                  <Lock size={11} color={Colors.text} />
                </View>
              )
            ) : (
              <Tag label={formatDuration(episode.durationSec)} color={Colors.text} bg="rgba(0,0,0,0.6)" />
            )}
          </View>
        </View>
        <Text style={styles.tileTitle} numberOfLines={2}>
          {episode.title}
        </Text>
        <Text style={styles.tileSub} numberOfLines={1}>
          @{creator?.handle} · {formatCount(episode.views)} views
        </Text>
      </View>
    </PressableScale>
  );
}

export function LiveStreamCard({ stream, wide }: { stream: LiveStream; wide?: boolean }) {
  const router = useRouter();
  const creator = creatorById(stream.creatorId);
  const cat = categoryById(stream.category);
  const accessLabel = useMemo(() => {
    if (stream.access === "public") return "Open";
    if (stream.access === "subscribers") return "Subs only";
    return `PPV ${formatMoney(stream.ppvPrice ?? 0)}`;
  }, [stream]);

  return (
    <PressableScale scaleTo={0.97} onPress={() => router.push(`/live/${stream.id}`)}>
      <View style={[styles.liveCard, wide && { width: "100%" }]}>
        <Image source={{ uri: stream.thumb }} style={styles.liveThumb} contentFit="cover" />
        <LinearGradient
          colors={["rgba(255,45,111,0.18)", "transparent", "rgba(8,8,10,0.95)"]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.liveTop}>
          <LiveBadge viewers={stream.viewers} />
          <Tag
            label={accessLabel}
            color={stream.access === "ppv" ? Colors.ink : Colors.text}
            bg={stream.access === "ppv" ? Colors.cyan : "rgba(0,0,0,0.55)"}
          />
        </View>
        <View style={styles.liveBottom}>
          <View style={styles.rowCenter}>
            <Avatar uri={creator?.avatar ?? ""} size={28} ring live />
            <Text style={styles.liveHandle}>@{creator?.handle}</Text>
            <Text style={styles.liveCat}>{cat.emoji}</Text>
          </View>
          <Text style={styles.liveTitle} numberOfLines={2}>
            {stream.title}
          </Text>
          <Text style={styles.liveMeta}>
            {stream.startedMinutesAgo}m ago · {formatCount(stream.viewers)} inside
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

export function CreatorCard({ creator }: { creator: Creator }) {
  const router = useRouter();
  const { isSubscribed } = useApp();
  const subbed = isSubscribed(creator.id);
  const cat = categoryById(creator.categories[0]);

  return (
    <PressableScale scaleTo={0.97} onPress={() => router.push(`/creator/${creator.id}`)}>
      <View style={styles.creatorCard}>
        <Image source={{ uri: creator.cover }} style={styles.creatorCover} contentFit="cover" />
        <LinearGradient
          colors={["transparent", "rgba(19,19,24,0.9)", Colors.surface]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        {creator.isLive ? (
          <View style={styles.creatorLive}>
            <LiveBadge />
          </View>
        ) : null}
        <View style={styles.creatorBody}>
          <Avatar uri={creator.avatar} size={46} ring live={creator.isLive} />
          <Text style={styles.creatorName} numberOfLines={1}>
            {creator.name}
          </Text>
          <Text style={styles.creatorIdentity} numberOfLines={1}>
            {cat.emoji} {creator.identity}
          </Text>
          <View style={styles.creatorFooter}>
            <View style={styles.rowGap4}>
              <Users size={11} color={Colors.textDim} />
              <Text style={styles.statText}>{formatCount(creator.subscribers)}</Text>
            </View>
            <Text style={[styles.creatorPrice, subbed && { color: Colors.lime }]}>
              {subbed ? "Subscribed" : `${formatMoney(creator.subPrice)}/mo`}
            </Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

export function CreatorRow({ creator, right }: { creator: Creator; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <PressableScale scaleTo={0.98} onPress={() => router.push(`/creator/${creator.id}`)}>
      <View style={styles.creatorRow}>
        <Avatar uri={creator.avatar} size={48} ring live={creator.isLive} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.rowGap6}>
            <Text style={styles.rowName} numberOfLines={1}>
              {creator.name}
            </Text>
            {creator.isLive ? <Radio size={12} color={Colors.magenta} /> : null}
          </View>
          <Text style={styles.rowSub} numberOfLines={1}>
            @{creator.handle} · {creator.location}
          </Text>
        </View>
        {right ?? (
          <Text style={styles.rowPrice}>{formatMoney(creator.subPrice)}/mo</Text>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 30 },
  thumbWrap: {
    marginHorizontal: 14,
    height: 400,
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: Colors.surface,
  },
  thumb: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  thumbTop: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  thumbBottom: { position: "absolute", left: 16, right: 16, bottom: 16 },
  cardTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
    lineHeight: 25,
  },
  playCenter: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  playCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  lockCenter: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  lockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: Colors.lime,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: Radius.pill,
  },
  lockPillText: { color: Colors.ink, fontSize: 14, fontWeight: "900" },
  lockHint: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600", marginTop: 10 },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    marginTop: 13,
    gap: 10,
  },
  metaName: { color: Colors.text, fontSize: 14.5, fontWeight: "800" },
  metaSub: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  actionsRow: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginTop: 11,
  },
  statText: { color: Colors.textDim, fontSize: 11.5, fontWeight: "700" },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  rowGap4: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowGap6: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowGap10: { flexDirection: "row", alignItems: "center", gap: 12 },

  tileThumbWrap: {
    height: 240,
    borderRadius: Radius.md,
    overflow: "hidden",
    backgroundColor: Colors.surface,
  },
  tileThumb: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  tileBadge: { position: "absolute", top: 10, left: 10 },
  tileLock: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitle: {
    color: Colors.text,
    fontSize: 13.5,
    fontWeight: "800",
    marginTop: 9,
    lineHeight: 18,
  },
  tileSub: { color: Colors.textDim, fontSize: 11, fontWeight: "600", marginTop: 3 },

  liveCard: {
    width: 260,
    height: 330,
    borderRadius: Radius.lg,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255,45,111,0.25)",
  },
  liveThumb: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  liveTop: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  liveBottom: { position: "absolute", left: 14, right: 14, bottom: 14, gap: 7 },
  liveHandle: { color: Colors.text, fontSize: 12.5, fontWeight: "800", marginLeft: 8 },
  liveCat: { fontSize: 12, marginLeft: 6 },
  liveTitle: { color: Colors.text, fontSize: 16, fontWeight: "900", lineHeight: 20 },
  liveMeta: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700" },

  creatorCard: {
    width: 168,
    height: 226,
    borderRadius: Radius.md,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  creatorCover: { position: "absolute", top: 0, left: 0, right: 0, height: 110 },
  creatorLive: { position: "absolute", top: 10, left: 10 },
  creatorBody: { position: "absolute", left: 12, right: 12, bottom: 12, gap: 3 },
  creatorName: { color: Colors.text, fontSize: 14.5, fontWeight: "900", marginTop: 8 },
  creatorIdentity: { color: Colors.textMid, fontSize: 11.5, fontWeight: "600" },
  creatorFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  creatorPrice: { color: Colors.textMid, fontSize: 11.5, fontWeight: "800" },

  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  rowName: { color: Colors.text, fontSize: 15, fontWeight: "800" },
  rowSub: { color: Colors.textDim, fontSize: 12, fontWeight: "600", marginTop: 2 },
  rowPrice: { color: Colors.lime, fontSize: 12.5, fontWeight: "800" },
  microLabelRef: { ...microLabel },
});
