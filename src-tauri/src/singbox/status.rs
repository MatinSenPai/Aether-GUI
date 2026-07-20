use std::time::Duration;

/// Address of the sing-box TUN interface (for display purposes).
pub const TUN_ADDR: &str = "172.19.0.1";

/// How long to wait for the TUN interface to become reachable after sing-box
/// starts. TUN setup involves driver initialization which can take a moment.
pub const TUN_STARTUP_TIMEOUT: Duration = Duration::from_secs(20);

/// How long to wait after spawning sing-box before considering the TUN live.
/// If the process stays alive this long without crashing, the TUN is up.
pub const TUN_SETTLE_TIME: Duration = Duration::from_secs(3);
