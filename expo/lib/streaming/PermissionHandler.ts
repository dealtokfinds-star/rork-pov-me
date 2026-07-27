/**
 * PermissionHandler
 * ---------------
 * Utility for requesting and verifying camera + microphone permissions
 * required to host a live POV stream. Built on `expo-camera`'s permission
 * hooks/imperative API so it works the same on iOS, Android, and web.
 *
 * Why a dedicated module:
 *  - One place that knows the full "can I go live?" matrix (camera AND mic).
 *  - Surfaces a typed status enum the UI can switch on without re-deriving.
 *  - Handles the "granted but device has no camera" edge case (simulator / web).
 *  - Exposes a `useStreamingPermissions` hook for screens and an imperative
 *    `ensureStreamingPermissions` for non-React callers (services, deep links).
 */

import { useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { useEffect, useState } from "react";

/** Coarse status for the combined camera+mic gate. */
export type PermissionStatus =
  | "undetermined" // Never asked yet
  | "prompting" // System prompt is on screen
  | "granted" // Both camera + mic granted
  | "partial" // Only one of the two granted
  | "denied" // At least one hard-denied (must open Settings)
  | "unavailable"; // No camera on this device (simulator / web w/o cam)

export interface PermissionState {
  status: PermissionStatus;
  camera: "undetermined" | "granted" | "denied";
  microphone: "undetermined" | "granted" | "denied";
  /** True only when both are granted AND a camera exists. */
  canStream: boolean;
  /** Human-readable explanation for the UI. */
  message: string;
}

/** Reason a request failed — used for analytics / actionable UI. */
export type PermissionFailureReason =
  | "camera_denied"
  | "mic_denied"
  | "both_denied"
  | "no_camera"
  | "unknown";

export interface EnsureResult {
  ok: boolean;
  status: PermissionStatus;
  reason?: PermissionFailureReason;
}

const NO_CAMERA_MESSAGE =
  "No camera was found on this device. POVMe live works on physical phones and most browsers.";
const BOTH_DENIED_MESSAGE =
  "Camera and microphone access were blocked. Enable them in Settings to go live.";
const CAMERA_DENIED_MESSAGE =
  "Camera access is blocked. Enable it in Settings to broadcast your POV.";
const MIC_DENIED_MESSAGE =
  "Microphone access is blocked. Enable it in Settings so viewers can hear your POV.";
const PARTIAL_MESSAGE =
  "You're missing one permission. Live streams need both camera and microphone.";

/**
 * Map a raw `expo-camera` permission response to a coarse tri-state.
 * `expo-camera` returns `status: "granted" | "denied" | "undetermined"` plus
 * `canAskAgain`. If the user hard-denies we treat it as `denied` even when
 * `canAskAgain` is true (UI should still show a "open settings" path).
 */
function toTriState(
  granted: boolean | undefined,
  canAskAgain: boolean | undefined,
): "undetermined" | "granted" | "denied" {
  if (granted) return "granted";
  if (canAskAgain === false) return "denied";
  // canAskAgain true + not granted → still undetermined from user POV
  return "denied";
}

/**
 * Imperative one-shot: request both permissions if not already granted.
 * Use from non-React code (deep-link handlers, services) or inside effects.
 * Does NOT throw — returns a typed result so callers can branch cleanly.
 *
 * @param requestCamera Camera permission requestor (from `useCameraPermissions`)
 * @param requestMic    Microphone permission requestor (from `useMicrophonePermissions`)
 * @param cameraGranted Current camera granted flag
 * @param micGranted    Current mic granted flag
 */
export async function ensureStreamingPermissions(params: {
  requestCamera: () => Promise<{ granted: boolean; canAskAgain?: boolean }>;
  requestMic: () => Promise<{ granted: boolean; canAskAgain?: boolean }>;
  cameraGranted: boolean;
  micGranted: boolean;
  hasCamera: boolean;
}): Promise<EnsureResult> {
  const { requestCamera, requestMic, cameraGranted, micGranted, hasCamera } =
    params;

  if (!hasCamera) {
    return { ok: false, status: "unavailable", reason: "no_camera" };
  }

  let cam = cameraGranted;
  let mic = micGranted;

  if (!cam) {
    try {
      const r = await requestCamera();
      cam = r.granted;
    } catch (err) {
      console.log("[povme] camera permission request threw", err);
      return { ok: false, status: "denied", reason: "camera_denied" };
    }
  }
  if (!mic) {
    try {
      const r = await requestMic();
      mic = r.granted;
    } catch (err) {
      console.log("[povme] mic permission request threw", err);
      return { ok: false, status: "denied", reason: "mic_denied" };
    }
  }

  if (cam && mic) return { ok: true, status: "granted" };
  if (!cam && !mic) {
    return { ok: false, status: "denied", reason: "both_denied" };
  }
  return {
    ok: false,
    status: "partial",
    reason: !cam ? "camera_denied" : "mic_denied",
  };
}

/**
 * Derive the combined `PermissionState` from raw camera + mic permission
 * responses. Pure function — safe to call outside React.
 */
export function derivePermissionState(params: {
  camera: { granted: boolean; canAskAgain?: boolean } | null;
  microphone: { granted: boolean; canAskAgain?: boolean } | null;
  hasCamera: boolean;
}): PermissionState {
  const { camera, microphone, hasCamera } = params;

  if (!hasCamera) {
    return {
      status: "unavailable",
      camera: "undetermined",
      microphone: "undetermined",
      canStream: false,
      message: NO_CAMERA_MESSAGE,
    };
  }

  // While the system prompt is up, expo-camera returns null briefly.
  if (camera === null || microphone === null) {
    return {
      status: "prompting",
      camera: "undetermined",
      microphone: "undetermined",
      canStream: false,
      message: "Waiting for permission response…",
    };
  }

  const cam = toTriState(camera.granted, camera.canAskAgain);
  const mic = toTriState(microphone.granted, microphone.canAskAgain);

  if (cam === "granted" && mic === "granted") {
    return {
      status: "granted",
      camera: cam,
      microphone: mic,
      canStream: true,
      message: "Camera and microphone ready.",
    };
  }

  if (cam === "denied" && mic === "denied") {
    return {
      status: "denied",
      camera: cam,
      microphone: mic,
      canStream: false,
      message: BOTH_DENIED_MESSAGE,
    };
  }
  if (cam === "denied") {
    return {
      status: "denied",
      camera: cam,
      microphone: mic,
      canStream: false,
      message: CAMERA_DENIED_MESSAGE,
    };
  }
  if (mic === "denied") {
    return {
      status: "denied",
      camera: cam,
      microphone: mic,
      canStream: false,
      message: MIC_DENIED_MESSAGE,
    };
  }

  // Both undetermined or one granted + one undetermined
  const partial = cam === "granted" || mic === "granted";
  return {
    status: partial ? "partial" : "undetermined",
    camera: cam,
    microphone: mic,
    canStream: false,
    message: partial ? PARTIAL_MESSAGE : "Allow camera and microphone to go live.",
  };
}

/**
 * React hook: live, reactive permission state for streaming.
 * Returns the derived state plus the raw expo-camera requestors so screens
 * can drive the "Allow" button without re-instancing hooks themselves.
 *
 * @example
 * const { state, request, retry } = useStreamingPermissions();
 * if (state.status === "denied") return <OpenSettings />;
 */
export function useStreamingPermissions(hasCamera = true): {
  state: PermissionState;
  request: () => Promise<EnsureResult>;
  retry: () => Promise<EnsureResult>;
  /** Raw expo-camera request functions (already bound). */
  requestCamera: () => Promise<unknown>;
  requestMic: () => Promise<unknown>;
} {
  const [cameraPerm, requestCamera] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const [asking, setAsking] = useState<boolean>(false);

  const state = derivePermissionState({
    camera: asking ? cameraPerm : cameraPerm,
    microphone: asking ? micPerm : micPerm,
    hasCamera,
  });

  // Detect when the system prompt closes.
  useEffect(() => {
    if (asking && cameraPerm !== null && micPerm !== null) {
      setAsking(false);
    }
  }, [asking, cameraPerm, micPerm]);

  const request = async (): Promise<EnsureResult> => {
    setAsking(true);
    const result = await ensureStreamingPermissions({
      requestCamera: requestCamera as unknown as () => Promise<{
        granted: boolean;
        canAskAgain?: boolean;
      }>,
      requestMic: requestMic as unknown as () => Promise<{
        granted: boolean;
        canAskAgain?: boolean;
      }>,
      cameraGranted: cameraPerm?.granted ?? false,
      micGranted: micPerm?.granted ?? false,
      hasCamera,
    });
    setAsking(false);
    return result;
  };

  // `retry` is identical to `request` but is exposed as a separate verb so
  // UI intent is explicit ("user tapped retry" vs "first prompt").
  const retry = request;

  return {
    state,
    request,
    retry,
    requestCamera: requestCamera as unknown as () => Promise<unknown>,
    requestMic: requestMic as unknown as () => Promise<unknown>,
  };
}
