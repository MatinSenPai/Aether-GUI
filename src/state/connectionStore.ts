import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  ConnectionProfile,
  ConnectionStatus,
  LogLine,
} from "@/types/connection";

const MAX_LOG_LINES = 500;

interface ConnectionState {
  status: ConnectionStatus;
  profile: ConnectionProfile;
  logs: LogLine[];
  sidecarError: string | null;
  /** Aether's own route-probe budget in seconds, parsed live out of its log
   * stream (its prober logs e.g. "...budget=120s" once scanning starts) —
   * lets the UI show real progress instead of an indefinite spinner. Reset
   * on every fresh attempt since it can differ by protocol/scan mode. */
  scanBudgetSecs: number | null;
  attemptStartedAt: number | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  setProtocol: (protocol: ConnectionProfile["protocol"]) => void;
  setScanMode: (scan_mode: ConnectionProfile["scan_mode"]) => void;
  setIpVersion: (ip_version: ConnectionProfile["ip_version"]) => void;
  retryAfterSidecarError: () => void;
}

export const useConnectionStore = create<ConnectionState>()((set, get) => ({
  status: { state: "Idle" },
  profile: { protocol: "auto", scan_mode: "balanced", ip_version: "v4" },
  logs: [],
  sidecarError: null,
  scanBudgetSecs: null,
  attemptStartedAt: null,

  connect: async () => {
    try {
      await invoke("connect", { profileOverride: get().profile });
    } catch (e) {
      const message = String(e);
      // "Binary not found" (src-tauri/src/aether/mod.rs::resolve_binary) means
      // the tunnel engine itself can't run at all — structurally different
      // from a normal connection failure, so it routes to the full-screen
      // SidecarErrorScreen instead of the button's own error state.
      if (message.toLowerCase().includes("binary not found")) {
        set({ sidecarError: message });
      } else {
        set({ status: { state: "Error", message, phase: "launching" } });
      }
    }
  },

  disconnect: async () => {
    try {
      await invoke("disconnect");
    } catch {
      // Backend rejects disconnect() when there's nothing to stop (already
      // Idle) — nothing for the UI to do since status already reflects that.
    }
  },

  setProtocol: (protocol) => {
    set((s) => ({ profile: { ...s.profile, protocol } }));
    void invoke("set_default_profile", { profile: get().profile }).catch((e) => {
      console.error("Failed to save default profile:", e);
    });
  },

  setScanMode: (scan_mode) => {
    set((s) => ({ profile: { ...s.profile, scan_mode } }));
    void invoke("set_default_profile", { profile: get().profile }).catch((e) => {
      console.error("Failed to save default profile:", e);
    });
  },

  setIpVersion: (ip_version) => {
    set((s) => ({ profile: { ...s.profile, ip_version } }));
    void invoke("set_default_profile", { profile: get().profile }).catch((e) => {
      console.error("Failed to save default profile:", e);
    });
  },

  // Clears the fallback screen so the user can attempt Connect again (e.g.
  // after fixing a broken install) — the next connect() call will re-set
  // sidecarError if the binary is still missing.
  retryAfterSidecarError: () => set({ sidecarError: null }),
}));

// Dev-only: lets the 3D backdrop's per-state moods be driven from the WebView2
// devtools console without a live tunnel, e.g.
//   __conn.setState({ status: { state: "Connecting" } })
// Tree-shaken out of production builds by the import.meta.env.DEV guard.
if (import.meta.env.DEV) {
  (window as unknown as { __conn?: typeof useConnectionStore }).__conn = useConnectionStore;
}

const BUDGET_RE = /budget=(\d+)s/;

/** Call once from App's top-level effect; returns a cleanup function. */
export async function initConnectionListeners(): Promise<() => void> {
  let cancelled = false;
  const unlistenFunctions: (() => void)[] = [];

  const setupPromise = (async () => {
    try {
      const [unlistenStatus, unlistenLog] = await Promise.all([
        listen<ConnectionStatus>("aether://status", (e) => {
          if (cancelled) return;
          if (!e.payload) return;
          useConnectionStore.setState({
            status: e.payload,
            // Fresh attempt — last attempt's budget no longer applies.
            ...(e.payload.state === "Launching" ? { scanBudgetSecs: null, attemptStartedAt: Date.now() } : {}),
            ...(e.payload.state === "Idle" ? { attemptStartedAt: null } : {}),
          });
        }),
        listen<{ line: string; timestamp: number }>("aether://log", (e) => {
          if (cancelled) return;
          if (!e.payload || typeof e.payload.line !== "string") return;
          const budgetMatch = BUDGET_RE.exec(e.payload.line);
          useConnectionStore.setState((s) => {
            const newLog = {
              id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
              line: e.payload.line,
              timestamp: e.payload.timestamp,
            };
            return {
              logs: [...s.logs.slice(-(MAX_LOG_LINES - 1)), newLog],
              ...(budgetMatch ? { scanBudgetSecs: Number(budgetMatch[1]) } : {}),
            };
          });
        }),
      ]);

      if (cancelled) {
        unlistenStatus();
        unlistenLog();
        return;
      }

      unlistenFunctions.push(unlistenStatus, unlistenLog);

      // Reconcile state in case the window reopened mid-session, and load the
      // last-successful profile so the protocol selector reflects it. Neither
      // command touches the Aether binary, so a failure here is an IPC-layer
      // bug, not a sidecar problem — logged rather than shown as sidecarError.
      const [status, profile] = await Promise.all([
        invoke<ConnectionStatus>("get_status"),
        invoke<ConnectionProfile>("get_default_profile"),
      ]);

      if (!cancelled) {
        useConnectionStore.setState({ status, profile });
      }
    } catch (e) {
      console.error("Failed to load initial connection state:", e);
    }
  })();

  return () => {
    cancelled = true;
    void setupPromise.then(() => {
      for (const unlisten of unlistenFunctions) {
        unlisten();
      }
    });
  };
}
