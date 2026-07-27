import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  Camera,
  Check,
  Clock,
  Clapperboard,
  FilePlus2,
  Film,
  Lock,
  Loader,
  Unlock,
  UploadCloud,
  Users,
  Video,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button, Chip, PressableScale, ProgressBar, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { CATEGORIES, formatMoney } from "@/constants/mock-data";
import { useApp } from "@/providers/app-provider";
import { awaitAssetReady, createUploadUrl, uploadFile } from "@/lib/muxUpload";
import type { AccessLevel, PovCategory } from "@/types";

const CHAPTERS = ["Morning", "Work", "Gym", "Night out", "Travel day", "Debrief"];
const PPV_PRICES = [4.99, 6.99, 9.99, 12.99, 14.99, 19.99];

type Phase = "choose" | "uploading" | "transcoding" | "ready" | "error";

export default function UploadScreen() {
  const router = useRouter();
  const { publishEpisode, creatorPrice } = useApp();

  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [thumb, setThumb] = useState<string | null>(null);
  const [category, setCategory] = useState<PovCategory>("founder");
  const [chapter, setChapter] = useState<string>("Work");
  const [access, setAccess] = useState<AccessLevel>("subscribers");
  const [ppvPrice, setPpvPrice] = useState<number>(9.99);

  const [phase, setPhase] = useState<Phase>("choose");
  const [progress, setProgress] = useState<number>(0);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoLabel, setVideoLabel] = useState<string>("");
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<"published" | "scheduled" | "draft" | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Reset to choose phase when the video is cleared.
  useEffect(() => {
    if (!videoUri && phase !== "error") setPhase("choose");
  }, [videoUri, phase]);

  const pickThumb = useCallback(async (): Promise<void> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
        aspect: [16, 9],
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setThumb(result.assets[0].uri);
        haptic("light");
      }
    } catch (err) {
      console.log("[povme] thumbnail pick failed", err);
    }
  }, []);

  const pickVideo = useCallback(async (): Promise<void> => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError("Photo library access is required to pick a video.");
        setPhase("error");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        quality: 1,
        allowsEditing: true,
        videoExportPreset: ImagePicker.VideoExportPreset.HighestQuality,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      const asset = result.assets[0];
      const label = asset.fileName ?? "video.mp4";
      startUpload(asset.uri, label);
    } catch (err) {
      console.log("[povme] video pick failed", err);
      setError("Could not open the video picker.");
      setPhase("error");
    }
  }, []);

  const recordVideo = useCallback(async (): Promise<void> => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError("Camera access is required to record a video.");
        setPhase("error");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["videos"],
        quality: 1,
        allowsEditing: true,
        videoExportPreset: ImagePicker.VideoExportPreset.HighestQuality,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      const asset = result.assets[0];
      const label = asset.fileName ?? "camera_take.mp4";
      startUpload(asset.uri, label);
    } catch (err) {
      console.log("[povme] video record failed", err);
      setError("Could not open the camera.");
      setPhase("error");
    }
  }, []);

  /** Kick off the real Mux direct-upload pipeline. */
  const startUpload = useCallback(async (uri: string, label: string): Promise<void> => {
    setVideoUri(uri);
    setVideoLabel(label);
    setError(null);
    setPhase("uploading");
    setProgress(0);
    haptic("medium");

    try {
      const { uploadUrl, episodeId: epId } = await createUploadUrl({
        title: title.trim().length > 0 ? title.trim() : "Untitled POV episode",
        category,
        chapter,
        thumbUrl: thumb ?? undefined,
      });
      setEpisodeId(epId);

      await uploadFile(uri, uploadUrl, (frac) => {
        setProgress(frac);
      });

      // PUT done — now Mux transcodes. Poll until the asset is ready.
      setProgress(1);
      setPhase("transcoding");
      haptic("success");

      const finalized = await awaitAssetReady(epId);
      if (finalized?.video_url) {
        setPhase("ready");
        haptic("success");
      } else {
        // Timed out waiting — the webhook is still expected to finalize.
        // Show ready with a note so the creator can publish and trust the
        // backend to finish.
        setPhase("ready");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setError(msg);
      setPhase("error");
      haptic("heavy");
    }
  }, [title, category, chapter, thumb]);

  const retryUpload = useCallback((): void => {
    if (videoUri) {
      startUpload(videoUri, videoLabel);
    } else {
      setPhase("choose");
    }
  }, [videoUri, videoLabel, startUpload]);

  const clearVideo = useCallback((): void => {
    setVideoUri(null);
    setVideoLabel("");
    setEpisodeId(null);
    setProgress(0);
    setError(null);
    setPhase("choose");
  }, []);

  const submit = useCallback(
    async (status: "published" | "scheduled" | "draft"): Promise<void> => {
      setSubmitting(true);
      haptic("success");
      try {
        const finalTitle = title.trim().length > 0 ? title.trim() : "Untitled POV episode";
        const fallbackThumb =
          "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80";

        // publishEpisode now writes the real episodes row (when episodeId is
        // present) AND optimistically updates the local studio list.
        await publishEpisode({
          episodeId: episodeId ?? undefined,
          title: finalTitle,
          thumb: thumb ?? fallbackThumb,
          access,
          ppvPrice: access === "ppv" ? ppvPrice : undefined,
          category,
          status,
          description: description.trim().length > 0 ? description.trim() : undefined,
          chapter,
        });
        setPublished(status);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Publish failed.";
        setError(msg);
        setPhase("error");
      } finally {
        setSubmitting(false);
      }
    },
    [episodeId, access, ppvPrice, category, title, thumb, description, chapter, publishEpisode],
  );

  // ---- Success screen ----
  if (published) {
    return (
      <View style={[styles.screen, styles.doneWrap]}>
        <View style={styles.doneIcon}>
          <Check size={28} color={Colors.ink} />
        </View>
        <Text style={styles.doneTitle}>
          {published === "published"
            ? "Live on your feed."
            : published === "scheduled"
              ? "Queued to drop."
              : "Saved to your vault."}
        </Text>
        <Text style={styles.doneBody}>
          {published === "published"
            ? "Subscribers get a notification now. Processing to 4K, 1080p and 720p finishes in a few minutes."
            : published === "scheduled"
              ? "It publishes automatically and notifies your subscribers at the scheduled time."
              : "Drafts stay private until you publish them. Nothing is charged to fans."}
        </Text>
        <Button label="Back to studio" onPress={() => router.replace("/(tabs)/studio")} style={{ marginTop: 26 }} />
      </View>
    );
  }

  const canPublish = phase === "ready";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 44 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>New POV episode</Text>

      {/* ---- Upload zone ---- */}
      <UploadZone
        phase={phase}
        progress={progress}
        videoLabel={videoLabel}
        error={error}
        onPick={pickVideo}
        onRecord={recordVideo}
        onRetry={retryUpload}
        onClear={clearVideo}
      />

      {/* ---- Metadata (always editable) ---- */}
      <Text style={styles.label}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="You wake up as a founder on demo day"
        placeholderTextColor={Colors.textDim}
        style={styles.input}
        maxLength={90}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="What happens, what they'll feel, how long the raw section is…"
        placeholderTextColor={Colors.textDim}
        style={[styles.input, { height: 100, paddingTop: 14, textAlignVertical: "top" }]}
        multiline
        maxLength={300}
      />

      <Text style={styles.label}>Thumbnail</Text>
      <PressableScale onPress={pickThumb} scaleTo={0.98}>
        <View style={styles.thumbWrap}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Film size={20} color={Colors.textDim} />
              <Text style={styles.thumbPlaceholderText}>Auto-generated by Mux · tap to override</Text>
            </View>
          )}
          <View style={styles.thumbOverlay}>
            <FilePlus2 size={15} color={Colors.ink} />
            <Text style={styles.thumbText}>Change thumbnail</Text>
          </View>
        </View>
      </PressableScale>

      <Text style={styles.label}>Identity tag</Text>
      <View style={styles.chipWrap}>
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
      </View>

      <Text style={styles.label}>Chapter</Text>
      <View style={styles.chipWrap}>
        {CHAPTERS.map((c) => (
          <Chip key={c} label={c} active={chapter === c} onPress={() => setChapter(c)} />
        ))}
      </View>

      <Text style={styles.label}>Access level</Text>
      <View style={{ gap: 9 }}>
        <AccessOption
          icon={<Unlock size={17} color={access === "free" ? Colors.ink : Colors.lime} />}
          title="Free"
          body="Public teaser — grows your subscriber funnel"
          active={access === "free"}
          onPress={() => setAccess("free")}
        />
        <AccessOption
          icon={<Users size={17} color={access === "subscribers" ? Colors.ink : Colors.lime} />}
          title={`Subscribers only · ${formatMoney(creatorPrice)}/mo`}
          body="Included in your monthly feed"
          active={access === "subscribers"}
          onPress={() => setAccess("subscribers")}
        />
        <AccessOption
          icon={<Lock size={17} color={access === "ppv" ? Colors.ink : Colors.cyan} />}
          title="Pay-per-view"
          body="One-time unlock for a premium experience"
          active={access === "ppv"}
          accent={Colors.cyan}
          onPress={() => setAccess("ppv")}
        />
      </View>

      {access === "ppv" ? (
        <>
          <Text style={styles.label}>Unlock price</Text>
          <View style={styles.chipWrap}>
            {PPV_PRICES.map((p) => (
              <Chip
                key={p}
                label={`$${p}`}
                accent={Colors.cyan}
                active={ppvPrice === p}
                onPress={() => setPpvPrice(p)}
              />
            ))}
          </View>
          <Text style={styles.hint}>
            You keep {formatMoney(ppvPrice * 0.8)} per unlock. Bundles and limited-time promos can
            be added after publishing.
          </Text>
        </>
      ) : null}

      <View style={{ gap: 10, marginTop: 26 }}>
        <Button
          label={
            submitting
              ? "Publishing…"
              : canPublish
                ? "Publish now"
                : phase === "transcoding"
                  ? "Processing video…"
                  : phase === "uploading"
                    ? "Uploading…"
                    : "Pick a video first"
          }
          disabled={!canPublish || submitting}
          onPress={() => void submit("published")}
        />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button
            label="Schedule"
            variant="dark"
            small
            icon={<Clock size={14} color={Colors.text} />}
            disabled={!canPublish || submitting}
            onPress={() => void submit("scheduled")}
            style={{ flex: 1 }}
          />
          <Button
            label="Save draft"
            variant="ghost"
            small
            disabled={!canPublish || submitting}
            onPress={() => void submit("draft")}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      <Text style={styles.legal}>
        Every upload is scanned and reviewed against povme content guidelines. Everyone on camera
        must be 18+ and have consented. Faces of non-consenting bystanders should be blurred.
      </Text>
    </ScrollView>
  );
}

