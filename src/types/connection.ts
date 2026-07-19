// Mirrors src-tauri/src/state.rs::ConnectionState (serde adjacently-tagged
// via `#[serde(tag = "state")]`) and src-tauri/src/aether/profiles.rs.

export type ConnectionStatus =
  | { state: "Idle" }
  | { state: "Launching" }
  | { state: "Connecting" }
  | { state: "Connected"; socks_addr: string; connected_at_ms: number; profile_summary: string }
  | { state: "Reconnecting"; attempt: number; max_attempts: number }
  | { state: "Disconnecting" }
  | { state: "Error"; message: string; phase: string };

export type Protocol = "auto" | "masque" | "wireguard" | "gool";
export type ScanMode = "turbo" | "balanced" | "thorough" | "stealth";
export type IpVersion = "v4" | "v6" | "both";
export type NoizeProfile = "off" | "light" | "balanced" | "aggressive";

export interface ConnectionProfile {
  protocol: Protocol;
  scan_mode: ScanMode;
  ip_version: IpVersion;
  /** Local SOCKS5 listen port. Defaults to Aether's own default, 1819. */
  local_port: number;
  /** Aether ≥1.1.1: reuse the last known-working gateway with a quick
   * recheck instead of a full scan. */
  quick_reconnect: boolean;
  /** Aether ≥1.2.0: run MASQUE over HTTP/2 (TCP) instead of the default
   * HTTP/3 (QUIC) — for networks that block or throttle UDP. */
  masque_http2: boolean;
  /** Traffic obfuscation profile (`--noize`). Aether's own default is
   * "balanced". */
  noize_profile: NoizeProfile;
  /** Fragments the TLS ClientHello on the HTTP/2 transport (`--fragment`).
   * Only has an effect together with `masque_http2`. */
  fragment_enabled: boolean;
  /** Binds the SOCKS5 listener to `0.0.0.0` instead of loopback-only, so
   * other devices on the LAN can use it too (`--bind 0.0.0.0:<port>`). */
  lan_access_enabled: boolean;
  /** Port to bind when `lan_access_enabled` is set. `null` means "use
   * `local_port`". */
  lan_port: number | null;
}

export interface LogLine {
  line: string;
  timestamp: number;
}

// Mirrors src-tauri/src/commands.rs::FullAppSettings.
export interface AppSettings {
  start_minimized: boolean;
  auto_connect: boolean;
  launch_on_startup: boolean;
  language: string;
}