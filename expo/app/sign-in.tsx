import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Apple, ArrowRight, ChevronRight, Eye, Shield, TriangleAlert } from "lucide-react-native";
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
import Colors, { Radius, microLabel } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";

/**
 * POVMe sign-in — the launch screen.
 *
 * Design language: a cinematic, streaming-platform "press play" hero. Ink-black
 * base, a single atmospheric image bleeding to black, the wordmark as the hero,
 * and two social sign-in CTAs (Google + Apple). The 18+ gate is explicit and
 * part of the copy, not buried in fine print.
 *
 * Studied patterns: Apple TV+ launch (single hero, one decision), Twitch sign-in
 * (social-first, no email wall), Patreon (creator-led imagery), Spotify (bold
 * wordmark above the fold). POVMe adds the "step into someone else's life" POV
 * promise that no other streaming app can claim.
 */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { isSigningIn, error, signIn, clearError } = useAuth();

  // Subtle entrance: the wordmark + CTAs rise in after the image lands.
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  const translateY = fade.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  return (
    <View style={styles.screen}>
      {/* Atmospheric hero image — a first-person POV suggestion. */}
      <Image
        source={{
          uri: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
        }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={Platform.OS === "web" ? 0 : 8}
      />
      <LinearGradient
        colors={["rgba(8,8,10,0.45)", "rgba(8,8,10,0.78)", Colors.ink]}
        locations={[0, 0.55, 0.95]}
        style={StyleSheet.absoluteFill}
      />
      {/* Acid-lime ambient glow at the top — the POVMe signature. */}
      <View style={styles.ambientGlow} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 48,
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 22,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{ flex: 1, justifyContent: "space-between", opacity: fade, transform: [{ translateY }] }}
        >
          <View>
            <View style={styles.iconBadge}>
              <Eye size={24} color={Colors.ink} />
            </View>
            <Text style={styles.wordmark}>
              POV<Text style={{ color: Colors.lime }}>ME</Text>
            </Text>
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

          <View style={{ gap: 14 }}>
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
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    shadowColor: Colors.lime,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  wordmark: {
    color: Colors.text,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -2,
    marginBottom: 12,
  },
  kicker: { ...microLabel, color: Colors.lime, marginBottom: 18, fontSize: 11 },
  title: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1.2,
    lineHeight: 38,
    marginBottom: 16,
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
