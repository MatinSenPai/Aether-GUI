use super::profiles::{MasqueNoize, Protocol, ScanMode, WgNoize};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream};
use std::time::Duration;

pub const DEFAULT_SOCKS_ADDR: &str = "127.0.0.1:1819";

pub fn parse_bind_address(addr: &str) -> SocketAddr {
    addr.parse().unwrap_or_else(|_| DEFAULT_SOCKS_ADDR.parse().unwrap())
}

/// When Aether listens on 0.0.0.0, we probe 127.0.0.1 instead.
fn probe_addr(listen: &SocketAddr) -> SocketAddr {
    if listen.ip().is_unspecified() {
        SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), listen.port())
    } else {
        *listen
    }
}

/// Ground-truth "are we connected" signal: TCP connect to SOCKS5 port.
pub fn port_is_live(addr: &SocketAddr) -> bool {
    TcpStream::connect_timeout(&probe_addr(addr), Duration::from_millis(300)).is_ok()
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{TcpListener, TcpStream};
    use std::thread;

    #[test]
    fn parse_valid_and_invalid() {
        assert_eq!(parse_bind_address("127.0.0.1:1919"), "127.0.0.1:1919".parse().unwrap());
        assert_eq!(parse_bind_address("0.0.0.0:1819"), "0.0.0.0:1819".parse().unwrap());
        assert_eq!(parse_bind_address("0.0.0.0:9999"), "0.0.0.0:9999".parse().unwrap());
        assert_eq!(parse_bind_address("127.0.0.1:"), DEFAULT_SOCKS_ADDR.parse().unwrap());
        assert_eq!(parse_bind_address("not-an-addr"), DEFAULT_SOCKS_ADDR.parse().unwrap());
    }

    #[test]
    fn probe_addr_rewrites_unspecified() {
        let any: SocketAddr = "0.0.0.0:1919".parse().unwrap();
        assert_eq!(probe_addr(&any), "127.0.0.1:1919".parse().unwrap());
        let loopback: SocketAddr = "127.0.0.1:1919".parse().unwrap();
        assert_eq!(probe_addr(&loopback), loopback);
    }

    #[test]
    fn port_is_live_detects_listener() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        thread::spawn(move || { let _ = listener.accept(); });
        assert!(port_is_live(&addr));
        let dead: SocketAddr = format!("127.0.0.1:{}", addr.port().wrapping_add(1).max(20000)).parse().unwrap();
        if TcpStream::connect_timeout(&dead, Duration::from_millis(50)).is_err() {
            assert!(!port_is_live(&dead));
        }
    }

    #[test]
    fn port_is_live_probes_loopback_when_bound_any() {
        let listener = TcpListener::bind("0.0.0.0:0").unwrap();
        let addr = listener.local_addr().unwrap();
        thread::spawn(move || { let _ = listener.accept(); });
        let any = SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), addr.port());
        assert!(port_is_live(&any), "should probe 127.0.0.1 when listen is 0.0.0.0");
    }

    #[test]
    fn connect_timeout_ironclad() {
        assert_eq!(
            connect_timeout(&ScanMode::Ironclad, &Protocol::Masque, &MasqueNoize::Firewall, &WgNoize::Balanced),
            Duration::from_secs(240)
        );
    }

    #[test]
    fn connect_timeout_gfw_adds_25pct() {
        assert_eq!(
            connect_timeout(&ScanMode::Balanced, &Protocol::Masque, &MasqueNoize::Gfw, &WgNoize::Balanced),
            Duration::from_secs(150 + 150 * 25 / 100)
        );
    }
}
