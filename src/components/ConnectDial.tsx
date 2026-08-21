import { motion, type Variants } from "motion/react"
import { Power, Shield, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { viewOf, type ConnectionView } from "@/lib/connectionView"
import { useConnectionStore } from "@/state/connectionStore"
import { useAttemptProgress } from "@/state/useConnectionProgress"
import { useWindowFocused } from "@/state/windowFocus"

/** r=92 on a 208px box; 2πr = 578, which is the dash array the ring animates
 * its offset against (578 = empty, 0 = a closed circle). */
const R = 92
const CIRCUMFERENCE = 578

const ACCENT = "var(--color-primary)"
const NEUTRAL = "var(--neutral-400)"

interface DialFace {
  title: string
  state: string
  color: string
  icon: typeof Power
  /** Fraction of the ring that is drawn, 0–1. */
  fill: number
  glow: string
  /** The connected and reconnecting states are the only ones that breathe —
   * a live tunnel and an actively retrying one are the two things worth
   * catching the eye from across the room. */
  halo: boolean
}

function faceFor(
  view: ConnectionView,
  percent: number | null,
  attempt: string
): DialFace {
  switch (view) {
    case "launching":
      return {
        title: "Starting",
        state: "Launching aether",
        color: ACCENT,
        icon: Power,
        fill: 0.06,
        glow: "0 0 26px rgb(var(--accent-rgb) / 0.08)",
        halo: false,
      }
    case "connecting":
      return {
        title: "Connecting",
        state: "Finding a route",
        color: ACCENT,
        // Before Aether reports its scan budget there is no denominator, so
        // the ring sits at a token sliver rather than inventing progress.
        fill: percent != null ? percent / 100 : 0.08,
        icon: Power,
        glow: "0 0 34px rgb(var(--accent-rgb) / 0.14)",
        halo: false,
      }
    case "reconnecting":
      return {
        title: "Reconnecting",
        state: attempt,
        color: ACCENT,
        icon: Power,
        fill: percent != null ? percent / 100 : 0.45,
        glow: "0 0 30px rgb(var(--accent-rgb) / 0.10)",
        halo: true,
      }
    case "connected":
      return {
        title: "Connected",
        state: "Tunnel live",
        color: ACCENT,
        icon: Shield,
        fill: 1,
        glow: "0 0 44px rgb(var(--accent-rgb) / 0.26)",
        halo: true,
      }
    case "disconnecting":
      return {
        title: "Disconnecting",
        state: "Closing tunnel",
        color: NEUTRAL,
        icon: Power,
        fill: 0,
        glow: "none",
        halo: false,
      }
    case "error":
      return {
        title: "Try again",
        state: "Connection failed",
        color: NEUTRAL,
        icon: TriangleAlert,
        fill: 0,
        glow: "none",
        halo: false,
      }
    case "setup":
      return {
        title: "Set up",
        state: "Not ready",
        color: NEUTRAL,
        icon: TriangleAlert,
        fill: 0,
        glow: "none",
        halo: false,
      }
    default:
      return {
        title: "Connect",
        state: "Not connected",
        color: NEUTRAL,
        icon: Power,
        fill: 0,
        glow: "none",
        halo: false,
      }
  }
}

const ARIA: Record<ConnectionView, string> = {
  idle: "Connect",
  launching: "Cancel connecting",
  connecting: "Cancel connecting",
  reconnecting: "Stop reconnecting",
  connected: "Disconnect",
  disconnecting: "Disconnecting",
  error: "Retry connection",
  setup: "Retry connection",
}

/** Motion handles ONLY one-shots here (the error shake, the tap). Every
 * infinite loop is a CSS animation from index.css on a compositor-promoted
 * layer — Motion's JS-driven loops cost a style recalc every frame at 60fps,
 * and its box-shadow tweens over var()/color-mix() values never converge at
 * all (traced live: an endless per-frame write pinned the compositor). */
const SHAKE: Variants = {
  rest: { x: 0 },
  error: {
    x: [0, -6, 6, -4, 4, 0],
    transition: { x: { duration: 0.4, ease: "easeInOut" } },
  },
}

/**
 * The single control. It is the button, the progress bar and the status
 * light at once: the ring's arc tracks route discovery, its color says
 * whether a tunnel is live (accent) or not (neutral), and its label says
 * what pressing it will do.
 */
export function ConnectDial() {
  const status = useConnectionStore((s) => s.status)
  const sidecarError = useConnectionStore((s) => s.sidecarError)
  const connect = useConnectionStore((s) => s.connect)
  const disconnect = useConnectionStore((s) => s.disconnect)
  const retryAfterSidecarError = useConnectionStore(
    (s) => s.retryAfterSidecarError
  )
  const focused = useWindowFocused()
  const { percent } = useAttemptProgress()

  const view = viewOf(status, sidecarError)
  const attempt =
    status.state === "Reconnecting"
      ? `Attempt ${status.attempt} of ${status.max_attempts}`
      : "Retrying"
  const face = faceFor(view, percent, attempt)
  const Icon = face.icon

  // Unfocused = nobody is watching, and any running animation keeps the
  // WebView2 compositor redrawing at 60fps in the background — pause (not
  // remove) so nothing jumps on refocus. Inline style, NOT a Tailwind
  // [animation-play-state:paused] class: the .anim-* shorthands are
  // unlayered CSS and silently beat layered utilities in the cascade
  // (verified live — the class applied yet computed state stayed "running").
  const playState = {
    animationPlayState: focused ? ("running" as const) : ("paused" as const),
  }

  const handleClick = () => {
    if (view === "setup") {
      retryAfterSidecarError()
      void connect()
    } else if (view === "idle" || view === "error") {
      void connect()
    } else {
      void disconnect()
    }
  }

  return (
    <div className="relative grid size-52 place-items-center">
      <svg
        aria-hidden
        width={208}
        height={208}
        viewBox="0 0 208 208"
        className="absolute inset-0 -rotate-90"
      >
        <circle
          cx={104}
          cy={104}
          r={R}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={1.5}
        />
        <circle
          cx={104}
          cy={104}
          r={R}
          fill="none"
          stroke={face.color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - face.fill)}
          style={{
            transition:
              "stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1), stroke 0.3s ease",
          }}
        />
      </svg>

      {/* The glow is its own layer so the halo loop composites without
       * repainting the dial's text underneath it. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute size-[158px] rounded-full",
          face.halo && "anim-halo"
        )}
        style={{
          boxShadow: face.glow,
          transition: "box-shadow 0.5s ease",
          willChange: "transform, opacity",
          ...playState,
        }}
      />

      <motion.button
        type="button"
        aria-label={ARIA[view]}
        onClick={handleClick}
        disabled={view === "disconnecting"}
        whileTap={{ scale: 0.97 }}
        animate={view === "error" || view === "setup" ? "error" : "rest"}
        variants={SHAKE}
        className="relative flex size-[158px] flex-col items-center justify-center gap-[9px] rounded-full border border-border bg-[color-mix(in_srgb,var(--surface-1)_70%,transparent)] font-heading text-foreground transition-[border-color,background-color,transform] duration-200 outline-none hover:border-primary/60 hover:bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--surface-1))] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-70"
      >
        <Icon size={24} strokeWidth={1.3} style={{ color: face.color }} />
        <span className="text-[17px] font-medium tracking-[-0.01em]">
          {face.title}
        </span>
        <span className="text-[10px] tracking-[0.14em] text-faint uppercase">
          {face.state}
        </span>
      </motion.button>
    </div>
  )
}
