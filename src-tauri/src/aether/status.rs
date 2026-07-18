use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

pub fn socks_addr(port: u16) -> SocketAddr {
    SocketAddr::from(([127, 0, 0, 1], port))
}

/// Ground-truth "are we connected" signal: try to open a TCP connection to
/// Aether's local SOCKS5 port. This is immune to Aether changing its log
/// wording across releases, which is the actual fragility PTY-automation
/// accepts (see the approved plan) — log-line matching is only ever used to
/// fail fast / show a nicer message, never as the sole source of truth.
pub fn port_is_live(port: u16) -> bool {
    TcpStream::connect_timeout(&socks_addr(port), Duration::from_millis(300)).is_ok()
}

/// Empirically (manually running v1.0.1 to completion), Aether's own route-
/// discovery budget goes up to 120s for MASQUE and 80s for WireGuard (its
/// own "budget=..." log line). The GUI's connect timeout must exceed both,
/// or it would fire while Aether is still legitimately scanning for a route.
pub const CONNECT_TIMEOUT: Duration = Duration::from_secs(150);

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