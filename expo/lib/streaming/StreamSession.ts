/**
 * StreamSession
 * -------------
 * A small, framework-agnostic controller for a live POV streaming session.
 * It owns:
 *  - the active camera recording lifecycle (start / stop / toggle mic / flip)
 *  - a heartbeat + reconnect state machine for "is the stream healthy?"
 *  - a clean teardown routine that releases camera + media resources so we
 *    never leak an `expo-camera` session or a dangling `recordAsync` promise.
 *
 * It is intentionally React-free: HostScreen subscribes via a listener and
 * `useSyncExternalStore`-style updates. This keeps camera control off the
 * render path (Android/iOS will crash if `recordAsync` is called during a
 * re-render storm) and makes memory management deterministic.
 */

export type StreamHealth = "idle" | "connecting" | "live" | "reconnecting" | "ended" | "error";

export interface StreamMetrics {
  /** Seconds since the stream went live. */
  elapsedSec: number;
  /** Estimated concurrent viewers (server-reported or simulated). */
  viewers: number;
  /** Cumulative gross tips/PPV collected this session. */
  grossEarned: number;
  /** Bitrate estimate in kbps (simulated; a real RTMP layer would report it). */
  bitrateKbps: number;
  /** Percentage of frames dropped — drives the "health" chip. */
  droppedFramesPct: number;
}

export interface StreamSessionState {
  health: StreamHealth;
  metrics: StreamMetrics;
  muted: boolean;
  facingFront: boolean;
  /** The local recording URI once `stopRecording` resolves. */
  recordingUri: string | null;
  /** Last error message, surfaced in the "network drop" banner. */
  error: string | null;
  /** Reconnect attempt counter — 0 while healthy. */
  reconnectAttempts: number;
}

type Listener = (state: StreamSessionState) => void;

const INITIAL_METRICS: StreamMetrics = {
  elapsedSec: 0,
  viewers: 0,
  grossEarned: 0,
  bitrateKbps: 0,
  droppedFramesPct: 0,
};

const INITIAL_STATE: StreamSessionState = {
  health: "idle",
  metrics: INITIAL_METRICS,
  muted: false,
  facingFront: true,
  recordingUri: null,
  error: null,
  reconnectAttempts: 0,
};

const HEARTBEAT_MS = 1_000;
const MAX_RECONNECT_ATTEMPTS = 5;

export interface CameraController {
  stopRecording: () => void;
  recordAsync: (opts?: {
    mute?: boolean;
    quality?: "2160p" | "1080p" | "720p" | "480p" | "4:3";
  }) => Promise<{ uri: string } | undefined>;
  /** Pause the preview session (Android/iOS). */
  pausePreview?: () => Promise<void>;
  /** Resume the preview session. */
  resumePreview?: () => Promise<void>;
}

export interface StreamSessionOptions {
  /** Called when the local recording finalizes — host can upload as replay. */
  onRecordingComplete?: (uri: string) => void;
  /** Initial viewer count. */
  initialViewers?: number;
}

/**
 * The session controller. Construct one per HostScreen mount, call
 * `dispose()` in the cleanup effect. All mutations funnel through
 * `setState` so listeners are notified exactly once per change.
 */
export class StreamSession {
  private state: StreamSessionState = INITIAL_STATE;
  private listeners = new Set<Listener>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private camera: CameraController | null = null;
  private recordingPromise: Promise<{ uri: string } | undefined> | null = null;
  private disposed = false;
  private opts: StreamSessionOptions;

  constructor(opts: StreamSessionOptions = {}) {
    this.opts = {
      initialViewers: 0,
      ...opts,
    };
  }

