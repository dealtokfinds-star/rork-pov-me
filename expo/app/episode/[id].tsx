import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  Bookmark,
  Check,
  ChevronLeft,
  Eye,
  Heart,
  Lock,
  MessageCircle,
  Send,
  Share2,
  Sparkles,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EpisodeTile } from "@/components/cards";
import { Avatar, Button, PressableScale, SectionHeader, Tag, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import {
  categoryById,
  formatCount,
  formatDuration,
  formatMoney,
} from "@/constants/mock-data";
import { useApp } from "@/providers/app-provider";
import { useAuth } from "@/hooks/useAuth";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import { useCreator, useEpisode, useEpisodes } from "@/lib/data";
import { useEpisodeAccess } from "@/hooks/useAccess";
import { callEdge } from "@/lib/edge";

export default function EpisodeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const {
    isSubscribed,
    toggleSaved,
    savedEpisodes,
    likedEpisodes,
    toggleLiked,
  } = useApp();

  const track = useTrackEvent();

  const { data: episode, isLoading } = useEpisode(id ?? "");
  const { data: creator } = useCreator(episode?.creatorId);
  const { data: allEpisodes = [] } = useEpisodes();

  // Fire a view event once the episode resolves — powers recommendations
  // and creator analytics funnels.
  useEffect(() => {
    if (episode) {
      track("view", { episode_id: episode.id, creator_id: episode.creatorId });
    }
  }, [episode, track]);

  const [comment, setComment] = useState<string>("");
  const [commentState, setCommentState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [commentError, setCommentError] = useState<string | null>(null);

  const handleShare = useCallback(async (): Promise<void> => {
    if (!episode) return;
    try {
      await Share.share({
        message: `Step into this POV on povme — "${episode.title}"`,
        title: episode.title,
      });
    } catch (err) {
      console.log("[povme] share failed", err);
    }
  }, [episode]);

  const sendComment = useCallback(async (): Promise<void> => {
    const text = comment.trim();
    if (text.length === 0 || !episode || !creator) return;
    setCommentState("sending");
    setCommentError(null);
    try {
      await callEdge("dm-send", {
        recipient_id: creator.id,
        text: `About “${episode.title}”: ${text}`,
        is_paid: false,
        price: 0,
      });
      setComment("");
      setCommentState("sent");
      haptic("success");
      setTimeout(() => setCommentState("idle"), 2500);
    } catch (err) {
      setCommentState("error");
      setCommentError(err instanceof Error ? err.message : "Could not send your message");
    }
  }, [comment, episode, creator]);

  // Server-enforced access check — the edge function checks subscription/
  // unlock rows and returns the video URL only if access is granted.
  const { data: accessResult, isLoading: accessLoading } = useEpisodeAccess(id);
  const unlocked = accessResult?.allowed ?? false;
  const videoUrl = accessResult?.videoUrl ?? null;

  const player = useVideoPlayer(
    unlocked && videoUrl ? videoUrl : null,
    (p) => {
      p.loop = true;
      p.muted = false;
      if (unlocked) p.play();
    },
  );

  const related = useMemo(
    () => allEpisodes.filter((e) => e.id !== episode?.id && e.category === episode?.category).slice(0, 6),
    [allEpisodes, episode],
  );

  if (isLoading || accessLoading) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center", gap: 12 }]}>
        <ActivityIndicator color={Colors.lime} />
        <Text style={{ color: Colors.textMid, fontSize: 14, fontWeight: "700" }}>Loading episode…</Text>
      </View>
    );
  }

  if (!episode || !creator) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 60, paddingHorizontal: 24 }]}>
        <Text style={styles.title}>Episode unavailable</Text>
        <Text style={styles.body}>This POV was removed or is under review.</Text>
        <Button label="Back to feed" onPress={() => router.replace("/(tabs)")} style={{ marginTop: 20 }} />
      </View>
    );
  }

  const cat = categoryById(episode.category);
  const saved = savedEpisodes.includes(episode.id);
  const liked = likedEpisodes.includes(episode.id);

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        <View style={styles.stage}>
          {unlocked ? (
            <VideoView
              style={StyleSheet.absoluteFill}
              player={player}
              allowsFullscreen
              allowsPictureInPicture
              contentFit="cover"
            />
          ) : (
            <>
              <Image
                source={{ uri: episode.thumb }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                blurRadius={30}
              />
              <LinearGradient
                colors={["rgba(8,8,10,0.6)", "rgba(8,8,10,0.9)"]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.lockBody}>
                <View style={styles.lockIcon}>
                  <Lock size={22} color={Colors.ink} />
                </View>
                <Text style={styles.lockTitle}>
                  {episode.access === "ppv" ? "Premium POV experience" : "Subscribers only"}
                </Text>
                <Text style={styles.lockBodyText}>
                  {episode.access === "ppv"
                    ? `Unlock this episode once for ${formatMoney(episode.ppvPrice ?? 0)} and keep it forever.`
                    : `Subscribe to @${creator.handle} for ${formatMoney(creator.subPrice)}/mo to watch every episode.`}
                </Text>
                <Button
                  label={
                    episode.access === "ppv"
                      ? `Unlock for ${formatMoney(episode.ppvPrice ?? 0)}`
                      : `Subscribe · ${formatMoney(creator.subPrice)}/mo`
                  }
                  variant={episode.access === "ppv" ? "ppv" : "primary"}
                  onPress={() =>
                    router.push(
                      episode.access === "ppv"
                        ? `/unlock/${episode.id}`
                        : `/subscribe/${creator.id}`,
                    )
                  }
                  style={{ marginTop: 20 }}
                />
              </View>
            </>
          )}

          <PressableScale
            onPress={() => router.back()}
            scaleTo={0.9}
            style={[styles.backBtn, { top: insets.top + 10 }]}
          >
            <View style={styles.backCircle}>
              <ChevronLeft size={20} color={Colors.text} />
            </View>
          </PressableScale>

          <View style={[styles.stageTags, { top: insets.top + 14 }]}>
            <Tag label={cat.label} color={Colors.ink} bg={cat.accent} />
            <Tag label={episode.chapter} color={Colors.text} bg="rgba(0,0,0,0.55)" />
            <Tag
              label={formatDuration(episode.durationSec)}
              color={Colors.text}
              bg="rgba(0,0,0,0.55)"
            />
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{episode.title}</Text>
          <View style={styles.metaRow}>
            <View style={styles.rowGap4}>
              <Eye size={12} color={Colors.textDim} />
              <Text style={styles.metaText}>{formatCount(episode.views)} views</Text>
            </View>
            <Text style={styles.metaText}>·</Text>
            <Text style={styles.metaText}>{episode.postedAt} ago</Text>
            <Text style={styles.metaText}>·</Text>
            <Text style={[styles.metaText, { color: Colors.gold }]}>
              {formatMoney(episode.tips)} tipped
            </Text>
          </View>

          <View style={styles.actionBar}>
            <ActionPill
              icon={
                <Heart
                  size={16}
                  color={liked ? Colors.magenta : Colors.textMid}
                  fill={liked ? Colors.magenta : "transparent"}
                />
              }
              label={formatCount(episode.likes + (liked ? 1 : 0))}
              onPress={() => {
                toggleLiked(episode.id);
                if (!liked) {
                  track("like", { episode_id: episode.id, creator_id: episode.creatorId });
                }
              }}
            />
            <ActionPill
              icon={
                <Bookmark
                  size={16}
                  color={saved ? Colors.lime : Colors.textMid}
                  fill={saved ? Colors.lime : "transparent"}
                />
              }
              label={saved ? "Saved" : "Save"}
              onPress={() => toggleSaved(episode.id)}
            />
            <ActionPill
              icon={<Sparkles size={16} color={Colors.gold} />}
              label="Tip"
              onPress={() => router.push(`/tip/${creator.id}`)}
            />
            <ActionPill
              icon={<Share2 size={16} color={Colors.textMid} />}
              label="Share"
              onPress={() => void handleShare()}
            />
          </View>

          <View style={styles.creatorCard}>
            <PressableScale onPress={() => router.push(`/creator/${creator.id}`)} style={{ flex: 1 }}>
              <View style={styles.rowCenter}>
                <Avatar uri={creator.avatar} size={44} ring live={creator.isLive} />
                <View style={{ marginLeft: 11, flex: 1 }}>
                  <Text style={styles.creatorName}>{creator.name}</Text>
                  <Text style={styles.creatorSub}>
                    {creator.identity} · {formatCount(creator.subscribers)} living it
                  </Text>
                </View>
              </View>
            </PressableScale>
            {isSubscribed(creator.id) ? (
              <PressableScale onPress={() => router.push(`/messages`)}>
                <View style={styles.dmBtn}>
                  <MessageCircle size={15} color={Colors.lime} />
                </View>
              </PressableScale>
            ) : (
              <Button
                label="Subscribe"
                small
                full={false}
                onPress={() => router.push(`/subscribe/${creator.id}`)}
              />
            )}
          </View>

          <Text style={styles.sectionKicker}>The episode</Text>
          <Text style={styles.description}>{episode.description}</Text>

          <View style={styles.immersion}>
            <Text style={styles.immersionKicker}>Identity immersion</Text>
            <Text style={styles.immersionText}>
              You are {creator.name.split(" ")[0]} — {creator.identity.toLowerCase()} in{" "}
              {creator.location}. Headphones on, phone in landscape. This is your day now.
            </Text>
          </View>

          <View style={styles.commentBox}>
            <Avatar uri={user?.picture ?? ""} size={32} />
            <TextInput
              value={comment}
              onChangeText={(t) => {
                setComment(t);
                if (commentState === "error") setCommentState("idle");
              }}
              placeholder={`Say something to ${creator.name.split(" ")[0]}…`}
              placeholderTextColor={Colors.textDim}
              style={styles.commentInput}
              editable={commentState !== "sending"}
              onSubmitEditing={() => void sendComment()}
              returnKeyType="send"
              maxLength={280}
            />
            <PressableScale
              onPress={() => void sendComment()}
              scaleTo={0.85}
              disabled={comment.trim().length === 0 || commentState === "sending"}
            >
              <View style={[styles.sendBtn, commentState === "sent" && { backgroundColor: Colors.success }]}>
                {commentState === "sending" ? (
                  <ActivityIndicator size="small" color={Colors.ink} />
                ) : commentState === "sent" ? (
                  <Check size={14} color={Colors.ink} />
                ) : (
                  <Send size={14} color={Colors.ink} />
                )}
              </View>
            </PressableScale>
          </View>
          {commentState === "sent" ? (
            <Text style={styles.commentSent}>Sent — continue the conversation in Messages.</Text>
          ) : null}
          {commentState === "error" && commentError ? (
            <Text style={styles.commentError}>{commentError}</Text>
          ) : null}
        </View>

        {related.length > 0 ? (
          <>
            <SectionHeader kicker="More of this life" title={`${cat.label} POVs`} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {related.map((e) => (
                <EpisodeTile key={e.id} episode={e} width={175} />
              ))}
            </ScrollView>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ActionPill({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.93} style={{ flex: 1 }}>
      <View style={styles.actionPill}>
        {icon}
        <Text style={styles.actionLabel}>{label}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  stage: { height: 460, backgroundColor: "#000" },
  backBtn: { position: "absolute", left: 14 },
  backCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  stageTags: { position: "absolute", right: 14, gap: 6, alignItems: "flex-end" },
  lockBody: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  lockIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  lockTitle: { color: Colors.text, fontSize: 20, fontWeight: "900", letterSpacing: -0.6 },
  lockBodyText: {
    color: Colors.textMid,
    fontSize: 13.5,
    fontWeight: "500",
    lineHeight: 20,
    textAlign: "center",
    marginTop: 9,
  },
  body: { paddingHorizontal: 18, paddingTop: 18 },
  title: { color: Colors.text, fontSize: 23, fontWeight: "900", letterSpacing: -0.8, lineHeight: 28 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10, flexWrap: "wrap" },
  metaText: { color: Colors.textDim, fontSize: 12, fontWeight: "700" },
  rowGap4: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  actionBar: { flexDirection: "row", gap: 8, marginTop: 18 },
  actionPill: {
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  actionLabel: { color: Colors.textMid, fontSize: 12, fontWeight: "800" },
  creatorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  creatorName: { color: Colors.text, fontSize: 15, fontWeight: "900" },
  creatorSub: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  dmBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(204,255,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionKicker: { ...microLabel, color: Colors.lime, marginTop: 24 },
  description: { color: Colors.textMid, fontSize: 14, fontWeight: "500", lineHeight: 22, marginTop: 10 },
  immersion: {
    marginTop: 18,
    padding: 16,
    borderRadius: Radius.md,
    backgroundColor: "rgba(53,231,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(53,231,255,0.18)",
  },
  immersionKicker: { ...microLabel, color: Colors.cyan, marginBottom: 7 },
  immersionText: { color: Colors.text, fontSize: 13.5, fontWeight: "600", lineHeight: 20 },
  commentBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    padding: 10,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  commentInput: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: "600", paddingVertical: 0 },
  commentSent: { color: Colors.success, fontSize: 12, fontWeight: "700", marginTop: 8 },
  commentError: { color: Colors.danger, fontSize: 12, fontWeight: "700", marginTop: 8 },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  rail: { paddingHorizontal: 18, gap: 12 },
});
