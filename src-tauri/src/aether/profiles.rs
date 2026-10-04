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
    /// Aether ≥2.0.0 MASQUE-in-MASQUE: two MASQUE hops for a different exit.
    Mim,
}

impl Protocol {
    /// The literal menu choice Aether expects at its "Protocol:" prompt.
    pub fn as_menu_choice(&self) -> &'static str {
        match self {
            Protocol::Auto | Protocol::Masque => "1",
            Protocol::Wireguard => "2",
            Protocol::Gool => "3",
            Protocol::Mim => "4",
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ScanMode {
    Turbo,
    Balanced,
    Thorough,
    /// Called `stealth` before Aether 1.x's rename; the core still accepts
    /// both names. `alias` keeps profiles saved by older GUIs loading.
    #[serde(alias = "stealth")]
    Verified,
    Ironclad,
}

impl ScanMode {
    pub fn as_menu_choice(&self) -> &'static str {
        match self {
            ScanMode::Turbo => "1",
            ScanMode::Balanced => "2",
            ScanMode::Thorough => "3",
            ScanMode::Verified => "4",
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

/// Aether >=2.0.0 (Tor) / >=2.1.0 (Psiphon): optionally carry Tor or Psiphon.
/// `*Only` runs it with no WARP tunnel (the SOCKS5 proxy on `--bind` is plain
/// Tor/Psiphon); `*Chain` carries it inside the tunnel (a second proxy comes
/// out of Tor/Psiphon); `*Reverse` dials the tunnel through it, so WARP is
/// reached from a Tor/Psiphon exit.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum NetworkMode {
    #[default]
    Warp,
    PsiphonOnly,
    TorOnly,
    PsiphonChain,
    TorChain,
    PsiphonReverse,
    TorReverse,
}

pub const TOR_BIND: &str = "127.0.0.1:1820";
pub const PSIPHON_BIND: &str = "127.0.0.1:1821";
/// Local HTTP proxy used for the system proxy when the user hasn't set one.
pub const SYSTEM_PROXY_BIND: &str = "127.0.0.1:1822";

impl NetworkMode {
    pub fn flag(&self) -> Option<&'static str> {
        match self {
            NetworkMode::Warp => None,
            NetworkMode::PsiphonOnly => Some("--psiphon-only"),
            NetworkMode::TorOnly => Some("--tor-only"),
            NetworkMode::PsiphonChain => Some("--psiphon"),
            NetworkMode::TorChain => Some("--tor"),
            NetworkMode::PsiphonReverse => Some("--psiphon-reverse"),
            NetworkMode::TorReverse => Some("--tor-reverse"),
        }
    }

    pub fn is_psiphon(&self) -> bool {
        matches!(
            self,
            NetworkMode::PsiphonOnly | NetworkMode::PsiphonChain | NetworkMode::PsiphonReverse
        )
    }

    pub fn is_tor(&self) -> bool {
        matches!(
            self,
            NetworkMode::TorOnly | NetworkMode::TorChain | NetworkMode::TorReverse
        )
    }

    /// No WARP tunnel underneath: protocol, scan mode and noize don't apply.
    pub fn is_only(&self) -> bool {
        matches!(self, NetworkMode::PsiphonOnly | NetworkMode::TorOnly)
    }

    /// Reverse modes refuse WireGuard/gool and always run MASQUE over HTTP/2.
    pub fn is_reverse(&self) -> bool {
        matches!(self, NetworkMode::PsiphonReverse | NetworkMode::TorReverse)
    }

    /// The extra proxy Tor/Psiphon opens next to `--bind` (chain/reverse).
    fn extra_bind(&self) -> Option<&'static str> {
        match self {
            NetworkMode::TorChain | NetworkMode::TorReverse => Some(TOR_BIND),
            NetworkMode::PsiphonChain | NetworkMode::PsiphonReverse => Some(PSIPHON_BIND),
            _ => None,
        }
    }

    /// Extra seconds the GUI should wait on top of the scan budget: Tor may
    /// try plainly (75s) and then walk through bridges (up to 360s each);
    /// Psiphon waits up to 180s to tunnel.
    pub fn extra_wait_secs(&self) -> u64 {
        if self.is_tor() {
            480
        } else if self.is_psiphon() {
            200
        } else {
            0
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
    /// Aether ≥1.6.0: also serve an HTTP CONNECT proxy on this address.
    #[serde(default)]
    pub http_proxy: String,
    /// Aether ≥1.7.0: dial out through another proxy (`socks5://host:port`,
    /// `http://host:port`, or bare `host:port`).
    #[serde(default)]
    pub upstream: String,
    /// Aether ≥2.1.0: exit-country filter, e.g. `!IR,RU` or `DE,SE`.
    #[serde(default)]
    pub exit_loc: String,
    /// Aether >=2.0.0: carry Tor/Psiphon (see [`NetworkMode`]).
    #[serde(default)]
    pub network_mode: NetworkMode,
    /// Aether >=2.1.0: ask Psiphon to leave from this country, e.g. `DE`.
    #[serde(default)]
    pub psiphon_region: String,
    /// Point the OS-wide proxy setting at the tunnel while connected. This
    /// uses Aether's HTTP CONNECT listener, which every OS proxy setting
    /// understands (SOCKS support in system settings is patchy).
    #[serde(default)]
    pub system_proxy: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum ZeroTrustAuth {
    #[default]
    Email,
    Service,
    Token,
}

fn is_country_code(s: &str) -> bool {
    let s = s.trim();
    s.len() == 2 && s.chars().all(|c| c.is_ascii_alphabetic())
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
        // Reverse modes carry only TCP, so the core refuses WireGuard/gool.
        let protocol = if self.network_mode.is_reverse()
            && matches!(self.protocol, Protocol::Wireguard | Protocol::Gool)
        {
            &Protocol::Masque
        } else {
            &self.protocol
        };
        match protocol {
            Protocol::Auto => {}
            Protocol::Masque => args.push("--masque".into()),
            Protocol::Wireguard => args.push("--wg".into()),
            Protocol::Gool => args.push("--gool".into()),
            Protocol::Mim => args.push("--mim".into()),
        }
        if let Some(flag) = self.network_mode.flag() {
            args.push(flag.into());
            if self.network_mode.is_psiphon() && is_country_code(&self.psiphon_region) {
                args.push("--psiphon-region".into());
                args.push(self.psiphon_region.trim().to_ascii_uppercase());
            }
        }
        args.push(match self.scan_mode {
            ScanMode::Turbo => "--turbo".into(),
            ScanMode::Balanced => "--balanced".into(),
            ScanMode::Thorough => "--thorough".into(),
            ScanMode::Verified => "--verified".into(),
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
            match protocol {
                Protocol::Auto | Protocol::Masque | Protocol::Mim => self.masque_noize.as_flag(),
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
        if let Some(addr) = self.http_front() {
            args.push(self.http_front_flag().into());
            args.push(addr.to_string());
        }
        if !self.upstream.trim().is_empty() {
            args.push("--upstream".into());
            args.push(self.upstream.trim().into());
        }
        if !self.exit_loc.trim().is_empty() {
            args.push("--exit-loc".into());
            args.push(self.exit_loc.trim().into());
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

    /// The HTTP CONNECT address to serve next to the primary SOCKS5 proxy:
    /// the user's own, or a default when the system proxy needs one.
    pub fn http_front(&self) -> Option<std::net::SocketAddr> {
        self.http_proxy.trim().parse().ok().or_else(|| {
            self.system_proxy
                .then(|| SYSTEM_PROXY_BIND.parse().unwrap())
        })
    }

    /// Each Tor/Psiphon chain has its own HTTP flag; plain and reverse modes
    /// serve HTTP from the WARP proxy.
    fn http_front_flag(&self) -> &'static str {
        match self.network_mode {
            NetworkMode::PsiphonOnly | NetworkMode::PsiphonChain => "--psiphon-http",
            NetworkMode::TorOnly | NetworkMode::TorChain => "--tor-http",
            _ => "--http-proxy",
        }
    }

    /// Ports that must answer before the GUI reports connected. The HTTP
    /// front is not among them: it is a convenience, never a reason to wait.
    pub fn ready_addrs(&self) -> Vec<std::net::SocketAddr> {
        let mut out = vec![crate::aether::status::parse_bind_address(
            &self.bind_address,
        )];
        out.extend(
            self.network_mode
                .extra_bind()
                .and_then(|a| a.parse::<std::net::SocketAddr>().ok()),
        );
        out
    }

    /// The SOCKS5 address a user should point apps at. In a chain that is the
    /// Tor/Psiphon proxy (`--bind` keeps the plain WARP exit); otherwise it
    /// is `--bind`.
    pub fn primary_addr(&self) -> String {
        match self.network_mode {
            NetworkMode::TorChain => TOR_BIND.into(),
            NetworkMode::PsiphonChain => PSIPHON_BIND.into(),
            _ => self.bind_address.clone(),
        }
    }

    /// Every local port Aether must have open before the GUI calls it
    /// connected, and must be free before launching.
    pub fn listen_addrs(&self) -> Vec<std::net::SocketAddr> {
        let mut out = self.ready_addrs();
        out.extend(self.http_front());
        out
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
            http_proxy: String::new(),
            upstream: String::new(),
            exit_loc: String::new(),
            network_mode: NetworkMode::Warp,
            psiphon_region: String::new(),
            system_proxy: false,
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
    fn v2_options_emit_flags() {
        let p = ConnectionProfile {
            protocol: Protocol::Mim,
            scan_mode: ScanMode::Verified,
            http_proxy: "127.0.0.1:1820".into(),
            upstream: "socks5://127.0.0.1:1080".into(),
            exit_loc: "!IR,RU".into(),
            ..Default::default()
        };
        assert_eq!(
            p.as_args(),
            vec![
                "--mim",
                "--verified",
                "-4",
                "--quick-reconnect",
                "--noize",
                "firewall",
                "--http-proxy",
                "127.0.0.1:1820",
                "--upstream",
                "socks5://127.0.0.1:1080",
                "--exit-loc",
                "!IR,RU"
            ]
        );
    }

    #[test]
    fn invalid_http_proxy_is_not_forwarded() {
        let p = ConnectionProfile {
            http_proxy: "1820".into(),
            ..Default::default()
        };
        assert!(!p.as_args().iter().any(|a| a == "--http-proxy"));
    }

    #[test]
    fn legacy_stealth_profile_loads_as_verified() {
        let json = r#"{"protocol":"auto","scan_mode":"stealth","ip_version":"v4"}"#;
        let p: ConnectionProfile = serde_json::from_str(json).unwrap();
        assert_eq!(p.scan_mode, ScanMode::Verified);
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

    fn mode(network_mode: NetworkMode) -> ConnectionProfile {
        ConnectionProfile {
            network_mode,
            ..Default::default()
        }
    }

    #[test]
    fn network_modes_emit_their_flag() {
        for (m, flag) in [
            (NetworkMode::PsiphonOnly, "--psiphon-only"),
            (NetworkMode::TorOnly, "--tor-only"),
            (NetworkMode::PsiphonChain, "--psiphon"),
            (NetworkMode::TorChain, "--tor"),
            (NetworkMode::PsiphonReverse, "--psiphon-reverse"),
            (NetworkMode::TorReverse, "--tor-reverse"),
        ] {
            assert!(mode(m).as_args().iter().any(|a| a == flag), "{flag}");
        }
        assert!(!mode(NetworkMode::Warp)
            .as_args()
            .iter()
            .any(|a| a.contains("tor")));
    }

    #[test]
    fn reverse_mode_never_sends_wireguard_or_gool() {
        let p = ConnectionProfile {
            protocol: Protocol::Gool,
            network_mode: NetworkMode::TorReverse,
            ..Default::default()
        };
        let args = p.as_args();
        assert!(args.contains(&"--masque".to_string()));
        assert!(!args.contains(&"--gool".to_string()));
    }

    #[test]
    fn psiphon_region_only_with_psiphon_and_valid_code() {
        let with = |mode, region: &str| ConnectionProfile {
            network_mode: mode,
            psiphon_region: region.into(),
            ..Default::default()
        };
        let args = with(NetworkMode::PsiphonOnly, " de ").as_args();
        let i = args.iter().position(|a| a == "--psiphon-region").unwrap();
        assert_eq!(args[i + 1], "DE");
        assert!(!with(NetworkMode::PsiphonOnly, "germany")
            .as_args()
            .contains(&"--psiphon-region".into()));
        assert!(!with(NetworkMode::TorOnly, "DE")
            .as_args()
            .contains(&"--psiphon-region".into()));
    }

    #[test]
    fn system_proxy_asks_the_core_for_an_http_front() {
        let p = ConnectionProfile {
            system_proxy: true,
            ..Default::default()
        };
        let args = p.as_args();
        let i = args.iter().position(|a| a == "--http-proxy").unwrap();
        assert_eq!(args[i + 1], SYSTEM_PROXY_BIND);
        // Psiphon chains have their own HTTP flag.
        let p = ConnectionProfile {
            system_proxy: true,
            network_mode: NetworkMode::PsiphonOnly,
            ..Default::default()
        };
        assert!(p.as_args().contains(&"--psiphon-http".to_string()));
        // A user-chosen address wins over the default.
        let p = ConnectionProfile {
            system_proxy: true,
            http_proxy: "127.0.0.1:2000".into(),
            ..Default::default()
        };
        assert_eq!(p.http_front(), Some("127.0.0.1:2000".parse().unwrap()));
    }

    #[test]
    fn chain_modes_wait_for_both_proxies_and_point_at_the_extra_one() {
        let p = mode(NetworkMode::TorChain);
        assert_eq!(p.ready_addrs().len(), 2);
        assert_eq!(p.primary_addr(), TOR_BIND);
        let p = mode(NetworkMode::PsiphonOnly);
        assert_eq!(p.ready_addrs().len(), 1);
        assert_eq!(p.primary_addr(), "127.0.0.1:1819");
        // the HTTP front is checked for being free, but never waited on
        let p = ConnectionProfile {
            system_proxy: true,
            ..Default::default()
        };
        assert_eq!(p.ready_addrs().len(), 1);
        assert_eq!(p.listen_addrs().len(), 2);
    }

    #[test]
    fn old_profile_json_defaults_to_plain_warp() {
        let json = r#"{"protocol":"auto","scan_mode":"balanced","ip_version":"v4"}"#;
        let p: ConnectionProfile = serde_json::from_str(json).unwrap();
        assert_eq!(p.network_mode, NetworkMode::Warp);
        assert!(!p.system_proxy);
    }
}
