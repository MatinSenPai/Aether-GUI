import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  ConnectionProfile,
  ConnectionStatus,
  LogLine,
  MasqueNoize,
  WgNoize,
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
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  setProtocol: (protocol: ConnectionProfile["protocol"]) => void;
  setScanMode: (scan_mode: ConnectionProfile["scan_mode"]) => void;
  setIpVersion: (ip_version: ConnectionProfile["ip_version"]) => void;
  setQuickReconnect: (quick_reconnect: boolean) => void;
  setMasqueHttp2: (masque_http2: boolean) => void;
  setMasqueNoize: (masque_noize: MasqueNoize) => void;
  setWgNoize: (wg_noize: WgNoize) => void;
  retryAfterSidecarError: () => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  status: { state: "Idle" },
  profile: {
    protocol: "auto",
    scan_mode: "balanced",
    ip_version: "v4",
    quick_reconnect: true,
    masque_http2: false,
    masque_noize: "firewall",
    wg_noize: "balanced",
  },
  logs: [],
  sidecarError: null,
  scanBudgetSecs: null,

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

  setProtocol: (protocol) =>
    set((s) => ({ profile: { ...s.profile, protocol } })),

  setScanMode: (scan_mode) =>
    set((s) => ({ profile: { ...s.profile, scan_mode } })),

  setIpVersion: (ip_version) =>
    set((s) => ({ profile: { ...s.profile, ip_version } })),

  setQuickReconnect: (quick_reconnect) =>
    set((s) => ({ profile: { ...s.profile, quick_reconnect } })),

  setMasqueHttp2: (masque_http2) =>
    set((s) => ({ profile: { ...s.profile, masque_http2 } })),

  setMasqueNoize: (masque_noize) =>
    set((s) => ({ profile: { ...s.profile, masque_noize } })),

  setWgNoize: (wg_noize) =>
    set((s) => ({ profile: { ...s.profile, wg_noize } })),

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
  // Log lines arrive fast during route scanning; flushing to the store per
  // line would mean an O(logs) array copy + a re-render each. Coalesce into
  // one store write per ~100ms instead.
  let pendingLogs: LogLine[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  const flushLogs = () => {
    flushTimer = null;
    const batch = pendingLogs;
    pendingLogs = [];
    let budget: number | null = null;
    for (const l of batch) {
      const m = BUDGET_RE.exec(l.line);
      if (m) budget = Number(m[1]);
    }
    useConnectionStore.setState((s) => ({
      logs: [...s.logs, ...batch].slice(-MAX_LOG_LINES),
      ...(budget !== null ? { scanBudgetSecs: budget } : {}),
    }));
  };

  const [unlistenStatus, unlistenLog] = await Promise.all([
    listen<ConnectionStatus>("aether://status", (e) => {
      useConnectionStore.setState({
        status: e.payload,
        // Fresh attempt — last attempt's budget no longer applies.
        ...(e.payload.state === "Launching" ? { scanBudgetSecs: null } : {}),
      });
    }),
    listen<LogLine>("aether://log", (e) => {
      pendingLogs.push(e.payload);
      flushTimer ??= setTimeout(flushLogs, 100);
    }),
  ]);

  // Reconcile state in case the window reopened mid-session, and load the
  // last-successful profile so the protocol selector reflects it. Neither
  // command touches the Aether binary, so a failure here is an IPC-layer
  // bug, not a sidecar problem — logged rather than shown as sidecarError.
  try {
    const [status, profile] = await Promise.all([
      invoke<ConnectionStatus>("get_status"),
      invoke<ConnectionProfile>("get_default_profile"),
    ]);
    useConnectionStore.setState({ status, profile });
  } catch (e) {
    console.error("Failed to load initial connection state:", e);
  }

  return () => {
    unlistenStatus();
    unlistenLog();
    if (flushTimer !== null) clearTimeout(flushTimer);
  };
}
