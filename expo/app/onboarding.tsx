import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Dices,
  Eye,
  PartyPopper,
  Radio,
  RotateCcw,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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

import {
  Avatar,
  Button,
  Chip,
  ConfettiBurst,
  PressableScale,
  ProgressBar,
  Tag,
  haptic,
} from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { CATEGORIES } from "@/constants/mock-data";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, type AccountUpdateInput } from "@/hooks/useProfile";
import { useCreators } from "@/lib/data";
import {
  avatarOptionForSeed,
  AVATAR_PALETTES,
  findFreeSuggestions,
  generatedAvatarUrl,
  initialsFor,
  isHandleTaken,
  normalizeHandle,
  resolveFreeHandle,
  type HandleStatus,
} from "@/lib/identity";
import { useApp, type OnboardingIntent } from "@/providers/app-provider";
import type { Creator, PovCategory } from "@/types";

/**
 * POVMe onboarding — the "first episode" of the user's own POVMe life.
 *
 * Flow:
 *   0-2  Cinematic welcome slides — what POVMe is, how POV works, live POV.
 *   3    Intent fork — "step into other lives" (viewer) vs "broadcast mine"
 *        (creator, auto-routes into Studio Setup after the shared spine).
 *   4    Identity — name/handle with real-time availability check against
 *        profiles.handle, taken-handle suggestions, auto-avatar shuffle. 18+ gate.
 *   5    Taste — pick the lives you want to step into (3+ nudge).
 *   6    Follow creators — seed the Following feed ("Follow all" quick action).
 *   7    Ready — confetti, staggered summary, intent-aware CTA.
 *
 * Abandoned sessions persist as a draft (step + fields) and surface a
 * "Pick up where you left off" banner on return.
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

const INTENT_STEP = SLIDES.length;
const IDENTITY_STEP = SLIDES.length + 1;
const TASTE_STEP = SLIDES.length + 2;
const FOLLOW_STEP = SLIDES.length + 3;
const READY_STEP = SLIDES.length + 4;
const TOTAL_STEPS = READY_STEP + 1; // 0-indexed progress uses step+1
const FORM_STEP_COUNT = TOTAL_STEPS - SLIDES.length;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    completeOnboarding,
    onboardingDraft,
    saveOnboardingDraft,
    clearOnboardingDraft,
  } = useApp();
  const { account, updateProfile } = useProfile();
  const { user } = useAuth();

  const [step, setStep] = useState<number>(0);
  const [intent, setIntent] = useState<OnboardingIntent | null>(null);
  const [name, setName] = useState<string>("");
  const [avatarSeed, setAvatarSeed] = useState<number>(0);
  const [picked, setPicked] = useState<PovCategory[]>([]);
  const [followed, setFollowed] = useState<string[]>([]);
  const [finishing, setFinishing] = useState<boolean>(false);
  const fade = useRef(new Animated.Value(1)).current;
  const slideX = useRef(new Animated.Value(0)).current;
  const stepRef = useRef<number>(0);

  const photoUrl = account?.avatarUrl ?? user?.picture ?? null;

  /**
   * Direction-aware step transition: the outgoing step slides + fades out
   * toward where you came from, the incoming step slides + springs in from
   * the direction you're headed. Forward = right-to-left, back = left-to-right.
   */
  const go = (next: number): void => {
    const clamped = Math.max(0, Math.min(READY_STEP, next));
    if (clamped === stepRef.current) return;
    const dir = clamped > stepRef.current ? 1 : -1;
    stepRef.current = clamped;
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(slideX, { toValue: -44 * dir, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setStep(clamped);
      slideX.setValue(44 * dir);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.spring(slideX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 24,
          stiffness: 280,
          mass: 0.8,
        }),
      ]).start();
    });
  };

  const { data: creatorsData = [] } = useCreators();

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
      ? creatorsData.filter((c) => c.categories.some((cat) => picked.includes(cat)))
      : creatorsData;

  const allFollowed =
    recommendedCreators.length > 0 &&
    recommendedCreators.every((c) => followed.includes(c.id));

  const toggleFollowAll = (): void => {
    setFollowed(allFollowed ? [] : recommendedCreators.map((c) => c.id));
  };

  // ─── Draft persistence: save progress so abandoned sessions can resume ─────
  useEffect(() => {
    if (finishing) return;
    const hasContent =
      intent !== null || name.trim().length > 0 || picked.length > 0 || followed.length > 0;
    if (step < INTENT_STEP && !hasContent) return;
    const timer = setTimeout(() => {
      saveOnboardingDraft({
        step,
        intent,
        name,
        avatarSeed,
        picked,
        followed,
        savedAt: Date.now(),
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [step, intent, name, avatarSeed, picked, followed, finishing, saveOnboardingDraft]);

  const resumableDraft =
    onboardingDraft && onboardingDraft.step >= INTENT_STEP ? onboardingDraft : null;
  const draftStepsToGo = resumableDraft
    ? READY_STEP - Math.min(resumableDraft.step, READY_STEP) + 1
    : 0;

  const resumeDraft = (): void => {
    if (!resumableDraft) return;
    setIntent(resumableDraft.intent);
    setName(resumableDraft.name);
    setAvatarSeed(resumableDraft.avatarSeed);
    setPicked(resumableDraft.picked);
    setFollowed(resumableDraft.followed);
    go(Math.min(resumableDraft.step, READY_STEP));
  };

  const startOver = (): void => {
    clearOnboardingDraft();
  };

  const continueFromIntent = (): void => {
    if (intent === null) setIntent("viewer");
    go(IDENTITY_STEP);
  };

  const skipForm = (): void => {
    if (step === INTENT_STEP && intent === null) setIntent("viewer");
    if (step < READY_STEP) go(step + 1);
  };

  /**
   * Finish: resolve a collision-free handle (profiles.handle is UNIQUE),
   * persist the profile (with the generated avatar when no photo is in use),
   * clear the draft, and route — creators go straight into Studio Setup.
   */
  const finish = async (): Promise<void> => {
    setFinishing(true);
    const trimmed = name.trim();
    let finalHandle = normalizeHandle(trimmed);
    const { usePhoto, paletteIndex } = avatarOptionForSeed(avatarSeed, !!photoUrl);
    try {
      if (finalHandle.length >= 3) {
        finalHandle = await resolveFreeHandle(finalHandle, user?.id ?? null);
      } else {
        finalHandle = "";
      }

      const payload: Partial<AccountUpdateInput> = {
        name: trimmed || null,
        handle: finalHandle || null,
        interests: picked,
        onboarded: true,
      };
      if (!usePhoto && (trimmed.length > 0 || avatarSeed > 0)) {
        payload.avatarUrl = generatedAvatarUrl(trimmed || finalHandle || "POV Me", paletteIndex);
      }

      try {
        await updateProfile(payload);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Last line of defense against a unique-violation race on the handle.
        if (finalHandle && /duplicate|unique|23505/i.test(msg)) {
          const fallback = `${finalHandle.slice(0, 19)}_${1000 + Math.floor(Math.random() * 8999)}`;
          await updateProfile({ ...payload, handle: fallback });
          finalHandle = fallback;
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.log("[povme] onboarding profile sync failed:", err);
    } finally {
      // Always complete local onboarding so the UI proceeds even if the
      // backend write fails (RLS/network) — the row will retry on next sync.
      completeOnboarding(trimmed, picked, followed, finalHandle || undefined);
      setFinishing(false);
      router.replace("/(tabs)");
      if (intent === "creator") {
        setTimeout(() => router.push("/become-creator"), 450);
      }
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
              {
                paddingTop: insets.top + 24,
                paddingBottom: insets.bottom + 26,
                opacity: fade,
                transform: [{ translateX: slideX }],
              },
            ]}
          >
            <View style={styles.topRow}>
              <Text style={styles.wordmark}>
                POV<Text style={{ color: Colors.lime }}>ME</Text>
              </Text>
              <PressableScale onPress={() => go(INTENT_STEP)} scaleTo={0.94}>
                <Text style={styles.skip}>Skip intro</Text>
              </PressableScale>
            </View>

            {step === 0 && resumableDraft ? (
              <View style={styles.resumeCard}>
                <View style={styles.resumeIcon}>
                  <RotateCcw size={15} color={Colors.lime} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resumeTitle}>Pick up where you left off</Text>
                  <Text style={styles.resumeSub}>
                    {draftStepsToGo} step{draftStepsToGo === 1 ? "" : "s"} to go
                    {resumableDraft.name.trim().length > 0 ? ` · ${resumableDraft.name.trim()}` : ""}
                  </Text>
                  <View style={styles.resumeActions}>
                    <PressableScale onPress={resumeDraft} scaleTo={0.95} hapticStyle="medium">
                      <View style={styles.resumeBtn}>
                        <Text style={styles.resumeBtnLabel}>Resume</Text>
                        <ArrowRight size={13} color={Colors.ink} />
                      </View>
                    </PressableScale>
                    <PressableScale onPress={startOver} scaleTo={0.95}>
                      <Text style={styles.resumeReset}>Start over</Text>
                    </PressableScale>
                  </View>
                </View>
              </View>
            ) : null}

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
            <Animated.View
              style={{ flex: 1, opacity: fade, transform: [{ translateX: slideX }] }}
            >
              {/* Top bar: back + step counter + skip */}
              <View style={styles.formTopBar}>
                <PressableScale onPress={() => go(Math.max(0, step - 1))} scaleTo={0.94}>
                  <Text style={styles.backBtn}>Back</Text>
                </PressableScale>
                <Text style={styles.stepCounter}>
                  Step {step - SLIDES.length + 1} of {FORM_STEP_COUNT}
                </Text>
                <PressableScale onPress={skipForm} scaleTo={0.94}>
                  <Text style={styles.skip}>Skip</Text>
                </PressableScale>
              </View>
              <View style={styles.progressWrap}>
                <ProgressBar progress={(step + 1) / TOTAL_STEPS} />
              </View>

              {step === INTENT_STEP && (
                <IntentStep
                  intent={intent}
                  setIntent={setIntent}
                  onContinue={continueFromIntent}
                />
              )}

              {step === IDENTITY_STEP && (
                <IdentityStep
                  name={name}
                  setName={setName}
                  selfId={user?.id ?? null}
                  existingHandle={account?.handle ?? null}
                  photoUrl={photoUrl}
                  avatarSeed={avatarSeed}
                  onShuffle={() => setAvatarSeed((s) => s + 1)}
                  onContinue={() => go(TASTE_STEP)}
                />
              )}

              {step === TASTE_STEP && (
                <TasteStep
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
                  allFollowed={allFollowed}
                  onToggleAll={toggleFollowAll}
                  onContinue={() => go(READY_STEP)}
                />
              )}

              {step === READY_STEP && (
                <ReadyStep
                  name={name}
                  handlePreview={normalizeHandle(name)}
                  intent={intent}
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

/* ------------------------------ Step 1: Intent ----------------------------- */

function IntentStep({
  intent,
  setIntent,
  onContinue,
}: {
  intent: OnboardingIntent | null;
  setIntent: (v: OnboardingIntent) => void;
  onContinue: () => void;
}): React.ReactElement {
  return (
    <View style={{ flex: 1, marginTop: 28 }}>
      <Text style={styles.kicker}>First things first</Text>
      <Text style={styles.formTitle}>How do you want to live?</Text>
      <Text style={styles.formBody}>
        One tap. You can switch later — every creator starts as a viewer.
      </Text>

      <View style={{ gap: 12, marginTop: 24 }}>
        <IntentCard
          active={intent === "viewer"}
          icon={<Eye size={20} color={intent === "viewer" ? Colors.ink : Colors.lime} />}
          title="Step into other lives"
          body="Watch POV episodes, join lives, chat and tip."
          onPress={() => setIntent("viewer")}
        />
        <IntentCard
          active={intent === "creator"}
          icon={<Radio size={20} color={intent === "creator" ? Colors.ink : Colors.magenta} />}
          title="Broadcast mine"
          body="Publish your POV, go live, earn from subs, tips and unlocks."
          badge="YOU KEEP 80%"
          onPress={() => setIntent("creator")}
        />
      </View>

      <PressableScale onPress={onContinue} scaleTo={0.95} style={{ alignSelf: "center" }}>
        <Text style={styles.exploringLink}>Just exploring for now</Text>
      </PressableScale>

      <View style={{ flex: 1 }} />
      <Button
        label={intent === "creator" ? "Continue — creator path" : "Continue"}
        icon={<ArrowRight size={17} color={Colors.ink} />}
        onPress={onContinue}
      />
    </View>
  );
}

function IntentCard({
  active,
  icon,
  title,
  body,
  badge,
  onPress,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  body: string;
  badge?: string;
  onPress: () => void;
}): React.ReactElement {
  return (
    <PressableScale onPress={onPress} scaleTo={0.97} hapticStyle="medium">
      <View style={[styles.intentCard, active && styles.intentCardActive]}>
        <View style={[styles.intentIconWrap, active && styles.intentIconWrapActive]}>{icon}</View>
        <View style={{ flex: 1 }}>
          <View style={styles.intentTitleRow}>
            <Text style={styles.intentTitle}>{title}</Text>
            {badge ? (
              <View style={styles.intentBadge}>
                <Text style={styles.intentBadgeText}>{badge}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.intentBody}>{body}</Text>
        </View>
        <View style={[styles.intentRadio, active && styles.intentRadioActive]}>
          {active ? <Check size={13} color={Colors.ink} /> : null}
        </View>
      </View>
    </PressableScale>
  );
}

/* ----------------------------- Step 2: Identity ---------------------------- */

function IdentityStep({
  name,
  setName,
  selfId,
  existingHandle,
  photoUrl,
  avatarSeed,
  onShuffle,
  onContinue,
}: {
  name: string;
  setName: (v: string) => void;
  selfId: string | null;
  existingHandle: string | null;
  photoUrl: string | null;
  avatarSeed: number;
  onShuffle: () => void;
  onContinue: () => void;
}): React.ReactElement {
  const normalized = normalizeHandle(name);
  const [status, setStatus] = useState<HandleStatus>("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const shake = useRef(new Animated.Value(0)).current;

  // Debounced 400ms real-time availability check against profiles.handle.
  useEffect(() => {
    let cancelled = false;
    if (normalized.length === 0) {
      setStatus("idle");
      setSuggestions([]);
      return;
    }
    if (normalized.length < 3) {
      setStatus("short");
      setSuggestions([]);
      return;
    }
    if (existingHandle && normalized === existingHandle) {
      setStatus("available");
      setSuggestions([]);
      return;
    }
    setStatus("checking");
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const taken = await isHandleTaken(normalized, selfId);
          if (cancelled) return;
          if (taken) {
            setStatus("taken");
            haptic("medium");
            shake.setValue(0);
            Animated.sequence([
              Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
              Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
              Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
              Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
            ]).start();
            try {
              const free = await findFreeSuggestions(normalized, selfId);
              if (!cancelled) setSuggestions(free);
            } catch {
              if (!cancelled) setSuggestions([]);
            }
          } else {
            setStatus("available");
            setSuggestions([]);
          }
        } catch {
          if (!cancelled) {
            setStatus("error");
            setSuggestions([]);
          }
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalized, selfId, existingHandle, shake]);

  return (
    <View style={{ flex: 1, marginTop: 28 }}>
      <Text style={styles.kicker}>Your POVMe identity</Text>
      <Text style={styles.formTitle}>Claim your handle.</Text>
      <Text style={styles.formBody}>
        This is the name that shows in live chat, tips, and DMs. You can change it
        anytime in Settings.
      </Text>

      {/* Auto-avatar + shuffle */}
      <View style={styles.avatarRow}>
        <AutoAvatar name={name} seed={avatarSeed} photoUrl={photoUrl} size={64} />
        <PressableScale onPress={onShuffle} scaleTo={0.9} hapticStyle="light">
          <View style={styles.diceBtn}>
            <Dices size={17} color={Colors.text} />
          </View>
        </PressableScale>
        <Text style={styles.avatarHint}>
          {photoUrl ? "Shuffle your look — or keep your photo." : "Shuffle your look. It updates as you type."}
        </Text>
      </View>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your name or handle"
        placeholderTextColor={Colors.textDim}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
        maxLength={24}
        autoFocus
      />

      {/* Real-time availability state */}
      <Animated.View
        style={[
          styles.handleStatusRow,
          { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) }] },
        ]}
      >
        {status === "idle" ? (
          <Text style={styles.handleHint}>Short and sharp — this becomes your @handle.</Text>
        ) : null}
        {status === "short" ? (
          <Text style={styles.handleHint}>Keep going — 3+ characters.</Text>
        ) : null}
        {status === "checking" ? (
          <>
            <ActivityIndicator size="small" color={Colors.textMid} />
            <Text style={styles.handleChecking}>Checking @{normalized}…</Text>
          </>
        ) : null}
        {status === "available" ? (
          <>
            <View style={[styles.statusDot, { backgroundColor: "rgba(204,255,0,0.15)" }]}>
              <Check size={12} color={Colors.lime} />
            </View>
            <Text style={styles.handleAvailable}>@{normalized} is yours</Text>
          </>
        ) : null}
        {status === "taken" ? (
          <>
            <View style={[styles.statusDot, { backgroundColor: "rgba(255,45,111,0.15)" }]}>
              <X size={12} color={Colors.magenta} />
            </View>
            <Text style={styles.handleTaken}>@{normalized} is taken. These aren&apos;t:</Text>
          </>
        ) : null}
        {status === "error" ? (
          <Text style={styles.handleHint}>Can&apos;t check right now — we&apos;ll sort it at the end.</Text>
        ) : null}
      </Animated.View>

      {status === "taken" && suggestions.length > 0 ? (
        <View style={styles.suggestionRow}>
          {suggestions.map((s) => (
            <PressableScale key={s} onPress={() => setName(s)} scaleTo={0.93} hapticStyle="light">
              <View style={styles.suggestionChip}>
                <Text style={styles.suggestionText}>@{s}</Text>
              </View>
            </PressableScale>
          ))}
        </View>
      ) : null}

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

/** Deterministic duotone auto-avatar — photo (when available) or gradient + initials. */
function AutoAvatar({
  name,
  seed,
  photoUrl,
  size = 64,
}: {
  name: string;
  seed: number;
  photoUrl: string | null;
  size?: number;
}): React.ReactElement {
  const { usePhoto, paletteIndex } = avatarOptionForSeed(seed, !!photoUrl);
  if (usePhoto && photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.surfaceHi }}
        contentFit="cover"
      />
    );
  }
  const palette = AVATAR_PALETTES[paletteIndex % AVATAR_PALETTES.length];
  return (
    <LinearGradient
      colors={[palette.from, palette.to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: palette.fg,
          fontSize: size * 0.32,
          fontWeight: "900",
          letterSpacing: -0.5,
        }}
      >
        {initialsFor(name)}
      </Text>
    </LinearGradient>
  );
}

/* ------------------------------- Step 3: Taste ----------------------------- */

function TasteStep({
  picked,
  toggle,
  onContinue,
}: {
  picked: PovCategory[];
  toggle: (id: PovCategory) => void;
  onContinue: () => void;
}): React.ReactElement {
  const enough = picked.length >= 3;
  return (
    <View style={{ flex: 1, marginTop: 28 }}>
      <Text style={styles.kicker}>Your taste</Text>
      <Text style={styles.formTitle}>Whose life do you want to live?</Text>
      <Text style={styles.formBody}>
        Pick a few. We&apos;ll shape your Discover feed around them — change it anytime.
      </Text>
      <View style={styles.chipWrap}>
        {CATEGORIES.map((c) => (
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
      <View style={styles.nudgeRow}>
        <Sparkles size={13} color={enough ? Colors.lime : Colors.textDim} />
        <Text style={[styles.nudgeText, enough && { color: Colors.lime }]}>
          {enough
            ? "Great mix — your feed will be sharp."
            : `Pick ${3 - picked.length} more for the best feed.`}
        </Text>
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

/* --------------------------- Step 4: Follow creators ----------------------- */

function FollowStep({
  creators,
  followed,
  toggle,
  allFollowed,
  onToggleAll,
  onContinue,
}: {
  creators: Creator[];
  followed: string[];
  toggle: (id: string) => void;
  allFollowed: boolean;
  onToggleAll: () => void;
  onContinue: () => void;
}): React.ReactElement {
  return (
    <View style={{ flex: 1, marginTop: 28 }}>
      <Text style={styles.kicker}>Seed your feed</Text>
      <View style={styles.followHeaderRow}>
        <Text style={[styles.formTitle, { flex: 1 }]}>Follow a few creators.</Text>
        {creators.length > 0 ? (
          <PressableScale onPress={onToggleAll} scaleTo={0.94} hapticStyle="light">
            <Text style={styles.followAllLink}>{allFollowed ? "Clear all" : "Follow all"}</Text>
          </PressableScale>
        ) : null}
      </View>
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
                <Avatar uri={c.avatar} size={46} ring={isFollowed} live={c.isLive} />
                <View style={{ flex: 1 }}>
                  <View style={styles.creatorNameRow}>
                    <Text style={styles.creatorName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    {c.verified ? <BadgeCheck size={14} color={Colors.cyan} /> : null}
                    {c.isLive ? <Tag label="LIVE" color="#FFFFFF" bg={Colors.magenta} /> : null}
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

/* ------------------------------- Step 5: Ready ----------------------------- */

function ReadyStep({
  name,
  handlePreview,
  intent,
  pickedCount,
  followedCount,
  finishing,
  onFinish,
}: {
  name: string;
  handlePreview: string;
  intent: OnboardingIntent | null;
  pickedCount: number;
  followedCount: number;
  finishing: boolean;
  onFinish: () => void;
}): React.ReactElement {
  const isCreator = intent === "creator";
  const rowAnims = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    haptic("success");
    Animated.stagger(
      90,
      rowAnims.map((a) =>
        Animated.timing(a, { toValue: 1, duration: 320, useNativeDriver: true }),
      ),
    ).start();
  }, [rowAnims]);

  const rows: { label: string; value: string; accent?: string }[] = [
    {
      label: "Identity",
      value: handlePreview.length >= 3 ? `@${handlePreview}` : "Guest — claim later",
    },
    {
      label: "Path",
      value: isCreator ? "Creator — studio next" : "Viewer",
      accent: isCreator ? Colors.magenta : Colors.text,
    },
    { label: "Taste", value: pickedCount > 0 ? `${pickedCount} categories` : "All" },
    {
      label: "Following",
      value: followedCount > 0 ? `${followedCount} creators` : "Explore later",
    },
    { label: "Wallet", value: "$0.00 — top up to start", accent: Colors.textDim },
  ];

  return (
    <View style={{ flex: 1, marginTop: 28, alignItems: "center" }}>
      <View style={styles.readyIcon}>
        <PartyPopper size={26} color={Colors.lime} />
      </View>
      <Text style={styles.kicker}>&apos;Bout time</Text>
      <Text style={styles.readyTitle}>
        {name.trim().length > 0 ? `Let's go, ${name.trim()}.` : "Let's go."}
      </Text>
      <Text style={styles.formBody}>
        {isCreator ? "Your feed is ready. Your channel is next." : "Your feed is ready."}
      </Text>

      <View style={styles.readySummary}>
        {rows.map((row, i) => (
          <Animated.View
            key={row.label}
            style={{
              opacity: rowAnims[i],
              transform: [
                {
                  translateY: rowAnims[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            }}
          >
            <SummaryRow label={row.label} value={row.value} accent={row.accent} />
          </Animated.View>
        ))}
      </View>

      <Text style={styles.walletNote}>
        {isCreator
          ? "Next: your 2-minute studio setup — identity tag, sub price, payouts. You keep 80%. Full stop."
          : "Add funds to your wallet whenever you're ready to subscribe, unlock, or tip creators. Secure checkout via Stripe."}
      </Text>

      <View style={{ flex: 1 }} />
      <Button
        label={finishing ? "Saving…" : isCreator ? "Set up my channel" : "Enter POVMe"}
        icon={<ArrowRight size={17} color={isCreator ? "#FFFFFF" : Colors.ink} />}
        variant={isCreator ? "live" : "primary"}
        onPress={onFinish}
        disabled={finishing}
      />

      <ConfettiBurst />
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
  // Resume banner
  resumeCard: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: "rgba(19,19,24,0.92)",
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.35)",
  },
  resumeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(204,255,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  resumeTitle: { color: Colors.text, fontSize: 14.5, fontWeight: "800" },
  resumeSub: { color: Colors.textMid, fontSize: 12, fontWeight: "600", marginTop: 2 },
  resumeActions: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 10 },
  resumeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.lime,
    paddingHorizontal: 14,
    height: 32,
    borderRadius: Radius.pill,
  },
  resumeBtnLabel: { color: Colors.ink, fontSize: 12.5, fontWeight: "900" },
  resumeReset: { color: Colors.textDim, fontSize: 12.5, fontWeight: "700" },
  // Form chrome
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
  // Intent step
  intentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 16,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  intentCardActive: { borderColor: Colors.lime, backgroundColor: "rgba(204,255,0,0.06)" },
  intentIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
  },
  intentIconWrapActive: { backgroundColor: Colors.lime },
  intentTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  intentTitle: { color: Colors.text, fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  intentBody: { color: Colors.textMid, fontSize: 12.5, fontWeight: "500", lineHeight: 18, marginTop: 3 },
  intentBadge: {
    backgroundColor: "rgba(255,182,39,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,182,39,0.4)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  intentBadgeText: { ...microLabel, fontSize: 8.5, color: Colors.gold },
  intentRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderHi,
    alignItems: "center",
    justifyContent: "center",
  },
  intentRadioActive: { backgroundColor: Colors.lime, borderColor: Colors.lime },
  exploringLink: {
    color: Colors.textDim,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 18,
    textDecorationLine: "underline",
  },
  // Identity step
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 24 },
  diceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHi,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHint: {
    flex: 1,
    color: Colors.textDim,
    fontSize: 11.5,
    fontWeight: "600",
    lineHeight: 16,
  },
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
    marginTop: 16,
  },
  handleStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    minHeight: 22,
  },
  statusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  handleHint: { color: Colors.textDim, fontSize: 12, fontWeight: "600" },
  handleChecking: { color: Colors.textMid, fontSize: 12.5, fontWeight: "600" },
  handleAvailable: { color: Colors.lime, fontSize: 12.5, fontWeight: "800" },
  handleTaken: { color: Colors.magenta, fontSize: 12.5, fontWeight: "800" },
  suggestionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  suggestionChip: {
    paddingHorizontal: 13,
    height: 34,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(204,255,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionText: { color: Colors.lime, fontSize: 12.5, fontWeight: "800" },
  ageNote: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginTop: 18 },
  ageNoteText: { flex: 1, color: Colors.textDim, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  // Taste step
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 24 },
  nudgeRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 16 },
  nudgeText: { color: Colors.textDim, fontSize: 12.5, fontWeight: "700" },
  // Follow step
  followHeaderRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  followAllLink: { color: Colors.lime, fontSize: 13, fontWeight: "800", marginBottom: 4 },
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
  creatorNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  creatorName: { color: Colors.text, fontSize: 15, fontWeight: "800", flexShrink: 1 },
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
