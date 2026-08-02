import { Apple, ArrowRight, Eye, TriangleAlert } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableScale } from "@/components/ui";
import Colors, { Radius } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";

/**
 * POVMe sign-in — minimal launch screen.
 * Logo, two buttons, legal line. Nothing else.
 */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { isSigningIn, error, signIn, clearError } = useAuth();

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <View style={styles.screen}>
      <View style={styles.glow} pointerEvents="none" />

      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 24,
        }}
      >
        <Animated.View style={{ width: "100%", alignItems: "center", opacity: fade }}>
          {/* Logo */}
          <View style={styles.logoBadge}>
            <Eye size={28} color={Colors.ink} />
          </View>
          <Text style={styles.wordmark}>
            POV<Text style={{ color: Colors.lime }}>ME</Text>
          </Text>
          <Text style={styles.tagline}>Step into someone else&apos;s life</Text>
        </Animated.View>

        <Animated.View style={{ width: "100%", opacity: fade, marginTop: 48, gap: 12 }}>
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
            18+ only. By continuing you accept POVMe&apos;s{" "}
            <Text style={styles.legalLink}>Terms</Text>,{" "}
            <Text style={styles.legalLink}>Privacy</Text>, and{" "}
            <Text style={styles.legalLink}>Guidelines</Text>.
          </Text>
        </Animated.View>
      </View>
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
  glow: {
    position: "absolute",
    top: -60,
    left: -60,
    right: -60,
    height: 200,
    backgroundColor: Colors.lime,
    opacity: 0.06,
    borderRadius: 160,
    pointerEvents: "none",
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  wordmark: {
    color: Colors.text,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -2,
    marginBottom: 6,
  },
  tagline: {
    color: Colors.textDim,
    fontSize: 14,
    fontWeight: "600",
  },
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
    height: 56,
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
    height: 56,
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
    marginTop: 6,
  },
  legalLink: { color: Colors.textMid, textDecorationLine: "underline" },
});