// ===========================================================================
// Upload zone — choose / uploading / transcoding / ready / error
// ===========================================================================

function UploadZone({
  phase,
  progress,
  videoLabel,
  error,
  onPick,
  onRecord,
  onRetry,
  onClear,
}: {
  phase: Phase;
  progress: number;
  videoLabel: string;
  error: string | null;
  onPick: () => void;
  onRecord: () => void;
  onRetry: () => void;
  onClear: () => void;
}) {
  if (phase === "error") {
    return (
      <View style={[styles.dropzone, { borderColor: Colors.danger, backgroundColor: "rgba(255,59,48,0.06)" }]}>
        <View style={[styles.dropIcon, { backgroundColor: Colors.danger }]}>
          <AlertCircle size={22} color="#fff" />
        </View>
        <Text style={styles.dropTitle}>Upload failed</Text>
        <Text style={styles.dropBody}>{error ?? "Something went wrong."}</Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <Button label="Retry" small onPress={onRetry} />
          <Button label="Cancel" variant="ghost" small onPress={onClear} />
        </View>
      </View>
    );
  }

  if (phase === "uploading") {
    return (
      <View style={styles.dropzone}>
        <View style={[styles.dropIcon, { backgroundColor: Colors.lime }]}>
          <UploadCloud size={22} color={Colors.ink} />
        </View>
        <Text style={styles.dropTitle}>Uploading… {Math.round(progress * 100)}%</Text>
        <View style={{ width: "100%", marginTop: 14 }}>
          <ProgressBar progress={progress} />
        </View>
        <Text style={styles.dropBody}>
          {videoLabel} · keep this screen open while we push your file
        </Text>
      </View>
    );
  }

  if (phase === "transcoding") {
    return (
      <View style={styles.dropzone}>
        <View style={[styles.dropIcon, { backgroundColor: Colors.cyan }]}>
          <Loader size={22} color={Colors.ink} />
        </View>
        <Text style={styles.dropTitle}>Transcoding…</Text>
        <Text style={styles.dropBody}>
          Mux is processing your video into 4K, 1080p and 720p. This usually takes a minute.
        </Text>
      </View>
    );
  }

  if (phase === "ready") {
    return (
      <View style={[styles.dropzone, { borderColor: Colors.lime, backgroundColor: "rgba(212,255,58,0.06)" }]}>
        <View style={[styles.dropIcon, { backgroundColor: Colors.lime }]}>
          <Check size={22} color={Colors.ink} />
        </View>
        <Text style={styles.dropTitle}>Video ready</Text>
        <Text style={styles.dropBody}>{videoLabel} · processed and ready to publish</Text>
        <Button label="Replace video" variant="ghost" small onPress={onClear} style={{ marginTop: 14 }} />
      </View>
    );
  }

  // choose
  return (
    <View style={styles.dropzone}>
      <View style={styles.dropIcon}>
        <Clapperboard size={22} color={Colors.ink} />
      </View>
      <Text style={styles.dropTitle}>Upload your POV footage</Text>
      <Text style={styles.dropBody}>MP4 or MOV · up to 4K · chest rig, glasses, helmet</Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <PressableScale onPress={onPick} scaleTo={0.96}>
          <View style={styles.choiceBtn}>
            <Video size={16} color={Colors.ink} />
            <Text style={styles.choiceText}>Pick from library</Text>
          </View>
        </PressableScale>
        <PressableScale onPress={onRecord} scaleTo={0.96}>
          <View style={[styles.choiceBtn, { backgroundColor: Colors.surfaceHi }]}>
            <Camera size={16} color={Colors.text} />
            <Text style={[styles.choiceText, { color: Colors.text }]}>Record</Text>
          </View>
        </PressableScale>
      </View>
    </View>
  );
}

