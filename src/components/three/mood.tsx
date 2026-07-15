import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useConnectionStore } from "@/state/connectionStore";
import type { ConnectionStatus } from "@/types/connection";

/**
 * The choreography core for the 3D backdrop. Every scene component reads the
 * shared `mood` singleton in its own useFrame and animates from it — nothing
 * else drives them. MoodDriver runs at priority -1 so it updates `mood`
 * before any consumer reads it in the same frame.
 *
 * Deliberately a module singleton (not React context / props): the values
 * change every frame and are read inside useFrame loops, so routing them
 * through React would mean per-frame re-renders. getState() reads of the
 * zustand store keep the whole thing off React's render path entirely.
 */

/** Read a CSS custom property into a THREE.Color, with a hardcoded fallback
 * matching src/index.css so this never silently renders the wrong palette. */
function cssColor(varName: string, fallback: string): THREE.Color {
  let raw = fallback;
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (v) raw = v;
  } catch {
    // getComputedStyle unavailable (SSR/tests) — fallback stands.
  }
  return new THREE.Color(raw);
}

export interface ThemeColors {
  base: THREE.Color;
  warm: THREE.Color;
  cool: THREE.Color;
  error: THREE.Color;
}

let cachedTheme: ThemeColors | null = null;
export function themeColors(): ThemeColors {
  if (!cachedTheme) {
    cachedTheme = {
      base: cssColor("--background", "#0d0d0f"),
      warm: cssColor("--primary", "#f2711c"),
      cool: cssColor("--status-connected", "#2dd4bf"),
      error: cssColor("--status-error", "#ef4444"),
    };
  }
  return cachedTheme;
}

export interface Mood {
  energy: number;
  flowSpeed: number;
  tealMix: number;
  swirl: number;
  contract: number;
  expand: number;
  ringOpacity: number;
  ringBrightness: number;
  ringSpeed: number;
  glowStrength: number;
  /** 0..1 envelope for the Connected payoff burst (drives ring scale/flash). */
  burst: number;
  /** 0..1 decaying impulse for the Error jitter (scatter + ring shake). */
  jitter: number;
  /** Accumulated time bases — accumulated (not clock*speed) so speed changes
   * never cause a visual jump. */
  gradientTime: number;
  swirlTime: number;
  /** Ring/particle color, lerped between warm/teal/error each frame. */
  ringColor: THREE.Color;
}

type Target = Pick<
  Mood,
  | "energy"
  | "flowSpeed"
  | "tealMix"
  | "swirl"
  | "contract"
  | "expand"
  | "ringOpacity"
  | "ringBrightness"
  | "ringSpeed"
  | "glowStrength"
>;

type MoodState = ConnectionStatus["state"];

const TARGETS: Record<MoodState, Target> = {
  Idle:          { energy: 0.55, flowSpeed: 1.0, tealMix: 0.0, swirl: 1.0, contract: 0.0, expand: 0.0, ringOpacity: 0.15, ringBrightness: 0.6, ringSpeed: 0.12, glowStrength: 0.05 },
  Launching:     { energy: 0.75, flowSpeed: 1.6, tealMix: 0.0, swirl: 2.5, contract: 0.15, expand: 0.0, ringOpacity: 0.35, ringBrightness: 1.2, ringSpeed: 0.6, glowStrength: 0.12 },
  Connecting:    { energy: 1.0, flowSpeed: 2.5, tealMix: 0.0, swirl: 6.0, contract: 0.4, expand: 0.0, ringOpacity: 0.55, ringBrightness: 2.2, ringSpeed: 1.8, glowStrength: 0.22 },
  Reconnecting:  { energy: 1.0, flowSpeed: 2.5, tealMix: 0.3, swirl: 6.0, contract: 0.4, expand: 0.0, ringOpacity: 0.55, ringBrightness: 2.2, ringSpeed: 1.8, glowStrength: 0.22 },
  Connected:     { energy: 0.8, flowSpeed: 0.7, tealMix: 1.0, swirl: 0.5, contract: 0.0, expand: 1.0, ringOpacity: 0.35, ringBrightness: 1.4, ringSpeed: 0.15, glowStrength: 0.25 },
  Disconnecting: { energy: 0.6, flowSpeed: 1.0, tealMix: 0.4, swirl: 0.8, contract: 0.0, expand: 0.3, ringOpacity: 0.2, ringBrightness: 0.7, ringSpeed: 0.12, glowStrength: 0.08 },
  Error:         { energy: 0.7, flowSpeed: 1.2, tealMix: 0.0, swirl: 1.5, contract: 0.0, expand: 0.0, ringOpacity: 0.3, ringBrightness: 1.0, ringSpeed: 0.3, glowStrength: 0.1 },
};

