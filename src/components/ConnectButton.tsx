import { useCallback } from "react";
import { AlertTriangle, Check, Loader2, Power } from "lucide-react";
import { useConnectionStore } from "@/state/connectionStore";
import type { ConnectionStatus } from "@/types/connection";

type Phase = "idle" | "connecting" | "connected" | "error";

function phaseOf(status: ConnectionStatus): Phase {
  switch (status.state) {
    case "Launching":
    case "Connecting":
    case "Reconnecting":
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

const PHASE_COLORS: Record<Phase, string> = {
  idle: "text-status-idle",
  connecting: "animate-spin text-status-connecting",
  connected: "text-status-connected",
  error: "text-status-error",
};

/**
 * Pure CSS ConnectButton — no motion/framer-motion dependency.
 * Icon cross-fade is handled via CSS animation triggered by a key
 * on the outer span — eliminates all JS timer/state overhead.
 */
export function ConnectButton() {
  const phase = useConnectionStore((s) => phaseOf(s.status));
  const isDisconnecting = useConnectionStore((s) => s.status.state === "Disconnecting");
  const connect = useConnectionStore((s) => s.connect);
  const disconnect = useConnectionStore((s) => s.disconnect);

  const Icon = ICONS[phase];

  const handleClick = useCallback(() => {
    if (phase === "idle" || phase === "error") {
      void connect();
    } else {
      void disconnect();
    }
  }, [phase, connect, disconnect]);

  return (
    <button
      type="button"
      aria-label={ARIA_LABEL[phase]}
      data-connect-anchor
      data-phase={phase}
      onClick={handleClick}
      disabled={isDisconnecting}
      className="connect-btn relative flex size-40 items-center justify-center rounded-full bg-surface-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* Ripple ring — CSS animation triggered by data-phase */}
      {(phase === "connecting" || phase === "connected") && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full border-2 connect-ripple"
          data-phase={phase}
        />
      )}

      {/* Icon with CSS entrance animation — key change triggers re-animation */}
      <span key={phase} className="connect-icon relative flex size-12 items-center justify-center">
        <Icon
          size={48}
          strokeWidth={2}
          className={PHASE_COLORS[phase]}
        />
      </span>
    </button>
  );
}
