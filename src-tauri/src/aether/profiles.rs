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

    /// Short label for display (tray tooltip, notifications, status line).
    pub fn label(&self) -> &'static str {
        match self {
            Protocol::Auto => "auto",
            Protocol::Masque => "masque",
            Protocol::Wireguard => "wireguard",
            Protocol::Gool => "gool",
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
}

impl ScanMode {
    pub fn as_menu_choice(&self) -> &'static str {
        match self {
            ScanMode::Turbo => "1",
            ScanMode::Balanced => "2",
            ScanMode::Thorough => "3",
            ScanMode::Stealth => "4",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            ScanMode::Turbo => "turbo",
            ScanMode::Balanced => "balanced",
            ScanMode::Thorough => "thorough",
            ScanMode::Stealth => "stealth",
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

    pub fn label(&self) -> &'static str {
        match self {
            IpVersion::V4 => "ipv4",
            IpVersion::V6 => "ipv6",
            IpVersion::Both => "dual",
        }
    }
}

/// Real accepted values per Aether's own `aethernoize::from_profile` (the
/// `--noize` USAGE text also lists "firewall"/"gfw" as aliases, but those
/// aren't actually matched anywhere in the parser — anything unrecognized
/// silently falls through to `Balanced`, so we stick to the four names the
/// code actually branches on).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum NoizeProfile {
    Off,
    Light,
    Balanced,
    Aggressive,
}

impl NoizeProfile {
    pub fn label(&self) -> &'static str {
        match self {
            NoizeProfile::Off => "off",
            NoizeProfile::Light => "light",
            NoizeProfile::Balanced => "balanced",
            NoizeProfile::Aggressive => "aggressive",
        }
    }
}

/// `local_port` and `noize_profile` ARE user-configurable via CLI flags
/// (`--bind`, `--noize`) even though neither is one of the three interactive
/// prompts (protocol / scan mode / IP version) Aether's own setup asks —
/// they just need to be passed up front to skip being asked at all.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct ConnectionProfile {
    pub protocol: Protocol,
    pub scan_mode: ScanMode,
    pub ip_version: IpVersion,
    /// Local SOCKS5 listen port, passed as `--bind 127.0.0.1:<port>`.
    /// `serde(default)` keeps profiles saved before this field existed
    /// loading cleanly, falling back to Aether's own default of 1819.
    #[serde(default = "default_local_port")]
    pub local_port: u16,
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
    /// Traffic obfuscation profile (`--noize`). Aether's own default when
    /// unset is "balanced", so that's ours too — this field only changes
    /// the command line when the user picks something else.
    #[serde(default = "default_noize_profile")]
    pub noize_profile: NoizeProfile,
    /// Fragments the TLS ClientHello on the HTTP/2 transport (`--fragment`).
    /// Only has an effect together with `masque_http2` — Aether ignores it
    /// otherwise, since HTTP/3 has no TLS ClientHello of its own to
    /// fragment. Off by default: it adds latency to the handshake, so it's
    /// an opt-in for networks that specifically need it.
    #[serde(default)]
    pub fragment_enabled: bool,
}

fn default_true() -> bool {
    true
}

fn default_local_port() -> u16 {
    1819
}

fn default_noize_profile() -> NoizeProfile {
    NoizeProfile::Balanced
}

impl ConnectionProfile {
    /// CLI flags for Aether ≥1.1.1 — the whole profile is passed up front so
    /// the interactive prompts never appear (the PTY prompt-answering in
    /// pty.rs stays as a fallback). One of the two quick-reconnect flags is
    /// ALWAYS passed: without either, 1.1.1 asks its own interactive
    /// "reconnect with last gateway?" question, which the GUI must never
    /// leave unanswered.
    pub fn as_args(&self) -> Vec<String> {
        let mut args: Vec<String> = Vec::with_capacity(6);
        match self.protocol {
            Protocol::Auto => {} // Aether's own default (MASQUE)
            Protocol::Masque => args.push("--masque".into()),
            Protocol::Wireguard => args.push("--wg".into()),
            Protocol::Gool => args.push("--gool".into()),
        }
        args.push(
            match self.scan_mode {
                ScanMode::Turbo => "--turbo",
                ScanMode::Balanced => "--balanced",
                ScanMode::Thorough => "--thorough",
                ScanMode::Stealth => "--stealth",
            }
            .into(),
        );
        args.push(
            match self.ip_version {
                IpVersion::V4 => "-4",
                IpVersion::V6 => "-6",
                IpVersion::Both => "--dual",
            }
            .into(),
        );
        args.push(
            if self.quick_reconnect { "--quick-reconnect" } else { "--no-quick-reconnect" }.into(),
        );
        // Only pass --bind when it differs from Aether's own default, so a
        // stock profile's spawned command line stays identical to before
        // this field existed.
        if self.local_port != default_local_port() {
            args.push("--bind".into());
            args.push(format!("127.0.0.1:{}", self.local_port));
        }
        // Only pass --noize when it's not Aether's own default, same
        // reasoning as --bind above.
        if self.noize_profile != default_noize_profile() {
            args.push("--noize".into());
            args.push(self.noize_profile.label().into());
        }
        if self.fragment_enabled {
            args.push("--fragment".into());
        }
        args
    }

    /// e.g. "wireguard+turbo+ipv4" — shown in the status line, tray tooltip,
    /// and the connected notification so the user can see at a glance what
    /// they're actually running, without opening Advanced.
    pub fn summary(&self) -> String {
        format!("{}+{}+{}", self.protocol.label(), self.scan_mode.label(), self.ip_version.label())
    }
}

impl Default for ConnectionProfile {
    fn default() -> Self {
        // Mirrors Aether's own defaults.
        Self {
            protocol: Protocol::Auto,
            scan_mode: ScanMode::Balanced,
            ip_version: IpVersion::V4,
            local_port: default_local_port(),
            quick_reconnect: true,
            masque_http2: false,
            noize_profile: default_noize_profile(),
            fragment_enabled: false,
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