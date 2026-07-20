import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useConnectionStore } from "@/state/connectionStore";
import { useWindowFocused } from "@/state/windowFocus";

const TEXT_TRANSITION = {
  initial: { y: 4, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -4, opacity: 0 },
  transition: { duration: 0.1, ease: [0.4, 0, 0.2, 1] as const },
};

function useElapsed(sinceMs: number | null): { formatted: string; totalSeconds: number } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (sinceMs == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sinceMs]);
  if (sinceMs == null) return { formatted: "", totalSeconds: 0 };
  const total = Math.max(0, Math.floor((now - sinceMs) / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return { formatted: `${h}:${m}:${s}`, totalSeconds: total };
}

/** Thin progress track under the status text, shown only while Connecting.
 * Determinate (fills toward Aether's own reported scan budget) once that
 * budget is known; an indeterminate sweep before then, so there's always
 * visible motion rather than a dead bar. */
function ScanProgressBar({ percent }: { percent: number | null }) {
  // The indeterminate sweep freezes while the window is unfocused — an
  // infinite loop keeps the compositor at 60fps in the background (see
  // state/windowFocus.ts), and scanning is exactly when users tab away.
  const focused = useWindowFocused();
  return (
    <div className="h-1 w-40 overflow-hidden rounded-full bg-surface-2">
      {percent == null ? (
        <motion.div
          className="h-full w-1/3 rounded-full bg-status-connecting"
          animate={focused ? { x: ["-100%", "220%"] } : { x: "50%", opacity: 0.6 }}
          transition={
            focused ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }
          }
        />
      ) : (
        <motion.div
          className="h-full rounded-full bg-status-connecting"
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      )}
    </div>
  );
}

/**
 * All status text stays in the two neutral greys (--foreground /
 * --muted-foreground) regardless of connection state — only the
 * ConnectButton's ring/icon carries status color. This sidesteps every
 * marginal-contrast case a semantic status color would hit as small text
 * (verified during design: idle-grey as text measures 4.02:1, just under
 * AA's 4.5:1 minimum).
 */
export function ConnectionStatusLine() {
  const status = useConnectionStore((s) => s.status);
  const scanBudgetSecs = useConnectionStore((s) => s.scanBudgetSecs);
  const connectedAt = status.state === "Connected" || status.state === "Tunneling"
    ? status.connected_at_ms
    : null;
  const elapsed = useElapsed(connectedAt).formatted;

  // Route discovery can legitimately take up to ~2.5 minutes with nothing
  // else changing on screen — a running timer (and, once Aether reports its
  // own scan budget in its log stream, a real percentage) is the difference
  // between "still working" and "looks hung", tracked from the moment a
  // fresh attempt starts (Launching) through the whole Connecting wait.
  // This reads the wall clock (Date.now()) on a specific state transition,
  // which is an external-system read, not a state mirror — a genuine effect,
  // not something derivable during render.
  const [attemptStartedAt, setAttemptStartedAt] = useState<number | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect -- capturing Date.now()
   * at the moment of transition; can't be computed during render. */
  useEffect(() => {
    if (status.state === "Launching") setAttemptStartedAt(Date.now());
    else if (status.state === "Idle") setAttemptStartedAt(null);
  }, [status.state]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const isAttempting = status.state === "Launching" || status.state === "Connecting";
  const { formatted: attemptElapsed, totalSeconds: attemptSeconds } = useElapsed(
    isAttempting ? attemptStartedAt : null,
  );
  // Capped below 100 until the backend actually reports Connected — hitting
  // 100% here would claim done before the state machine agrees.
  const scanPercent =
    scanBudgetSecs != null
      ? Math.min(99, Math.round((attemptSeconds / scanBudgetSecs) * 100))
      : null;

  let primary: string;
  let secondary: string;

  switch (status.state) {
    case "Idle":
      primary = "Disconnected";
      secondary = "Click to connect";
      break;
    case "Launching":
      primary = "Starting Aether…";
      secondary = "Answering setup prompts";
      break;
    case "Connecting":
      primary = "Finding a route…";
      secondary =
        scanPercent != null
          ? `Still searching · ${attemptElapsed} · ${scanPercent}%`
          : `Still searching · ${attemptElapsed}`;
      break;
    case "Reconnecting":
      primary = "Reconnecting…";
      secondary = `Attempt ${status.attempt} of ${status.max_attempts}`;
      break;
    case "Connected":
      primary = "Connected";
      secondary = elapsed;
      break;
    case "Tunneling":
      primary = "Tunnel active";
      secondary = elapsed;
      break;
    case "Disconnecting":
      primary = "Disconnecting…";
      secondary = "";
      break;
    case "Error":
      primary = "Connection failed";
      secondary = status.message;
      break;
  }

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="flex flex-col items-center gap-2 text-center"
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={status.state}
          className="block text-base font-medium text-foreground"
          {...TEXT_TRANSITION}
        >
          {primary}
        </motion.span>
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.span
          key={status.state}
          className="block min-h-5 max-w-xs truncate font-mono text-xs text-muted-foreground"
          {...TEXT_TRANSITION}
        >
          {secondary}
        </motion.span>
      </AnimatePresence>
      {status.state === "Connecting" && <ScanProgressBar percent={scanPercent} />}
    </div>
  );
}