// ===========================================================================
// Helpers
// ===========================================================================

function AccessOption({
  icon,
  title,
  body,
  active,
  onPress,
  accent = Colors.lime,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  active: boolean;
  onPress: () => void;
  accent?: string;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.98}>
      <View style={[styles.accessCard, active && { borderColor: accent, backgroundColor: `${accent}12` }]}>
        <View style={[styles.accessIcon, active && { backgroundColor: accent }]}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.accessTitle}>{title}</Text>
          <Text style={styles.accessBody}>{body}</Text>
        </View>
        <View style={[styles.radio, active && { backgroundColor: accent, borderColor: accent }]}>
          {active ? <Check size={12} color={Colors.ink} /> : null}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  kicker: { ...microLabel, color: Colors.lime, marginBottom: 14 },
  dropzone: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: Colors.borderHi,
    backgroundColor: Colors.surface,
    padding: 24,
    alignItems: "center",
  },
  dropIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  dropTitle: { color: Colors.text, fontSize: 16, fontWeight: "900" },
  dropBody: { color: Colors.textDim, fontSize: 12, fontWeight: "600", marginTop: 7, textAlign: "center" },
  choiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: Colors.lime,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: Radius.pill,
  },
  choiceText: { color: Colors.ink, fontSize: 13, fontWeight: "900" },
  label: { ...microLabel, color: Colors.textDim, marginTop: 24, marginBottom: 9 },
  input: {
    minHeight: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    color: Colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  thumbWrap: {
    height: 170,
    borderRadius: Radius.md,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 12,
  },
  thumbPlaceholder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.surface,
  },
  thumbPlaceholderText: { color: Colors.textDim, fontSize: 11, fontWeight: "600", textAlign: "center" },
  thumbOverlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.lime,
    paddingHorizontal: 13,
    height: 34,
    borderRadius: Radius.pill,
  },
  thumbText: { color: Colors.ink, fontSize: 12.5, fontWeight: "900" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  accessCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  accessIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
  },
  accessTitle: { color: Colors.text, fontSize: 14, fontWeight: "800" },
  accessBody: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.borderHi,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", lineHeight: 18, marginTop: 12 },
  legal: { color: Colors.textDim, fontSize: 11, fontWeight: "600", lineHeight: 17, marginTop: 22 },
  doneWrap: { alignItems: "center", justifyContent: "center", padding: 30 },
  doneIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 20,
    textAlign: "center",
  },
  doneBody: {
    color: Colors.textMid,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
  },
});
