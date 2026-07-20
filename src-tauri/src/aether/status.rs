use super::profiles::{MasqueNoize, Protocol, ScanMode, WgNoize};
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

pub const SOCKS_PORT: u16 = 1819;

pub fn socks_addr() -> SocketAddr {
    SocketAddr::from(([127, 0, 0, 1], SOCKS_PORT))
}

/// Ground-truth "are we connected" signal: try to open a TCP connection to
/// Aether's local SOCKS5 port. This is immune to Aether changing its log
/// wording across releases, which is the actual fragility PTY-automation
/// accepts (see the approved plan) — log-line matching is only ever used to
/// fail fast / show a nicer message, never as the sole source of truth.
pub fn port_is_live() -> bool {
    TcpStream::connect_timeout(&socks_addr(), Duration::from_millis(300)).is_ok()
}

/// Aether's own route-discovery budget varies by scan mode and obfuscation
/// profile — ironclad opens a real tunnel through every candidate and heavier
/// noize profiles add decoy traffic and inter-packet delays, both stretching
/// the scan. The GUI's timeout must exceed the expected budget or it would
/// kill Aether while it's still legitimately scanning.
pub fn connect_timeout(scan_mode: &ScanMode, protocol: &Protocol, masque_noize: &MasqueNoize, wg_noize: &WgNoize) -> Duration {
    let base = match scan_mode {
        ScanMode::Turbo => 60u64,
        ScanMode::Balanced => 150,
        ScanMode::Thorough => 180,
        ScanMode::Stealth => 180,
        ScanMode::Ironclad => 240,
    };
    // Heavier obfuscation profiles pad handshakes and add inter-packet
    // delays, so scans take longer. Add a percentage on top of the base.
    let noize_extra_pct = match protocol {
        Protocol::Auto | Protocol::Masque => match masque_noize {
            MasqueNoize::Firewall => 0,
            MasqueNoize::Gfw => 25,
            MasqueNoize::Off => 0,
        },
        Protocol::Wireguard | Protocol::Gool => match wg_noize {
            WgNoize::Balanced => 0,
            WgNoize::Aggressive => 30,
            WgNoize::Light => 0,
            WgNoize::Off => 0,
        },
    };
    Duration::from_secs(base + base * noize_extra_pct / 100)
}

/// How long to wait after sending Ctrl-C before force-killing. Manually
/// testing shutdown against the real binary showed it does NOT exit quickly
/// on SIGINT (still alive 10+ seconds later) — but since v1 never elevates
/// or opens a TUN device, there is nothing at the OS level a hard kill would
/// leave dangling, so a short grace period followed by SIGKILL is the
/// expected common path here, not a rare fallback.
pub const GRACEFUL_SHUTDOWN_GRACE: Duration = Duration::from_secs(3);

/// Auto-retry policy for unexpected drops/timeouts (never for a
/// user-requested disconnect) — applies uniformly to every protocol, since
/// a sudden mid-session drop (observed in practice with gool, the most
/// fragile of the three: two nested WireGuard tunnels) is exactly as
/// disruptive on MASQUE or plain WireGuard. Backoff increases per attempt
/// rather than retrying immediately, on the theory that whatever caused the
/// drop (a flaky relay, a momentary network hiccup) is more likely to have
/// cleared given a moment, and to avoid hammering the same dead endpoint.
pub const MAX_AUTO_RETRIES: u32 = 3;
pub const RETRY_BACKOFF: [Duration; MAX_AUTO_RETRIES as usize] =
    [Duration::from_secs(2), Duration::from_secs(5), Duration::from_secs(10)];
