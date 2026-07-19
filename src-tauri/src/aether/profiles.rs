use serde::{Deserialize, Serialize};

/// `Auto` resolves to Aether's own default (MASQUE). Aether's own `scan_mode`
/// already performs multi-route discovery internally (confirmed by manually
/// running the real binary), so Aether-GUI does not implement a client-side
/// protocol-fallback retry loop on top of this.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Protocol {
    Auto,
    Masque,
    Wireguard,
    Gool,
}

impl Protocol {
    /// The literal menu choice Aether expects at its "Protocol:" prompt.
    pub fn as_menu_choice(&self) -> &'static str {
        match self {
            Protocol::Auto | Protocol::Masque => "1",
            Protocol::Wireguard => "2",
            Protocol::Gool => "3",
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ScanMode {
    Turbo,
    Balanced,
    Thorough,
    Stealth,
    Ironclad,
}

impl ScanMode {
    pub fn as_menu_choice(&self) -> &'static str {
        match self {
            ScanMode::Turbo => "1",
            ScanMode::Balanced => "2",
            ScanMode::Thorough => "3",
            ScanMode::Stealth => "4",
            ScanMode::Ironclad => "5",
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum IpVersion {
    V4,
    V6,
    Both,
}

impl IpVersion {
    pub fn as_menu_choice(&self) -> &'static str {
        match self {
            IpVersion::V4 => "1",
            IpVersion::V6 => "2",
            IpVersion::Both => "3",
        }
    }
}

/// Note: there is no `local_port` or `obfuscation_profile` field. Manually
/// running Aether v1.0.1 end to end showed it only ever prompts for these
/// three settings (protocol / scan mode / IP version) regardless of protocol
/// choice — the local port is fixed at 1819 by Aether itself, and the
/// obfuscation profile is auto-selected and merely logged, never prompted.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct ConnectionProfile {
    pub protocol: Protocol,
    pub scan_mode: ScanMode,
    pub ip_version: IpVersion,
    /// Aether ≥1.1.1: reuse the last known-working gateway with a quick
    /// recheck instead of a full scan. `serde(default)` keeps profiles saved
    /// by older versions of this app loading cleanly.
    #[serde(default = "default_true")]
    pub quick_reconnect: bool,
    /// Aether ≥1.2.0: run the MASQUE tunnel over HTTP/2 (TCP) instead of the
    /// default HTTP/3 (QUIC) — for networks that block or throttle UDP.
    /// Passed as the AETHER_MASQUE_HTTP2 env var, not a flag: there is no
    /// `--h3` flag, and setting the env to any value also suppresses 1.2.0's
    /// new interactive "MASQUE transport" prompt in both directions.
    #[serde(default)]
    pub masque_http2: bool,
}

fn default_true() -> bool {
    true
}

impl ConnectionProfile {
    /// CLI flags for Aether ≥1.1.1 — the whole profile is passed up front so
    /// the interactive prompts never appear (the PTY prompt-answering in
    /// pty.rs stays as a fallback). One of the two quick-reconnect flags is
    /// ALWAYS passed: without either, 1.1.1 asks its own interactive
    /// "reconnect with last gateway?" question, which the GUI must never
    /// leave unanswered.
    pub fn as_args(&self) -> Vec<&'static str> {
        let mut args = Vec::with_capacity(4);
        match self.protocol {
            Protocol::Auto => {} // Aether's own default (MASQUE)
            Protocol::Masque => args.push("--masque"),
            Protocol::Wireguard => args.push("--wg"),
            Protocol::Gool => args.push("--gool"),
        }
        args.push(match self.scan_mode {
            ScanMode::Turbo => "--turbo",
            ScanMode::Balanced => "--balanced",
            ScanMode::Thorough => "--thorough",
            ScanMode::Stealth => "--stealth",
            ScanMode::Ironclad => "--ironclad",
        });
        args.push(match self.ip_version {
            IpVersion::V4 => "-4",
            IpVersion::V6 => "-6",
            IpVersion::Both => "--dual",
        });
        args.push(if self.quick_reconnect { "--quick-reconnect" } else { "--no-quick-reconnect" });
        args
    }
}

impl Default for ConnectionProfile {
    fn default() -> Self {
        // Mirrors Aether's own defaults.
        Self {
            protocol: Protocol::Auto,
            scan_mode: ScanMode::Balanced,
            ip_version: IpVersion::V4,
            quick_reconnect: true,
            masque_http2: false,
        }
    }
}

const STORE_FILE: &str = "profile.json";
const STORE_KEY: &str = "last_successful_profile";

/// Loads the last profile that reached `Connected`, or the hardcoded default
/// on first run. Only ever written by `save()` at the moment a connection
/// actually succeeds (see aether/mod.rs) — never on a mere attempt, so a bad
/// guess can't poison future one-click connects.
pub fn load(app: &tauri::AppHandle) -> ConnectionProfile {
    use tauri_plugin_store::StoreExt;
    app.store(STORE_FILE)
        .ok()
        .and_then(|s| s.get(STORE_KEY))
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save(app: &tauri::AppHandle, profile: &ConnectionProfile) {
    use tauri_plugin_store::StoreExt;
    if let Ok(store) = app.store(STORE_FILE) {
        if let Ok(value) = serde_json::to_value(profile) {
            store.set(STORE_KEY, value);
            let _ = store.save();
        }
    }
}