export const mood: Mood = {
  energy: 0.55,
  flowSpeed: 1.0,
  tealMix: 0.0,
  swirl: 1.0,
  contract: 0.0,
  expand: 0.0,
  ringOpacity: 0.15,
  ringBrightness: 0.6,
  ringSpeed: 0.12,
  glowStrength: 0.05,
  burst: 0,
  jitter: 0,
  gradientTime: 0,
  swirlTime: 0,
  ringColor: new THREE.Color("#f2711c"),
};

const DAMP = 2.0; // lambda for the mood lerps (~1s settle, no hard cuts)

export function MoodDriver() {
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1); // clamp un-hide / stall frames
    const status = useConnectionStore.getState().status.state as MoodState;
    const t = TARGETS[status] ?? TARGETS.Idle;
    const theme = themeColors();

    // One-shot triggers on state change.
    const prev = (mood as unknown as { _prev?: MoodState })._prev;
    if (prev !== status) {
      if (status === "Connected") mood.burst = 1;
      if (status === "Error") mood.jitter = 1;
      (mood as unknown as { _prev?: MoodState })._prev = status;
    }

    mood.energy = THREE.MathUtils.damp(mood.energy, t.energy, DAMP, delta);
    mood.flowSpeed = THREE.MathUtils.damp(mood.flowSpeed, t.flowSpeed, DAMP, delta);
    mood.tealMix = THREE.MathUtils.damp(mood.tealMix, t.tealMix, DAMP, delta);
    mood.swirl = THREE.MathUtils.damp(mood.swirl, t.swirl, DAMP, delta);
    mood.contract = THREE.MathUtils.damp(mood.contract, t.contract, DAMP, delta);
    mood.expand = THREE.MathUtils.damp(mood.expand, t.expand, DAMP, delta);
    mood.ringOpacity = THREE.MathUtils.damp(mood.ringOpacity, t.ringOpacity, DAMP, delta);
    mood.ringBrightness = THREE.MathUtils.damp(mood.ringBrightness, t.ringBrightness, DAMP, delta);
    mood.ringSpeed = THREE.MathUtils.damp(mood.ringSpeed, t.ringSpeed, DAMP, delta);
    mood.glowStrength = THREE.MathUtils.damp(mood.glowStrength, t.glowStrength, DAMP, delta);

    // Envelopes decay toward 0 independent of state.
    mood.burst = Math.max(0, mood.burst - delta / 1.2);
    mood.jitter = Math.max(0, mood.jitter - delta / 0.5);

    // Accumulated time bases (speed changes never jump).
    mood.gradientTime += delta * 0.04 * mood.flowSpeed;
    mood.swirlTime += delta * 0.02 * mood.swirl;

    // Ring color: error tint overrides, else warm→teal by tealMix.
    const targetColor =
      status === "Error"
        ? theme.error
        : new THREE.Color().copy(theme.warm).lerp(theme.cool, mood.tealMix);
    mood.ringColor.lerp(targetColor, 1 - Math.exp(-2.0 * delta));
  }, -1);

  return null;
}