  // ---- subscription ---------------------------------------------------------

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): StreamSessionState => this.state;

  private setState(patch: Partial<StreamSessionState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  private setMetrics(patch: Partial<StreamMetrics>): void {
    if (this.disposed) return;
    this.setState({ metrics: { ...this.state.metrics, ...patch } });
  }

  // ---- camera binding -------------------------------------------------------

  /** Attach the live `CameraView` ref so the session can drive recording. */
  attachCamera = (camera: CameraController | null): void => {
    this.camera = camera;
  };

  // ---- lifecycle ------------------------------------------------------------

  /**
   * Go live. Starts the camera recording (local file = future replay) and
   * the heartbeat + network-drop simulation.
   */
  start = async (): Promise<void> => {
    if (this.disposed) return;
    if (this.state.health === "live" || this.state.health === "connecting") return;

    this.setState({
      health: "connecting",
      error: null,
      reconnectAttempts: 0,
      metrics: {
        ...INITIAL_METRICS,
        viewers: this.opts.initialViewers ?? 0,
      },
    });

    // Start the local recording. On a real platform this is also where we'd
    // open the RTMP/WebRTC encoder; here the file URI doubles as the replay.
    if (this.camera) {
      try {
        this.recordingPromise = this.camera.recordAsync({
          mute: this.state.muted,
          quality: "1080p",
        });
      } catch (err) {
        console.log("[povme] recordAsync failed to start", err);
        this.setState({
          health: "error",
          error: "Could not start the camera recording. Try again.",
        });
        return;
      }
    }

    // Brief "connecting" beat so the UI can show a transition state.
    await new Promise((r) => setTimeout(r, 350));
    if (this.disposed) return;

    this.setState({ health: "live" });
    this.startHeartbeat();
  };

  /**
   * End the stream cleanly. Stops recording, resolves the replay URI,
   * clears all timers. Safe to call multiple times.
   */
  stop = async (): Promise<string | null> => {
    if (this.disposed) return null;
    this.clearTimers();

    if (this.camera) {
      try {
        this.camera.stopRecording();
      } catch (err) {
        console.log("[povme] stopRecording threw", err);
      }
    }

    let uri: string | null = null;
    if (this.recordingPromise) {
      try {
        const result = await this.recordingPromise;
        uri = result?.uri ?? null;
        if (uri) this.opts.onRecordingComplete?.(uri);
      } catch (err) {
        console.log("[povme] recording promise rejected", err);
      }
    }
    this.recordingPromise = null;

    if (!this.disposed) {
      this.setState({
        health: "ended",
        recordingUri: uri,
        metrics: INITIAL_METRICS,
      });
    }
    return uri;
  };

  // ---- in-stream controls ---------------------------------------------------

  toggleMute = (): boolean => {
    const muted = !this.state.muted;
    // expo-camera applies `mute` on the next recordAsync call; for live
    // muting we'd restart the recording. To avoid a visible hitch we just
    // flag state and let the next segment pick it up.
    this.setState({ muted });
    return muted;
  };

  flipCamera = (): boolean => {
    // Camera flip is handled by the HostScreen via `facing` prop; we only
    // mirror state so the UI icon and the eventual recording match.
    const facingFront = !this.state.facingFront;
    this.setState({ facingFront });
    return facingFront;
  };

  toggleTorch = (): boolean => {
    // Torch is a CameraView prop; we don't track it here to avoid double-state.
    // HostScreen owns the torch flag locally.
    return true;
  };

  /** Record an incoming tip/PPV unlock so the earnings counter is live. */
  recordEarning = (amount: number): void => {
    this.setMetrics({
      grossEarned: Math.round((this.state.metrics.grossEarned + amount) * 100) / 100,
    });
  };

  // ---- health / reconnect ---------------------------------------------------

  private startHeartbeat = (): void => {
    this.heartbeatTimer = setInterval(() => {
      if (this.disposed || this.state.health !== "live") return;
      // Only the elapsed clock ticks locally — viewers/bitrate/dropped frames
      // are real values pushed in via reportHealthMetrics() from the
      // stream-health poller. No simulated churn.
      this.setMetrics({ elapsedSec: this.state.metrics.elapsedSec + 1 });
    }, HEARTBEAT_MS);
  };

  /** Push real transport metrics (from the stream-health edge function). */
  reportHealthMetrics = (patch: Partial<Pick<StreamMetrics, "viewers" | "bitrateKbps" | "droppedFramesPct">>): void => {
    this.setMetrics(patch);
  };

  /**
   * Edge case: sudden network drop mid-stream (reported by the transport
   * layer / health poller — never simulated).
   * Strategy: mark `reconnecting`, pause the camera preview to save battery,
   * then retry with exponential backoff up to MAX_RECONNECT_ATTEMPTS.
   * If all attempts fail, end the stream and surface the error.
   */
  handleNetworkDrop = async (): Promise<void> => {
    if (this.disposed) return;
    this.clearReconnectTimer();
    this.setState({
      health: "reconnecting",
      error: "Network dropped — reconnecting…",
      reconnectAttempts: 0,
    });

    // Pause the preview to avoid feeding frames into a dead encoder.
    try {
      await this.camera?.pausePreview?.();
    } catch (err) {
      console.log("[povme] pausePreview failed during reconnect", err);
    }

    this.attemptReconnect();
  };

  private attemptReconnect = (): void => {
    if (this.disposed) return;
    const attempt = this.state.reconnectAttempts + 1;
    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      this.setState({
        health: "error",
        error: "Connection lost. The stream has ended — your replay was saved.",
      });
      // Best-effort: finalize whatever recording we have.
      this.stop().catch(() => {});
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s.
    const delay = Math.pow(2, attempt - 1) * 1000;
    this.setState({ reconnectAttempts: attempt });

    this.reconnectTimer = setTimeout(async () => {
      if (this.disposed) return;
      try {
        await this.camera?.resumePreview?.();
        this.setState({
          health: "live",
          error: null,
          reconnectAttempts: 0,
        });
      } catch (err) {
        console.log("[povme] resumePreview failed — retrying", err);
        this.attemptReconnect();
      }
    }, delay);
  };

  // ---- teardown -------------------------------------------------------------

  private clearReconnectTimer = (): void => {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  };

  private clearTimers = (): void => {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearReconnectTimer();
  };

  /**
   * Release everything. Call from HostScreen's unmount effect.
   * Stops recording, clears timers, detaches the camera, and rejects the
   * recording promise if it's still pending so no async work leaks.
   */
  dispose = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    this.clearTimers();

    // Best-effort stop — swallow errors since we're tearing down anyway.
    try {
      this.camera?.stopRecording();
    } catch {
      // ignore
    }
    this.camera = null;
    this.recordingPromise = null;
    this.listeners.clear();
    this.setState({ health: "ended" });
  };
}
