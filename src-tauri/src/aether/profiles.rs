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

/// Obfuscation profile for MASQUE connections. The profile shapes how much
/// junk/padding Aether injects to disguise the handshake from DPI.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MasqueNoize {
    Firewall,
    Gfw,
    Off,
}

impl MasqueNoize {
    pub fn as_flag(&self) -> &'static str {
        match self {
            MasqueNoize::Firewall => "firewall",
            MasqueNoize::Gfw => "gfw",
            MasqueNoize::Off => "off",
        }
    }
}

/// Obfuscation profile for WireGuard and gool connections.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WgNoize {
    Balanced,
    Aggressive,
    Light,
    Off,
}

impl WgNoize {
    pub fn as_flag(&self) -> &'static str {
        match self {
            WgNoize::Balanced => "balanced",
            WgNoize::Aggressive => "aggressive",
            WgNoize::Light => "light",
            WgNoize::Off => "off",
        }
    }
}

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
    /// Obfuscation profile for MASQUE (firewall/gfw/off). Passed as
    /// `--noize <value>`. Only sent when the active protocol is MASQUE-based.
    #[serde(default = "default_masque_noize")]
    pub masque_noize: MasqueNoize,
    /// Obfuscation profile for WireGuard/gool (balanced/aggressive/light/off).
    /// Only sent when the active protocol is WireGuard or gool.
    #[serde(default = "default_wg_noize")]
    pub wg_noize: WgNoize,
    /// Local SOCKS5 listen address (`--bind`). Aether defaults to
    /// 127.0.0.1:1819; users can change the port or bind to 0.0.0.0 for LAN.
    #[serde(default = "default_bind_address")]
    pub bind_address: String,
    /// Aether ≥1.5.0: optional resolvers used *inside* the tunnel. Kept as
    /// Aether's comma-separated CLI format, for example `1.1.1.1,1.0.0.1`.
    #[serde(default)]
    pub dns: String,
    /// Aether ≥1.5.0: Cloudflare Zero Trust organization name. An empty
    /// value means the normal consumer WARP flow.
    #[serde(default)]
    pub zero_trust_team: String,
    /// Which Zero Trust credential field is active in the GUI. This controls
    /// what is handed to the core, rather than being a core flag itself.
    #[serde(default)]
    pub zero_trust_auth: ZeroTrustAuth,
    /// Email used for Cloudflare Access one-time-code sign-in. Sensitive
    /// values are erased before the successful profile is persisted.
    #[serde(default)]
    pub access_email: String,
    /// Cloudflare Access service-token client id.
    #[serde(default)]
    pub access_client_id: String,
    /// Cloudflare Access service-token secret.
    #[serde(default)]
    pub access_client_secret: String,
    /// A pre-obtained Cloudflare Access enrolment JWT.
    #[serde(default)]
    pub access_token: String,
    /// Route HTTP/HTTPS through the organization's Gateway proxy. This is
    /// intentionally off by default because the organization can log it.
    #[serde(default)]
    pub zero_trust_gateway: bool,
    /// Aether ≥1.5.0 routing lists. Entries are comma/newline separated in
    /// the same format accepted by `--route-block` and `--route-direct`.
    #[serde(default)]
    pub route_block: String,
    #[serde(default)]
    pub route_direct: String,
    /// Optional path to an Aether routing file with [block]/[direct] sections.
    #[serde(default)]
    pub routes_file: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum ZeroTrustAuth {
    #[default]
    Email,
    Service,
    Token,
}

fn default_true() -> bool {
    true
}

fn default_masque_noize() -> MasqueNoize {
    MasqueNoize::Firewall
}

fn default_wg_noize() -> WgNoize {
    WgNoize::Balanced
}

fn default_bind_address() -> String {
    "127.0.0.1:1819".into()
}

