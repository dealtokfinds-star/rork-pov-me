import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Eye,
  PartyPopper,
  Radio,
  Sparkles,
  UserPlus,
} from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Button, Chip, PressableScale, ProgressBar } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { CATEGORIES } from "@/lib/format";
import { useCategories } from "@/hooks/useDiscovery";
import { useCreators } from "@/lib/data";
import { useProfile } from "@/hooks/useProfile";
import { useApp } from "@/providers/app-provider";
import type { Category, Creator, PovCategory } from "@/types";

/**
 * POVMe onboarding — the "first episode" of the user's own POVMe life.
 *
 * Flow (streaming-platform best-of, adapted to POVMe's POV promise):
 *   0-2  Cinematic welcome slides — what POVMe is, how POV works, live POV.
 *   3    Identity — the name that shows in chat / tips / DMs. 18+ gate.
 *   4    Taste — pick the lives you want to step into (categories).
 *   5    Follow creators — seed the Following feed (Twitch/Spotify pattern).
 *   6    Ready — wallet credit reveal + enter the app.
 *
 * Design: cinematic ink-black, full-bleed imagery on slides, acid-lime progress,
 * form steps on solid bg with a single decision per screen. Every step has a
 * clear single CTA and a way back. The "Skip" affordance jumps to identity.
 */
const SLIDES = [
  {
    kicker: "Welcome to POVMe",
    title: "Stop watching highlight reels.\nStep inside the life.",
    body: "Every episode is filmed first-person — chest rigs, glasses, helmet cams. You don't watch their day. You wear it.",
    image:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
    icon: <Eye size={22} color={Colors.ink} />,
  },
  {
    kicker: "How POVMe works",
    title: "Subscribe to a life.\nUnlock the big days.",
    body: "A monthly sub gets you a creator's full POV feed. Premium adventures — ringside, cockpit, pitch day — unlock one at a time.",
    image:
      "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=80",
    icon: <Sparkles size={22} color={Colors.ink} />,
  },
  {
    kicker: "Live POV",
    title: "Be there\nwhile it happens.",
    body: "Creators go live from a body cam. Chat, tip, send gifts, and stay for the paid replay — like you were on their shoulder.",
    image:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=80",
    icon: <Radio size={22} color={Colors.ink} />,
  },
] as const;

