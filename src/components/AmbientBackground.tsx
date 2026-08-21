import { useWindowFocused } from "@/state/windowFocus"

/**
 * Two drifting accent orbs behind the app column — the design's warm bloom
 * over the metallic ground. All motion is pure CSS (the noct-drift keyframes
 * in index.css) on compositor-promoted layers: zero main-thread work per
 * frame, and prefers-reduced-motion is handled by the media query there.
 *
 * The design's `filter: blur(10px)` is dropped on purpose — a radial
 * gradient already fades smoothly at these radii, so the blur was visually
 * redundant while forcing an expensive re-raster of the layer every frame.
 * Paused (not removed) while the window is unfocused so the app costs
 * ~nothing in the background and nothing jumps on refocus.
 */
export function AmbientBackground() {
  const focused = useWindowFocused()
  // Inline, not a Tailwind pause class — the unlayered .anim-* shorthands
  // beat layered utilities in the cascade (see ConnectDial).
  const playState = {
    animationPlayState: focused ? ("running" as const) : ("paused" as const),
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div
        className="anim-drift absolute size-85 rounded-full"
        style={{
          left: -110,
          top: 40,
          background:
            "radial-gradient(circle, rgb(var(--accent-rgb) / 0.2), transparent 70%)",
          willChange: "transform",
          ...playState,
        }}
      />
      <div
        className="anim-drift-slow absolute size-75 rounded-full"
        style={{
          right: -120,
          bottom: -40,
          background:
            "radial-gradient(circle, rgba(96, 42, 44, 0.75), transparent 70%)",
          willChange: "transform",
          ...playState,
        }}
      />
    </div>
  )
}
