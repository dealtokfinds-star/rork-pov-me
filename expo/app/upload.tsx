import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Check, Clock, FilePlus2, Lock, Unlock, UploadCloud, Users } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Button, Chip, PressableScale, ProgressBar, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { CATEGORIES, formatMoney } from "@/constants/mock-data";
import { useApp } from "@/providers/app-provider";
import type { AccessLevel, PovCategory } from "@/types";

const CHAPTERS = ["Morning", "Work", "Gym", "Night out", "Travel day", "Debrief"];
const PPV_PRICES = [4.99, 6.99, 9.99, 12.99, 14.99, 19.99];

export default function UploadScreen() {
  const router = useRouter();
  const { publishEpisode, creatorPrice } = useApp();
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [thumb, setThumb] = useState<string>(
    "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80",
  );
  const [category, setCategory] = useState<PovCategory>("founder");
  const [chapter, setChapter] = useState<string>("Work");
  const [access, setAccess] = useState<AccessLevel>("subscribers");
  const [ppvPrice, setPpvPrice] = useState<number>(9.99);
  const [progress, setProgress] = useState<number>(0);
  const [uploaded, setUploaded] = useState<boolean>(false);
  const [published, setPublished] = useState<"published" | "scheduled" | "draft" | null>(null);

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
    } catch (error) {
      console.log("[povme] thumbnail pick failed", error);
    }
  }, []);

  const simulateUpload = useCallback((): void => {
    setProgress(0.05);
    haptic("medium");
    let value = 0.05;
    const timer = setInterval(() => {
      value += 0.09 + Math.random() * 0.08;
      if (value >= 1) {
        setProgress(1);
        setUploaded(true);
        clearInterval(timer);
        haptic("success");
        return;
      }
      setProgress(value);
    }, 320);
  }, []);

  const submit = useCallback(
    (status: "published" | "scheduled" | "draft") => {
      publishEpisode({
        title: title.trim().length > 0 ? title.trim() : "Untitled POV episode",
        thumb,
        access,
        ppvPrice: access === "ppv" ? ppvPrice : undefined,
        category,
        status,
      });
      setPublished(status);
      haptic("success");
    },
    [publishEpisode, title, thumb, access, ppvPrice, category],
  );

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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 44 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>New POV episode</Text>

      <PressableScale onPress={progress === 0 ? simulateUpload : undefined} scaleTo={0.98}>
        <View style={styles.dropzone}>
          {progress === 0 ? (
            <>
              <View style={styles.dropIcon}>
                <UploadCloud size={22} color={Colors.ink} />
              </View>
              <Text style={styles.dropTitle}>Upload your POV footage</Text>
              <Text style={styles.dropBody}>MP4 or MOV · up to 4K · chest rig, glasses, helmet</Text>
            </>
          ) : (
            <>
              <Text style={styles.dropTitle}>
                {uploaded ? "Upload complete" : `Uploading… ${Math.round(progress * 100)}%`}
              </Text>
              <View style={{ width: "100%", marginTop: 14 }}>
                <ProgressBar progress={progress} />
              </View>
              <Text style={styles.dropBody}>
                {uploaded
                  ? "day_full_pov.mp4 · 3.2 GB · transcoding queued"
                  : "Keep this screen open while we push your file"}
              </Text>
            </>
          )}
        </View>
      </PressableScale>

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
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" />
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
          label={uploaded ? "Publish now" : "Publish now (upload first)"}
          disabled={!uploaded}
          onPress={() => submit("published")}
        />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button
            label="Schedule"
            variant="dark"
            small
            icon={<Clock size={14} color={Colors.text} />}
            onPress={() => submit("scheduled")}
            style={{ flex: 1 }}
          />
          <Button label="Save draft" variant="ghost" small onPress={() => submit("draft")} style={{ flex: 1 }} />
        </View>
      </View>

      <Text style={styles.legal}>
        Every upload is scanned and reviewed against povme content guidelines. Everyone on camera
        must be 18+ and have consented. Faces of non-consenting bystanders should be blurred.
      </Text>
    </ScrollView>
  );
}

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