const IDENTITY_STEP = SLIDES.length;
const TASTE_STEP = SLIDES.length + 1;
const FOLLOW_STEP = SLIDES.length + 2;
const READY_STEP = SLIDES.length + 3;
const TOTAL_STEPS = READY_STEP + 1; // 0-indexed progress uses step+1

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completeOnboarding, toggleFollow } = useApp();
  const { updateProfile } = useProfile();
  const { data: dbCategories } = useCategories();
  const { data: creatorsData } = useCreators();
  const allCategories = dbCategories ?? CATEGORIES;
  const allCreators = creatorsData ?? [];
  const [step, setStep] = useState<number>(0);
  const [name, setName] = useState<string>("");
  const [picked, setPicked] = useState<PovCategory[]>([]);
  const [followed, setFollowed] = useState<string[]>([]);
  const [finishing, setFinishing] = useState<boolean>(false);
  const fade = useRef(new Animated.Value(1)).current;

  const go = (next: number): void => {
    const clamped = Math.max(0, Math.min(READY_STEP, next));
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 130, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start();
    setStep(clamped);
  };

  const toggleCategory = (id: PovCategory): void => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const toggleFollowCreator = (id: string): void => {
    setFollowed((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  // Creators recommended for the picked categories; fall back to all if none picked.
  const recommendedCreators: Creator[] =
    picked.length > 0
      ? allCreators.filter((c) => c.categories.some((cat) => picked.includes(cat)))
      : allCreators;

  const finish = async (): Promise<void> => {
    setFinishing(true);
    // Persist followed creators into local app state so the Following feed seeds.
    followed.forEach((id) => toggleFollow(id));
    try {
      await updateProfile({
        name: name.trim() || null,
        handle: name.trim().toLowerCase().replace(/\s+/g, "") || null,
        interests: picked,
        onboarded: true,
      });
    } catch (err) {
      console.log("[povme] onboarding profile sync failed:", err);
    } finally {
      // Always complete local onboarding so the UI proceeds even if the
      // backend write fails (RLS/network) — the row will retry on next sync.
      completeOnboarding(name, picked, followed);
      setFinishing(false);
      router.replace("/(tabs)");
    }
  };

  const isSlide = step < SLIDES.length;
  const slide = isSlide ? SLIDES[step] : null;

  return (
    <View style={styles.screen}>
      {slide ? (
        <>
          <Image source={{ uri: slide.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={["rgba(8,8,10,0.5)", "rgba(8,8,10,0.82)", Colors.ink]}
            locations={[0, 0.55, 0.95]}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            style={[
              styles.slideBody,
              { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 26, opacity: fade },
            ]}
          >
            <View style={styles.topRow}>
              <Text style={styles.wordmark}>
                POV<Text style={{ color: Colors.lime }}>ME</Text>
              </Text>
              <PressableScale onPress={() => go(IDENTITY_STEP)} scaleTo={0.94}>
                <Text style={styles.skip}>Skip intro</Text>
              </PressableScale>
            </View>

            <View style={{ flex: 1, justifyContent: "flex-end", gap: 14 }}>
              <View style={styles.iconBadge}>{slide.icon}</View>
              <Text style={styles.kicker}>{slide.kicker}</Text>
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideBodyText}>{slide.body}</Text>
              <View style={{ marginTop: 14 }}>
                <ProgressBar progress={(step + 1) / TOTAL_STEPS} />
              </View>
              <View style={styles.slideNavRow}>
                {step > 0 ? (
                  <PressableScale onPress={() => go(step - 1)} scaleTo={0.94}>
                    <Text style={styles.backBtn}>Back</Text>
                  </PressableScale>
                ) : (
                  <View />
                )}
                <Button
                  label={step === SLIDES.length - 1 ? "Set up my feed" : "Next"}
                  icon={<ArrowRight size={17} color={Colors.ink} />}
                  onPress={() => go(step + 1)}
                  style={{ flex: 1, marginLeft: 12 }}
                />
              </View>
            </View>
          </Animated.View>
        </>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{
              paddingTop: insets.top + 28,
              paddingBottom: insets.bottom + 40,
              paddingHorizontal: 22,
              flexGrow: 1,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={{ flex: 1, opacity: fade }}>
              {/* Top bar: wordmark + back + progress */}
              <View style={styles.formTopBar}>
                <PressableScale onPress={() => go(Math.max(0, step - 1))} scaleTo={0.94}>
                  <Text style={styles.backBtn}>Back</Text>
                </PressableScale>
                <Text style={styles.stepCounter}>
                  Step {step - SLIDES.length + 1} of 4
                </Text>
                <PressableScale
                  onPress={() => step < READY_STEP && go(step + 1)}
                  scaleTo={0.94}
                >
                  <Text style={styles.skip}>Skip</Text>
                </PressableScale>
              </View>
              <View style={styles.progressWrap}>
                <ProgressBar progress={(step + 1) / TOTAL_STEPS} />
              </View>

              {step === IDENTITY_STEP && (
                <IdentityStep
                  name={name}
                  setName={setName}
                  onContinue={() => go(TASTE_STEP)}
                />
              )}

              {step === TASTE_STEP && (
                <TasteStep
                  categories={allCategories}
                  picked={picked}
                  toggle={toggleCategory}
                  onContinue={() => go(FOLLOW_STEP)}
                />
              )}

              {step === FOLLOW_STEP && (
                <FollowStep
                  creators={recommendedCreators}
                  followed={followed}
                  toggle={toggleFollowCreator}
                  onContinue={() => go(READY_STEP)}
                />
              )}

              {step === READY_STEP && (
                <ReadyStep
                  name={name}
                  pickedCount={picked.length}
                  followedCount={followed.length}
                  finishing={finishing}
                  onFinish={() => void finish()}
                />
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

/* ----------------------------- Step 1: Identity ---------------------------- */

function IdentityStep({
  name,
  setName,
  onContinue,
}: {
  name: string;
  setName: (v: string) => void;
  onContinue: () => void;
}): React.ReactElement {
  return (
    <View style={{ flex: 1, marginTop: 28 }}>
      <Text style={styles.kicker}>Your POVMe identity</Text>
      <Text style={styles.formTitle}>What should creators call you?</Text>
      <Text style={styles.formBody}>
        This is the name that shows in live chat, tips, and DMs. You can change it
        anytime in Settings.
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your name or handle"
        placeholderTextColor={Colors.textDim}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
        maxLength={22}
        autoFocus
      />
      <View style={styles.ageNote}>
        <Check size={14} color={Colors.lime} />
        <Text style={styles.ageNoteText}>
          I confirm I&apos;m 18+ and I accept POVMe&apos;s terms and content guidelines.
        </Text>
      </View>
      <View style={{ flex: 1 }} />
      <Button
        label={name.trim().length > 0 ? "Continue" : "Continue as guest"}
        icon={<ArrowRight size={17} color={Colors.ink} />}
        onPress={onContinue}
      />
    </View>
  );
}

/* ------------------------------- Step 2: Taste ----------------------------- */

function TasteStep({
  categories,
  picked,
  toggle,
  onContinue,
}: {
  categories: Category[];
  picked: PovCategory[];
  toggle: (id: PovCategory) => void;
  onContinue: () => void;
}): React.ReactElement {
  return (
    <View style={{ flex: 1, marginTop: 28 }}>
      <Text style={styles.kicker}>Your taste</Text>
      <Text style={styles.formTitle}>Whose life do you want to live?</Text>
      <Text style={styles.formBody}>
        Pick a few. We&apos;ll shape your Discover feed around them — change it anytime.
      </Text>
      <View style={styles.chipWrap}>
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.label}
            emoji={c.emoji}
            accent={c.accent}
            active={picked.includes(c.id)}
            onPress={() => toggle(c.id)}
          />
        ))}
      </View>
      <View style={{ flex: 1, minHeight: 20 }} />
      <Button
        label={
          picked.length > 0
            ? `Continue · ${picked.length} selected`
            : "Continue"
        }
        icon={<ArrowRight size={17} color={Colors.ink} />}
        onPress={onContinue}
      />
    </View>
  );
}

/* --------------------------- Step 3: Follow creators ----------------------- */

function FollowStep({
  creators,
  followed,
  toggle,
  onContinue,
}: {
  creators: Creator[];
  followed: string[];
  toggle: (id: string) => void;
  onContinue: () => void;
}): React.ReactElement {
  return (
    <View style={{ flex: 1, marginTop: 28 }}>
      <Text style={styles.kicker}>Seed your feed</Text>
      <Text style={styles.formTitle}>Follow a few creators.</Text>
      <Text style={styles.formBody}>
        Their new POV episodes and live streams land in your Following tab. You can
        unfollow anytime.
      </Text>

      <ScrollView
        style={{ flex: 1, marginTop: 18 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
      >
        {creators.map((c) => {
          const isFollowed = followed.includes(c.id);
          return (
            <PressableScale
              key={c.id}
              onPress={() => toggle(c.id)}
              scaleTo={0.98}
              hapticStyle="light"
            >
              <View style={[styles.creatorRow, isFollowed && styles.creatorRowActive]}>
                <Avatar uri={c.avatar} size={46} ring={isFollowed} />
                <View style={{ flex: 1 }}>
                  <View style={styles.creatorNameRow}>
                    <Text style={styles.creatorName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    {c.verified ? <BadgeCheck size={14} color={Colors.cyan} /> : null}
                  </View>
                  <Text style={styles.creatorHandle} numberOfLines={1}>
                    @{c.handle} · {c.location}
                  </Text>
                </View>
                <View style={[styles.followBtn, isFollowed && styles.followBtnActive]}>
                  {isFollowed ? (
                    <Check size={14} color={Colors.ink} />
                  ) : (
                    <UserPlus size={14} color={Colors.text} />
                  )}
                  <Text style={[styles.followLabel, isFollowed && styles.followLabelActive]}>
                    {isFollowed ? "Following" : "Follow"}
                  </Text>
                </View>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>

      <Button
        label={
          followed.length > 0
            ? `Continue · following ${followed.length}`
            : "Continue"
        }
        icon={<ArrowRight size={17} color={Colors.ink} />}
        onPress={onContinue}
      />
    </View>
  );
}

/* ------------------------------- Step 4: Ready ----------------------------- */

function ReadyStep({
  name,
  pickedCount,
  followedCount,
  finishing,
  onFinish,
}: {
  name: string;
  pickedCount: number;
  followedCount: number;
  finishing: boolean;
  onFinish: () => void;
}): React.ReactElement {
  return (
    <View style={{ flex: 1, marginTop: 28, alignItems: "center" }}>
      <View style={styles.readyIcon}>
        <PartyPopper size={26} color={Colors.lime} />
      </View>
      <Text style={styles.kicker}>'Bout time</Text>
      <Text style={styles.readyTitle}>
        {name.trim().length > 0 ? `Let's go, ${name.trim()}.` : "Let's go."}
      </Text>
      <Text style={styles.formBody}>"Your feed is ready."</Text>

      <View style={styles.readySummary}>
        <SummaryRow label="Taste" value={pickedCount > 0 ? `${pickedCount} categories` : "All"} />
        <SummaryRow
          label="Following"
          value={followedCount > 0 ? `${followedCount} creators` : "Explore later"}
        />
        <SummaryRow label="Wallet" value="$120 demo credit" accent={Colors.lime} />
      </View>

      <Text style={styles.walletNote}>
        We&apos;ve dropped $120 in demo credit into your wallet so you can subscribe,
        unlock, and tip right away. No card needed to explore.
      </Text>

      <View style={{ flex: 1 }} />
      <Button
        label={finishing ? "Saving…" : "Enter POVMe"}
        icon={<ArrowRight size={17} color={Colors.ink} />}
        onPress={onFinish}
        disabled={finishing}
      />
    </View>
  );
}

function SummaryRow({
  label,
  value,
  accent = Colors.text,
}: {
  label: string;
  value: string;
  accent?: string;
}): React.ReactElement {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

/* --------------------------------- Styles --------------------------------- */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink },
  slideBody: { flex: 1, paddingHorizontal: 22 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordmark: { color: Colors.text, fontSize: 20, fontWeight: "900", letterSpacing: -1 },
  skip: { color: Colors.textMid, fontSize: 13.5, fontWeight: "700" },
  backBtn: { color: Colors.textMid, fontSize: 13.5, fontWeight: "700" },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: { ...microLabel, color: Colors.lime },
  slideTitle: {
    color: Colors.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.4,
    lineHeight: 39,
  },
  slideBodyText: { color: Colors.textMid, fontSize: 15, fontWeight: "500", lineHeight: 22 },
  slideNavRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 12,
  },
  formTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepCounter: { color: Colors.textDim, fontSize: 12, fontWeight: "700" },
  progressWrap: { marginTop: 14 },
  formTitle: {
    color: Colors.text,
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -1.1,
    lineHeight: 34,
    marginTop: 10,
  },
  formBody: { color: Colors.textMid, fontSize: 14, fontWeight: "500", lineHeight: 21, marginTop: 10 },
  input: {
    height: 58,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 18,
    color: Colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 22,
  },
  ageNote: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginTop: 18 },
  ageNoteText: { flex: 1, color: Colors.textDim, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 24 },
  // Follow step
  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  creatorRowActive: { borderColor: Colors.lime, backgroundColor: "rgba(204,255,0,0.06)" },
  creatorNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  creatorName: { color: Colors.text, fontSize: 15, fontWeight: "800" },
  creatorHandle: { color: Colors.textDim, fontSize: 12, fontWeight: "600", marginTop: 2 },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceHi,
    borderWidth: 1,
    borderColor: Colors.borderHi,
  },
  followBtnActive: { backgroundColor: Colors.lime, borderColor: Colors.lime },
  followLabel: { color: Colors.text, fontSize: 12.5, fontWeight: "800" },
  followLabelActive: { color: Colors.ink },
  // Ready step
  readyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(204,255,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  readyTitle: {
    color: Colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1.2,
    marginTop: 6,
    textAlign: "center",
  },
  readySummary: {
    width: "100%",
    marginTop: 28,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 14,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryLabel: { color: Colors.textDim, fontSize: 13, fontWeight: "700" },
  summaryValue: { fontSize: 14, fontWeight: "900" },
  walletNote: {
    color: Colors.textDim,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 18,
    textAlign: "center",
    paddingHorizontal: 12,
  },
});
