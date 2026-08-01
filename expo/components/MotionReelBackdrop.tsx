import { useEvent } from "expo";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";

/**
 * Generated onboarding motion reel — a 9:16 dark-mode streaming-UI motion
 * graphics loop (ambient lime/cyan/magenta glow, floating glass cards, HUD
 * micro-interactions). Served from the Rork asset CDN.
 */
export const MOTION_REEL_URI =
  "https://rork.app/pa/jumcslg74gkl9qcqw77bz/streaming_app_ui_reel";

type MotionReelBackdropProps = {
  /** Static frame shown instantly, kept as the fallback for reduce-motion and load errors. */
  posterUri: string;
  /** Optional blur applied to the poster only (the reel is designed to run sharp). */
  posterBlurRadius?: number;
};

/**
 * Full-bleed ambient video backdrop for hero/onboarding screens.
 *
 * Behavior:
 *  - Poster image renders immediately; the reel crossfades in on first frame.
 *  - Muted, looping, autoplay — no controls, no touch interception.
 *  - Respects the system reduce-motion setting (poster only, player paused).
 *  - On playback error the poster simply stays — no broken state visible.
 */
export default function MotionReelBackdrop({
  posterUri,
  posterBlurRadius = 0,
}: MotionReelBackdropProps): React.ReactElement {
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const player = useVideoPlayer(MOTION_REEL_URI, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // Pause instead of unmounting when reduce-motion flips on, so flipping it
  // back off resumes instantly without re-buffering.
  useEffect(() => {
    try {
      if (reduceMotion) {
        player.pause();
      } else {
        player.play();
      }
    } catch {
      // Player may already be released during teardown — poster remains.
    }
  }, [reduceMotion, player]);

  const { status } = useEvent(player, "statusChange", { status: player.status });
  const showVideo = status === "readyToPlay" && !reduceMotion;

  const videoOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(videoOpacity, {
      toValue: showVideo ? 1 : 0,
      duration: 650,
      useNativeDriver: true,
    }).start();
  }, [showVideo, videoOpacity]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={{ uri: posterUri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={posterBlurRadius}
      />
      {!reduceMotion ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: videoOpacity }]}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
