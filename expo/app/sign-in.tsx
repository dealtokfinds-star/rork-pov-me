import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Apple,
  ArrowRight,
  ChevronRight,
  Eye,
  Shield,
  TriangleAlert,
  UserRound,
} from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableScale } from "@/components/ui";
import { BRAND_IMAGES } from "@/constants/brand";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";
import { useCreators, useStreams } from "@/lib/data";

const AnimatedImage = Animated.createAnimatedComponent(Image);

/**
 * POVMe sign-in — the launch screen.
 *
 * Design language: a cinematic, streaming-platform "press play" hero. The
 * brand's own first-person POV key art bleeds to ink-black behind a slow
 * Ken Burns drift, the wordmark sits in a streaming-style top bar with a
 * pulsing LIVE chip, and real social proof ("N creators live right now")
 * feeds the guest funnel. One decision at a time: Google, Apple, or browse.
 *
 * Studied patterns: Apple TV+ launch (single hero, one decision), Twitch
 * sign-in (social-first, live proof up front), Patreon (creator-led
 * imagery), Spotify (bold wordmark above the fold). POVMe adds the "step
 * into someone else's life" promise that no other streaming app can claim.
 */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isSigningIn, error, signIn, clearError, continueAsGuest } = useAuth();

  // Real social proof: who's on air right now.
  const { data: creators = [] } = useCreators();
  const { data: streams = [] } = useStreams();
  const liveCreators = creators.filter((c) => c.isLive && c.avatar).slice(0, 4);
  const liveCount = streams.length;

  // Once a real session lands (OAuth completes), move into the app.
  useEffect(() => {
    if (user) {
      router.replace("/(tabs)");
    }
  }, [user, router]);

  const handleGuest = (): void => {
    continueAsGuest();
    router.replace("/(tabs)/live");
  };

  // Entrance: the wordmark + CTAs rise in after the image lands.
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  const translateY = fade.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  // Ken Burns drift — the hero breathes without ever calling attention to itself.
  const heroZoom = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroZoom, {
          toValue: 1.09,
          duration: 14000,
          useNativeDriver: true,
        }),
        Animated.timing(heroZoom, {
          toValue: 1,
          duration: 14000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [heroZoom]);

  // Pulsing dot for the LIVE chip + live-proof pill.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.screen}>
      {/* Hero — the brand's own POV still, slowly breathing. */}
      <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
        <AnimatedImage
          source={{ uri: BRAND_IMAGES.signInHero }}
          style={[StyleSheet.absoluteFill, { transform: [{ scale: heroZoom }] }]}
          contentFit="cover"
        />
      </View>
      <LinearGradient
        colors={["rgba(8,8,10,0.5)", "rgba(8,8,10,0.35)", "rgba(8,8,10,0.88)", Colors.ink]}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Acid-lime ambient glow at the top — the POVMe signature. */}
      <View style={styles.ambientGlow} pointerEvents="none" />

      {/* Top bar: wordmark + live chip, like a streaming app header. */}
      <Animated.View style={[styles.topBar, { paddingTop: insets.top + 14, opacity: fade }]}>
        <View style={styles.brandRow}>
          <View style={styles.iconBadge}>
            <Eye size={17} color={Colors.ink} />
          </View>
          <Text style={styles.wordmark}>
            POV<Text style={{ color: Colors.lime }}>ME</Text>
          </Text>
        </View>
        <View style={styles.liveBadge}>
          <Animated.View style={[styles.liveBadgeDot, { opacity: pulse }]} />
          <Text style={styles.liveBadgeLabel}>LIVE</Text>
        </View>
      </Animated.View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "flex-end",
          paddingTop: insets.top + 110,
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 22,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY }] }}>
          <View>
            <Text style={styles.kicker}>Step inside someone else&apos;s life</Text>
            <Text style={styles.title}>
              Don&apos;t watch their day.{"\n"}Wear it.
            </Text>
            <Text style={styles.body}>
              Subscribe to creators, unlock POV episodes, tip in live chats, and
              broadcast your own life from a body cam.
            </Text>

            {/* Trust strip — the three things POVMe promises. */}
            <View style={styles.trustRow}>
              <TrustChip icon={<Eye size={12} color={Colors.lime} />} label="First-person" />
              <TrustChip icon={<Shield size={12} color={Colors.cyan} />} label="18+ only" />
              <TrustChip icon={<ChevronRight size={12} color={Colors.magenta} />} label="Cancel anytime" />
            </View>
          </View>

          <View style={{ gap: 14, marginTop: 30 }}>
            {/* Live proof — real streams, real avatars, one tap in as guest. */}
            {liveCount > 0 ? (
              <PressableScale onPress={handleGuest} scaleTo={0.97} hapticStyle="light">
                <View style={styles.livePill}>
                  <View style={styles.liveStack}>
                    {liveCreators.map((c, i) => (
                      <Image
                        key={c.id}
                        source={{ uri: c.avatar }}
                        style={[styles.liveAvatar, { marginLeft: i === 0 ? 0 : -9 }]}
                        contentFit="cover"
                      />
                    ))}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.livePillTitle}>
                      {liveCount} creator{liveCount === 1 ? "" : "s"} live right now
                    </Text>
                    <Text style={styles.livePillSub}>Watch free as a guest</Text>
                  </View>
                  <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
                </View>
              </PressableScale>
            ) : null}

            {error ? (
              <View style={styles.errorCard}>
                <TriangleAlert size={16} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={clearError} hitSlop={10}>
                  <Text style={styles.errorDismiss}>Dismiss</Text>
                </Pressable>
              </View>
            ) : null}

            {isSigningIn ? (
              <View style={styles.signingInCard}>
                <ActivityIndicator color={Colors.lime} />
                <Text style={styles.signingInText}>Opening sign in…</Text>
              </View>
            ) : null}

            {/* Google — primary, full-width. */}
            <PressableScale
              onPress={() => void signIn("google")}
              disabled={isSigningIn}
              scaleTo={0.97}
              hapticStyle="medium"
            >
              <View style={styles.googleButton}>
                <GoogleGlyph />
                <Text style={styles.googleLabel}>Continue with Google</Text>
                <ArrowRight size={18} color={Colors.text} />
              </View>
            </PressableScale>

            {/* Apple — iOS only, secondary. */}
            {Platform.OS === "ios" ? (
              <PressableScale
                onPress={() => void signIn("apple")}
                disabled={isSigningIn}
                scaleTo={0.97}
                hapticStyle="medium"
              >
                <View style={styles.appleButton}>
                  <Apple size={20} color="#fff" />
                  <Text style={styles.appleLabel}>Continue with Apple</Text>
                </View>
              </PressableScale>
            ) : null}

            {/* Guest path — browse the live feed without an account. */}
            <PressableScale
              onPress={handleGuest}
              disabled={isSigningIn}
              scaleTo={0.97}
              hapticStyle="light"
            >
              <View style={styles.guestButton}>
                <UserRound size={16} color={Colors.textMid} />
                <Text style={styles.guestLabel}>Continue as guest</Text>
                <ChevronRight size={16} color={Colors.textDim} />
              </View>
            </PressableScale>
            <Text style={styles.guestHint}>
              Browse the live feed first — create an account whenever you&apos;re ready.
            </Text>

            <Text style={styles.legal}>
              By continuing you confirm you&apos;re 18+ and accept POVMe&apos;s{" "}
              <Text style={styles.legalLink}>Terms</Text>,{" "}
              <Text style={styles.legalLink}>Privacy Policy</Text>, and{" "}
              <Text style={styles.legalLink}>Content Guidelines</Text>.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function TrustChip({ icon, label }: { icon: React.ReactNode; label: string }): React.ReactElement {
  return (
    <View style={styles.trustChip}>
      {icon}
      <Text style={styles.trustLabel}>{label}</Text>
    </View>
  );
}

