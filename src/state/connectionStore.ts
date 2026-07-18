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
  /** Independent of `status` — whether the user currently wants the
   * Windows system proxy pointed at the tunnel. Mirrors src-tauri's
   * settings.rs::AppSettings.system_proxy_enabled and can change from
   * either this window's toggle or the tray's checkbox/Pause item; the
   * `aether://system-proxy` listener below keeps both in sync. `null`
   * until the initial value has loaded. */
  systemProxyEnabled: boolean | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  setSystemProxyEnabled: (enabled: boolean) => Promise<void>;
  setProtocol: (protocol: ConnectionProfile["protocol"]) => void;
  setScanMode: (scan_mode: ConnectionProfile["scan_mode"]) => void;
  setIpVersion: (ip_version: ConnectionProfile["ip_version"]) => void;
  setLocalPort: (local_port: number) => void;
  setQuickReconnect: (quick_reconnect: boolean) => void;
  setMasqueHttp2: (masque_http2: boolean) => void;
  retryAfterSidecarError: () => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  status: { state: "Idle" },
  profile: {
    protocol: "auto",
    scan_mode: "balanced",
    ip_version: "v4",
    local_port: 1819,
    quick_reconnect: true,
    masque_http2: false,
  },
  logs: [],
  sidecarError: null,
  scanBudgetSecs: null,
  systemProxyEnabled: null,

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

  setLocalPort: (local_port) =>
    set((s) => ({ profile: { ...s.profile, local_port } })),

  setQuickReconnect: (quick_reconnect) =>
    set((s) => ({ profile: { ...s.profile, quick_reconnect } })),

  setMasqueHttp2: (masque_http2) =>
    set((s) => ({ profile: { ...s.profile, masque_http2 } })),

  setSystemProxyEnabled: async (enabled) => {
    const previous = get().systemProxyEnabled;
    set({ systemProxyEnabled: enabled }); // optimistic; the backend also
    // echoes this back via the aether://system-proxy event, so a tray
    // toggle fired at the same moment can't leave the two out of sync.
    try {
      await invoke("set_system_proxy_enabled", { enabled });
    } catch (e) {
      console.error("Failed to update system proxy:", e);
      set({ systemProxyEnabled: previous });
    }
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

  const [unlistenStatus, unlistenLog, unlistenSystemProxy] = await Promise.all([
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
    // Fired by the Rust side whenever the system-proxy preference changes
    // from *any* surface (this window's toggle, the tray checkbox, or the
    // tray's Pause/Resume item) — keeps this window's switch honest even
    // when the tray is what actually changed it.
    listen<{ enabled: boolean }>("aether://system-proxy", (e) => {
      useConnectionStore.setState({ systemProxyEnabled: e.payload.enabled });
    }),
  ]);

  // Reconcile state in case the window reopened mid-session, and load the
  // last-successful profile so the protocol selector reflects it. Neither
  // command touches the Aether binary, so a failure here is an IPC-layer
  // bug, not a sidecar problem — logged rather than shown as sidecarError.
  try {
    const [status, profile, systemProxyEnabled] = await Promise.all([
      invoke<ConnectionStatus>("get_status"),
      invoke<ConnectionProfile>("get_default_profile"),
      invoke<boolean>("get_system_proxy_enabled"),
    ]);
    useConnectionStore.setState({ status, profile, systemProxyEnabled });
  } catch (e) {
    console.error("Failed to load initial connection state:", e);
  }

  return () => {
    unlistenStatus();
    unlistenLog();
    unlistenSystemProxy();
    if (flushTimer !== null) clearTimeout(flushTimer);
  };
}