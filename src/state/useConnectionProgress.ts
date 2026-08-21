import { useEffect, useState } from "react"
import { useConnectionStore } from "@/state/connectionStore"

/** Ticking clock since a fixed instant. Returns both the display string and
 * the raw seconds, since the connecting view needs the number to derive a
 * percentage and the connected view only needs the text. */
export function useElapsed(sinceMs: number | null): {
  formatted: string
  totalSeconds: number
} {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (sinceMs == null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [sinceMs])
  if (sinceMs == null) return { formatted: "", totalSeconds: 0 }
  const total = Math.max(0, Math.floor((now - sinceMs) / 1000))
  const h = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, "0")
  // Minutes go unpadded below an hour so a running clock reads 0:19, 5:02,
  // 14:22 — the same shape as the scan budget it gets compared against.
  return {
    formatted:
      h > 0 ? `${h}:${String(mins).padStart(2, "0")}:${s}` : `${mins}:${s}`,
    totalSeconds: total,
  }
}

/**
 * Progress of the current connect attempt.
 *
 * Route discovery can legitimately take up to ~2.5 minutes with nothing else
 * changing on screen — a running timer, and a real percentage once Aether
 * reports its own scan budget in its log stream, is the difference between
 * "still working" and "looks hung". `percent` is deliberately null until that
 * budget arrives: before then the backend has no denominator, so the design
 * shows the phase name and an indeterminate sweep instead of a number.
 */
export function useAttemptProgress(): {
  elapsed: string
  seconds: number
  percent: number | null
} {
  const status = useConnectionStore((s) => s.status)
  const scanBudgetSecs = useConnectionStore((s) => s.scanBudgetSecs)

  // This reads the wall clock (Date.now()) on a specific state transition,
  // which is an external-system read, not a state mirror — a genuine effect,
  // not something derivable during render.
  const [attemptStartedAt, setAttemptStartedAt] = useState<number | null>(null)
  /* eslint-disable react-hooks/set-state-in-effect -- capturing Date.now()
   * at the moment of transition; can't be computed during render. */
  useEffect(() => {
    if (status.state === "Launching") setAttemptStartedAt(Date.now())
    else if (status.state === "Idle") setAttemptStartedAt(null)
  }, [status.state])
  /* eslint-enable react-hooks/set-state-in-effect */

  const attempting =
    status.state === "Launching" ||
    status.state === "Connecting" ||
    status.state === "Reconnecting"
  const { formatted, totalSeconds } = useElapsed(
    attempting ? attemptStartedAt : null
  )

  // Capped below 100 until the backend actually reports Connected — hitting
  // 100% here would claim done before the state machine agrees.
  const percent =
    scanBudgetSecs != null
      ? Math.min(99, Math.round((totalSeconds / scanBudgetSecs) * 100))
      : null

  return { elapsed: formatted, seconds: totalSeconds, percent }
}