function GoogleGlyph(): React.ReactElement {
  return (
    <View style={styles.googleGlyph}>
      <Text style={styles.googleGlyphText}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingBottom: 10,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.lime,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  wordmark: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(255,45,111,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,45,111,0.45)",
  },
  liveBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.magenta },
  liveBadgeLabel: {
    color: Colors.magenta,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  ambientGlow: {
    position: "absolute",
    top: -120,
    left: -80,
    right: -80,
    height: 320,
    backgroundColor: Colors.lime,
    opacity: 0.08,
    borderRadius: 200,
    pointerEvents: "none",
  },
  kicker: { ...microLabel, color: Colors.lime, marginBottom: 14, fontSize: 11 },
  title: {
    color: Colors.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    lineHeight: 41,
    marginBottom: 14,
  },
  body: {
    color: Colors.textMid,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
  },
  trustRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 22,
  },
  trustChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  trustLabel: { color: Colors.textMid, fontSize: 11, fontWeight: "700" },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: "rgba(19,19,24,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  liveStack: { flexDirection: "row", alignItems: "center" },
  liveAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: Colors.ink,
    backgroundColor: Colors.surfaceHi,
  },
  livePillTitle: { color: Colors.text, fontSize: 13.5, fontWeight: "800" },
  livePillSub: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 1 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.magenta },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,77,77,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.35)",
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: { flex: 1, color: Colors.danger, fontSize: 13, fontWeight: "600" },
  errorDismiss: { color: Colors.danger, fontSize: 12, fontWeight: "800" },
  signingInCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  signingInText: { color: Colors.textMid, fontSize: 13, fontWeight: "600" },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 58,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.borderHi,
    paddingHorizontal: 20,
  },
  googleGlyph: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  googleGlyphText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#4285F4",
  },
  googleLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  appleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 58,
    borderRadius: Radius.pill,
    backgroundColor: "#000",
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  appleLabel: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "800" },
  guestButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 50,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 20,
  },
  guestLabel: { flex: 1, color: Colors.textMid, fontSize: 14.5, fontWeight: "700" },
  guestHint: {
    color: Colors.textDim,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: -4,
  },
  legal: {
    color: Colors.textDim,
    fontSize: 11.5,
    fontWeight: "600",
    lineHeight: 17,
    textAlign: "center",
    marginTop: 8,
  },
  legalLink: { color: Colors.textMid, textDecorationLine: "underline" },
});
