import { useConnectionStore } from "@/state/connectionStore"
import { useAttemptProgress } from "@/state/useConnectionProgress"
import { useWindowFocused } from "@/state/windowFocus"
import { cn } from "@/lib/utils"

function mmss(total: number): string {
  const m = Math.floor(total / 60)
  const s = String(total % 60).padStart(2, "0")
  return `${m}:${s}`
}

/**
 * The named-phase block under the dial. Two rules from the design carry the
 * whole thing: the phase is a name, not a spinner, and the percentage only
 * appears once Aether has reported its own scan budget — before that the
 * backend has no denominator, so a number would be invented.
 */
export function ConnectingPanel() {
  const status = useConnectionStore((s) => s.status)
  const scanBudgetSecs = useConnectionStore((s) => s.scanBudgetSecs)
  const disconnect = useConnectionStore((s) => s.disconnect)
  const focused = useWindowFocused()
  const { elapsed, percent } = useAttemptProgress()

  const launching = status.state === "Launching"
  const phase = launching
    ? "Starting aether"
    : status.state === "Reconnecting"
      ? "Re-testing last gateway"
      : "Probing candidate routes"

  const sub = launching
    ? "pty attached · waiting for scan budget"
    : scanBudgetSecs != null
      ? `${elapsed} of ~${mmss(scanBudgetSecs)} budget`
      : `${elapsed} elapsed`

  // The sweep freezes while the window is unfocused — an infinite loop keeps
  // the compositor at 60fps in the background, and route scanning is exactly
  // when users tab away.
  const playState = {
    animationPlayState: focused ? ("running" as const) : ("paused" as const),
  }

  return (
    <div
      aria-live="polite"
      className="anim-rise mt-5 flex w-full flex-col gap-[9px]"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[13px]">{phase}</span>
        <span className="ml-auto font-mono text-xs text-[var(--neutral-500)]">
          {percent != null ? `${percent}%` : ""}
        </span>
      </div>

      <div className="h-[3px] overflow-hidden rounded-sm bg-border">
        <div
          className={cn("h-full", launching ? "anim-sweep-fast" : "anim-sweep")}
          style={{
            width: percent != null ? `${percent}%` : "18%",
            background:
              "linear-gradient(90deg, var(--accent-700), var(--accent-500) 45%, var(--accent-300) 55%, var(--accent-500) 70%, var(--accent-700))",
            backgroundSize: "220% 100%",
            transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)",
            willChange: "background-position",
            ...playState,
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-faint">{sub}</span>
        <button
          type="button"
          onClick={() => void disconnect()}
          className="ml-auto rounded-md px-1 py-0.5 text-xs text-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
