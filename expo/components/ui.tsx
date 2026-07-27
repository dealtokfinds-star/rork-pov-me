import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import Colors, { Radius, microLabel } from "@/constants/colors";

export function haptic(style: "light" | "medium" | "heavy" | "success" = "light"): void {
  if (Platform.OS === "web") return;
  if (style === "success") {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return;
  }
  const map = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
  } as const;
  Haptics.impactAsync(map[style]).catch(() => {});
}

interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  scaleTo?: number;
  hapticStyle?: "light" | "medium" | "heavy" | "success";
  testID?: string;
}

/** Pressable with a spring scale + haptic micro-interaction. */
export function PressableScale({
  children,
  onPress,
  style,
  disabled,
  scaleTo = 0.96,
  hapticStyle = "light",
  testID,
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (to: number): void => {
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPressIn={() => animate(scaleTo)}
      onPressOut={() => animate(1)}
      onPress={() => {
        if (disabled) return;
        haptic(hapticStyle);
        onPress?.();
      }}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.45 : 1 }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "live" | "ppv" | "ghost" | "dark";
  icon?: React.ReactNode;
  disabled?: boolean;
  full?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  full = true,
  small,
  style,
  testID,
}: ButtonProps) {
  const gradients: Record<string, readonly [string, string]> = {
    primary: [Colors.lime, "#A6E000"],
    live: [Colors.magenta, "#D3005A"],
    ppv: [Colors.cyan, "#00A9CC"],
    ghost: ["transparent", "transparent"],
    dark: [Colors.surfaceHi, Colors.surface],
  };
  const textColor =
    variant === "primary" || variant === "ppv" ? Colors.ink : variant === "live" ? "#FFFFFF" : Colors.text;

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hapticStyle="medium"
      style={[full ? styles.btnFull : undefined, style]}
    >
      <LinearGradient
        colors={gradients[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.btn,
          small && styles.btnSmall,
          variant === "ghost" && styles.btnGhost,
          full && styles.btnFull,
        ]}
      >
        {icon}
        <Text style={[styles.btnLabel, small && styles.btnLabelSmall, { color: textColor }]}>
          {label}
        </Text>
      </LinearGradient>
    </PressableScale>
  );
}

export function Chip({
  label,
  active,
  onPress,
  accent = Colors.lime,
  emoji,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  accent?: string;
  emoji?: string;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.93}>
      <View
        style={[
          styles.chip,
          active && { backgroundColor: accent, borderColor: accent },
        ]}
      >
        {emoji ? <Text style={styles.chipEmoji}>{emoji}</Text> : null}
        <Text style={[styles.chipLabel, active && { color: Colors.ink }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

export function Tag({
  label,
  color = Colors.textMid,
  bg = "rgba(255,255,255,0.07)",
  icon,
}: {
  label: string;
  color?: string;
  bg?: string;
  icon?: React.ReactNode;
}) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      {icon}
      <Text style={[styles.tagLabel, { color }]}>{label}</Text>
    </View>
  );
}

export function LiveDot({ size = 7 }: { size?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: "#fff",
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
      }}
    />
  );
}

export function LiveBadge({ viewers }: { viewers?: number }) {
  return (
    <View style={styles.liveBadge}>
      <LiveDot />
      <Text style={styles.liveBadgeText}>LIVE</Text>
      {viewers !== undefined ? (
        <Text style={styles.liveBadgeCount}>
          {viewers >= 1000 ? `${(viewers / 1000).toFixed(1)}K` : viewers}
        </Text>
      ) : null}
    </View>
  );
}

export function Avatar({
  uri,
  size = 44,
  ring,
  live,
}: {
  uri: string;
  size?: number;
  ring?: boolean;
  live?: boolean;
}) {
  const border = live ? Colors.magenta : Colors.lime;
  return (
    <View
      style={{
        width: size + (ring ? 5 : 0),
        height: size + (ring ? 5 : 0),
        borderRadius: (size + 6) / 2,
        borderWidth: ring ? 2 : 0,
        borderColor: border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.surfaceHi }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: Colors.surfaceHi,
            alignItems: "center",
            justifyContent: "center",
          }}
        />
      )}
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
  kicker,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  kicker?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action ? (
        <PressableScale onPress={onAction} scaleTo={0.94}>
          <Text style={styles.sectionAction}>{action}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

export function StatTile({
  label,
  value,
  sub,
  accent = Colors.lime,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statLabel, { color: accent }]}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

export function ProgressBar({ progress, color = Colors.lime }: { progress: number; color?: string }) {
  const width = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(width, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [progress, width]);

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            backgroundColor: color,
            width: width.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
          },
        ]}
      />
    </View>
  );
}

export function EmptyState({
  title,
  body,
  icon,
  action,
  onAction,
}: {
  title: string;
  body: string;
  icon?: React.ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>{icon}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action ? (
        <Button label={action} onPress={onAction} full={false} small style={{ marginTop: 18 }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btnFull: { width: "100%" },
  btn: {
    height: 54,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 26,
  },
  btnSmall: { height: 42, paddingHorizontal: 18 },
  btnGhost: { borderWidth: 1, borderColor: Colors.borderHi },
  btnLabel: { fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },
  btnLabelSmall: { fontSize: 14, fontWeight: "800" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipEmoji: { fontSize: 13 },
  chipLabel: { color: Colors.textMid, fontSize: 13, fontWeight: "700" },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagLabel: { ...microLabel, fontSize: 9.5 },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.magenta,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  liveBadgeText: { color: "#fff", ...microLabel, fontSize: 10 },
  liveBadgeCount: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 18,
    marginTop: 26,
    marginBottom: 14,
    gap: 12,
  },
  kicker: { ...microLabel, color: Colors.lime, marginBottom: 5 },
  sectionTitle: { color: Colors.text, fontSize: 21, fontWeight: "800", letterSpacing: -0.4 },
  sectionAction: { color: Colors.textMid, fontSize: 13, fontWeight: "700" },
  divider: { height: 1, backgroundColor: Colors.border },
  statTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statLabel: { ...microLabel, marginBottom: 8 },
  statValue: { color: Colors.text, fontSize: 20, fontWeight: "900", letterSpacing: -0.6 },
  statSub: { color: Colors.textDim, fontSize: 11, fontWeight: "600", marginTop: 3 },
  progressTrack: {
    height: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.09)",
    overflow: "hidden",
  },
  progressFill: { height: 6, borderRadius: 6 },
  empty: { alignItems: "center", paddingHorizontal: 42, paddingVertical: 54 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: "800", marginBottom: 7 },
  emptyBody: {
    color: Colors.textDim,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    fontWeight: "500",
  },
});
