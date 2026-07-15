import { useEffect, useState } from "react";
import { useConnectionStore } from "@/state/connectionStore";

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

function ScanProgressBar({ percent }: { percent: number | null }) {
  return (
    <div className="h-1 w-40 overflow-hidden rounded-full bg-surface-2">
      {percent == null ? (
        <div className="progress-indeterminate h-full rounded-full bg-status-connecting" />
      ) : (
        <div
          className="h-full rounded-full bg-status-connecting"
          style={{ width: `${percent}%`, transition: "width 400ms ease-out" }}
        />
      )}
    </div>
  );
}

/**
 * All status text uses neutral greys (--foreground / --muted-foreground)
 * regardless of connection state. Text transitions are handled by the parent
 * React re-render (small DOM diff, no animation library needed).
 */
export function ConnectionStatusLine() {
  const status = useConnectionStore((s) => s.status);
  const scanBudgetSecs = useConnectionStore((s) => s.scanBudgetSecs);
  const attemptStartedAt = useConnectionStore((s) => s.attemptStartedAt);
  const connectedAt = status.state === "Connected" ? status.connected_at_ms : null;
  const elapsed = useElapsed(connectedAt).formatted;

  const [copied, setCopied] = useState(false);

  const isAttempting = status.state === "Launching" || status.state === "Connecting";
  const { formatted: attemptElapsed, totalSeconds: attemptSeconds } = useElapsed(
    isAttempting ? attemptStartedAt : null,
  );
  const scanPercent =
    scanBudgetSecs != null
      ? Math.min(99, Math.round((attemptSeconds / scanBudgetSecs) * 100))
      : null;

  let primary: string;
  let secondary: React.ReactNode;

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
    case "Connected": {
      primary = "Connected";
      const socksAddr = `socks5://${status.socks_addr}`;
      secondary = copied ? (
        <span className="text-status-connected transition-colors duration-200">
          Copied to clipboard!
        </span>
      ) : (
        <button
          onClick={() => {
            void navigator.clipboard.writeText(socksAddr);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          title="Click to copy SOCKS5 address"
          className="hover:text-foreground cursor-pointer transition-colors focus-visible:outline-none focus-visible:underline"
        >
          {socksAddr} · {elapsed}
        </button>
      );
      break;
    }
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
      <span className="block text-base font-medium text-foreground">
        {primary}
      </span>
      <span className="block min-h-5 max-w-xs truncate font-mono text-xs text-muted-foreground">
        {secondary}
      </span>
      {status.state === "Connecting" && <ScanProgressBar percent={scanPercent} />}
    </div>
  );
}
