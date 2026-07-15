import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { AlertTriangle, Check, Loader2, Power } from "lucide-react";
import { useConnectionStore } from "@/state/connectionStore";
import type { ConnectionStatus } from "@/types/connection";

type Phase = "idle" | "connecting" | "connected" | "error";

function phaseOf(status: ConnectionStatus): Phase {
  switch (status.state) {
    case "Launching":
    case "Connecting":
    case "Disconnecting":
      return "connecting";
    case "Connected":
      return "connected";
    case "Error":
      return "error";
    default:
      return "idle";
  }
}

/** Idle breathing is purely decorative/ambient, so it's the one loop that
 * gets fully frozen under reduced motion (rather than relying on
 * MotionConfig's default, which only strips the transform/scale part and
 * would leave the opacity half of the loop still animating). The
 * connecting/connected/error loops are active state feedback, not
 * decoration, and are left animating either way. */
function ringVariants(reduceMotion: boolean): Variants {
  return {
    idle: reduceMotion
      ? {
          boxShadow: "0 0 0 3px var(--color-status-idle)",
          scale: 1,
          opacity: 0.6,
          x: 0,
        }
      : {
          boxShadow: "0 0 0 3px var(--color-status-idle)",
          scale: [1, 1.015, 1],
          opacity: [0.55, 0.7, 0.55],
          x: 0,
          transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut" },
        },
    connecting: {
      boxShadow: [
        "0 0 0 3px var(--color-status-connecting), 0 0 14px 1px color-mix(in oklch, var(--color-status-connecting) 50%, transparent)",
        "0 0 0 3px var(--color-status-connecting), 0 0 20px 3px color-mix(in oklch, var(--color-status-connecting) 50%, transparent)",
        "0 0 0 3px var(--color-status-connecting), 0 0 14px 1px color-mix(in oklch, var(--color-status-connecting) 50%, transparent)",
      ],
      scale: [1, 1.08, 1],
      opacity: [0.7, 1, 0.7],
      x: 0,
      transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
    },
    connected: {
      boxShadow: [
        "0 0 24px 4px var(--color-status-connected), 0 0 0 1px color-mix(in oklch, var(--color-status-connected) 40%, transparent)",
        "0 0 32px 6px var(--color-status-connected), 0 0 0 1px color-mix(in oklch, var(--color-status-connected) 40%, transparent)",
        "0 0 24px 4px var(--color-status-connected), 0 0 0 1px color-mix(in oklch, var(--color-status-connected) 40%, transparent)",
      ],
      scale: [1, 1.03, 1],
      opacity: 1,
      x: 0,
      transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
    },
    error: {
      boxShadow: "0 0 0 3px var(--color-status-error)",
      scale: 1,
      opacity: 1,
      x: [0, -6, 6, -4, 4, 0],
      transition: { x: { duration: 0.4, ease: "easeInOut" } },
    },
  };
}

const ICONS: Record<Phase, typeof Power> = {
  idle: Power,
  connecting: Loader2,
  connected: Check,
  error: AlertTriangle,
};

const ARIA_LABEL: Record<Phase, string> = {
  idle: "Connect",
  connecting: "Cancel connecting",
  connected: "Disconnect",
  error: "Retry connection",
};

export function ConnectButton() {
  const status = useConnectionStore((s) => s.status);
  const connect = useConnectionStore((s) => s.connect);
  const disconnect = useConnectionStore((s) => s.disconnect);
  const reduceMotion = useReducedMotion();

  const phase = phaseOf(status);
  const Icon = ICONS[phase];

  const handleClick = () => {
    if (phase === "idle" || phase === "error") {
      void connect();
    } else {
      void disconnect();
    }
  };

  return (
    <motion.button
      type="button"
      aria-label={ARIA_LABEL[phase]}
      onClick={handleClick}
      disabled={status.state === "Disconnecting"}
      whileTap={{ scale: 0.97 }}
      animate={phase}
      variants={ringVariants(!!reduceMotion)}
      className="relative flex size-40 items-center justify-center rounded-full bg-surface-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
    >
      <AnimatePresence>
        {(phase === "connecting" || phase === "connected") && (
          <motion.span
            key={phase}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border-2"
            style={{
              borderColor:
                phase === "connected"
                  ? "var(--color-status-connected)"
                  : "var(--color-status-connecting)",
            }}
            initial={{ scale: 0.9, opacity: 0.55 }}
            animate={{ scale: phase === "connected" ? 2 : 1.7, opacity: 0 }}
            transition={{ duration: phase === "connected" ? 0.9 : 0.7, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.span
          key={phase}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="flex items-center justify-center"
        >
          <Icon
            size={48}
            strokeWidth={2}
            className={
              phase === "connecting"
                ? "animate-spin text-status-connecting"
                : phase === "connected"
                  ? "text-status-connected"
                  : phase === "error"
                    ? "text-status-error"
                    : "text-status-idle"
            }
          />
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