impl ConnectionProfile {
    /// CLI flags for Aether ≥1.1.1 — the whole profile is passed up front so
    /// the interactive prompts never appear (the PTY prompt-answering in
    /// pty.rs stays as a fallback). One of the two quick-reconnect flags is
    /// ALWAYS passed: without either, 1.1.1 asks its own interactive
    /// "reconnect with last gateway?" question, which the GUI must never
    /// leave unanswered.
    pub fn as_args(&self) -> Vec<String> {
        let mut args = Vec::with_capacity(20);
        match self.protocol {
            Protocol::Auto => {}
            Protocol::Masque => args.push("--masque".into()),
            Protocol::Wireguard => args.push("--wg".into()),
            Protocol::Gool => args.push("--gool".into()),
        }
        args.push(match self.scan_mode {
            ScanMode::Turbo => "--turbo".into(),
            ScanMode::Balanced => "--balanced".into(),
            ScanMode::Thorough => "--thorough".into(),
            ScanMode::Stealth => "--stealth".into(),
            ScanMode::Ironclad => "--ironclad".into(),
        });
        args.push(match self.ip_version {
            IpVersion::V4 => "-4".into(),
            IpVersion::V6 => "-6".into(),
            IpVersion::Both => "--dual".into(),
        });
        args.push(if self.quick_reconnect {
            "--quick-reconnect".into()
        } else {
            "--no-quick-reconnect".into()
        });
        // Noize profile — pick the value matching the active protocol family.
        args.push("--noize".into());
        args.push(
            match self.protocol {
                Protocol::Auto | Protocol::Masque => self.masque_noize.as_flag(),
                Protocol::Wireguard | Protocol::Gool => self.wg_noize.as_flag(),
            }
            .into(),
        );
        // Only forward --bind when non-default and parseable.
        if self.bind_address != default_bind_address()
            && self.bind_address.parse::<std::net::SocketAddr>().is_ok()
        {
            args.push("--bind".into());
            args.push(self.bind_address.clone());
        }
        if !self.dns.trim().is_empty() {
            args.push("--dns".into());
            args.push(self.dns.trim().into());
        }
        if !self.zero_trust_team.trim().is_empty() {
            args.push("--team".into());
            args.push(self.zero_trust_team.trim().into());
            if self.zero_trust_gateway {
                args.push("--gateway".into());
            }
        }
        if !self.route_block.trim().is_empty() {
            args.push("--route-block".into());
            args.push(self.route_block.trim().into());
        }
        if !self.route_direct.trim().is_empty() {
            args.push("--route-direct".into());
            args.push(self.route_direct.trim().into());
        }
        if !self.routes_file.trim().is_empty() {
            args.push("--routes".into());
            args.push(self.routes_file.trim().into());
        }
        args
    }

    /// The core accepts Zero Trust credentials as flags too, but putting a
    /// JWT or service secret in the process command line exposes it to other
    /// local processes. pty.rs supplies the selected credential as an env var
    /// instead, and this method ensures only that one method is ever sent.
    pub fn zero_trust_env(&self) -> Option<(&'static str, &str)> {
        if self.zero_trust_team.trim().is_empty() {
            return None;
        }
        match self.zero_trust_auth {
            ZeroTrustAuth::Email if !self.access_email.trim().is_empty() => {
                Some(("AETHER_ACCESS_EMAIL", self.access_email.trim()))
            }
            ZeroTrustAuth::Service
                if !self.access_client_id.trim().is_empty()
                    && !self.access_client_secret.trim().is_empty() =>
            {
                // The id and secret need separate variables, so this method
                // cannot represent service credentials. pty.rs handles that
                // pair directly after consulting `zero_trust_auth`.
                None
            }
            ZeroTrustAuth::Token if !self.access_token.trim().is_empty() => {
                Some(("AETHER_ACCESS_TOKEN", self.access_token.trim()))
            }
            _ => None,
        }
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
            masque_noize: MasqueNoize::Firewall,
            wg_noize: WgNoize::Balanced,
            bind_address: default_bind_address(),
            dns: String::new(),
            zero_trust_team: String::new(),
            zero_trust_auth: ZeroTrustAuth::Email,
            access_email: String::new(),
            access_client_id: String::new(),
            access_client_secret: String::new(),
            access_token: String::new(),
            zero_trust_gateway: false,
            route_block: String::new(),
            route_direct: String::new(),
            routes_file: String::new(),
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
        // A successful connection profile is useful to remember, but Access
        // credentials are not. Leave them in process memory only; the next
        // app launch will ask for them again rather than writing a JWT,
        // service secret or email address into profile.json.
        let mut persisted = profile.clone();
        persisted.access_email.clear();
        persisted.access_client_id.clear();
        persisted.access_client_secret.clear();
        persisted.access_token.clear();
        if let Ok(value) = serde_json::to_value(persisted) {
            store.set(STORE_KEY, value);
            let _ = store.save();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_omits_bind_flag() {
        let p = ConnectionProfile::default();
        let args = p.as_args();
        assert!(!args.iter().any(|a| a == "--bind"), "args={args:?}");
    }

    #[test]
    fn custom_port_emits_bind() {
        let p = ConnectionProfile {
            bind_address: "127.0.0.1:1919".into(),
            ..Default::default()
        };
        let args = p.as_args();
        let i = args
            .iter()
            .position(|a| a == "--bind")
            .expect("missing --bind");
        assert_eq!(args.get(i + 1).map(String::as_str), Some("127.0.0.1:1919"));
    }

    #[test]
    fn lan_bind_emits_bind() {
        let p = ConnectionProfile {
            bind_address: "0.0.0.0:1819".into(),
            ..Default::default()
        };
        let args = p.as_args();
        let i = args
            .iter()
            .position(|a| a == "--bind")
            .expect("missing --bind");
        assert_eq!(args.get(i + 1).map(String::as_str), Some("0.0.0.0:1819"));
    }

    #[test]
    fn lan_with_custom_port_emits_bind() {
        let p = ConnectionProfile {
            bind_address: "0.0.0.0:9999".into(),
            ..Default::default()
        };
        let args = p.as_args();
        let i = args
            .iter()
            .position(|a| a == "--bind")
            .expect("missing --bind");
        assert_eq!(args.get(i + 1).map(String::as_str), Some("0.0.0.0:9999"));
    }

    #[test]
    fn invalid_bind_is_not_forwarded() {
        let p = ConnectionProfile {
            bind_address: "127.0.0.1:".into(),
            ..Default::default()
        };
        let args = p.as_args();
        assert!(!args.iter().any(|a| a == "--bind"), "args={args:?}");
    }

    #[test]
    fn old_profile_json_gets_defaults() {
        let json = r#"{"protocol":"auto","scan_mode":"balanced","ip_version":"v4","quick_reconnect":true,"masque_http2":false}"#;
        let p: ConnectionProfile = serde_json::from_str(json).unwrap();
        assert_eq!(p.bind_address, "127.0.0.1:1819");
        assert_eq!(p.masque_noize, MasqueNoize::Firewall);
    }

    #[test]
    fn default_emits_noize() {
        let p = ConnectionProfile::default();
        let args = p.as_args();
        let i = args
            .iter()
            .position(|a| a == "--noize")
            .expect("missing --noize");
        assert_eq!(args.get(i + 1).map(String::as_str), Some("firewall"));
    }

    #[test]
    fn v150_options_emit_without_credentials() {
        let p = ConnectionProfile {
            dns: "9.9.9.9,1.1.1.1".into(),
            zero_trust_team: "acme".into(),
            zero_trust_gateway: true,
            route_block: "ads.example".into(),
            route_direct: "private".into(),
            routes_file: "C:/routes.txt".into(),
            ..Default::default()
        };
        assert_eq!(
            p.as_args(),
            vec![
                "--balanced",
                "-4",
                "--quick-reconnect",
                "--noize",
                "firewall",
                "--dns",
                "9.9.9.9,1.1.1.1",
                "--team",
                "acme",
                "--gateway",
                "--route-block",
                "ads.example",
                "--route-direct",
                "private",
                "--routes",
                "C:/routes.txt"
            ]
        );
    }

    #[test]
    fn zero_trust_email_is_provided_as_an_environment_value() {
        let p = ConnectionProfile {
            zero_trust_team: "acme".into(),
            access_email: "me@example.com".into(),
            ..Default::default()
        };
        assert_eq!(
            p.zero_trust_env(),
            Some(("AETHER_ACCESS_EMAIL", "me@example.com"))
        );
        assert!(!p.as_args().iter().any(|arg| arg.contains("me@example.com")));
    }
}
