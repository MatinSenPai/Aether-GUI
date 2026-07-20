use crate::aether::AetherManager;
use crate::singbox::SingboxManager;
use serde::Serialize;
use std::sync::{Arc, Mutex};

/// Mirrors the state machine in the approved plan: Idle -> Launching (PTY
/// spawned, answering prompts) -> Connecting (prompts done, waiting on the
/// SOCKS5 port to come alive) -> Connected -> Tunneling (if sing-box TUN
/// enabled). Any abnormal exit or timeout goes to Error rather than a
/// separate Disconnected state — a clean user-requested stop returns to
/// Idle instead.
///
/// `Reconnecting` is the one addition: an unexpected exit or timeout that
/// wasn't user-requested retries automatically (see aether/mod.rs's
/// `handle_unexpected_failure`) rather than dropping straight to Error —
/// this is the brief backoff wait before a fresh Launching begins, shown
/// distinctly so the user knows it's a retry, not a first attempt.
#[derive(Serialize, Clone, Debug)]
#[serde(tag = "state")]
pub enum ConnectionState {
    Idle,
    Launching,
    Connecting,
    /// `connected_at_ms` is an absolute UNIX-epoch timestamp (ms) rather than
    /// a pre-computed elapsed duration, so the frontend can render a live-
    /// updating session timer without needing another event from the backend.
    Connected { socks_addr: String, connected_at_ms: u64 },
    /// sing-box TUN is active — all system traffic routes through the tunnel.
    Tunneling { tun_addr: String, socks_addr: String, connected_at_ms: u64 },
    Reconnecting { attempt: u32, max_attempts: u32 },
    Disconnecting,
    Error { message: String, phase: String },
}

pub struct AppState {
    pub manager: Arc<Mutex<AetherManager>>,
    pub singbox: Arc<Mutex<SingboxManager>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            manager: Arc::new(Mutex::new(AetherManager::new())),
            singbox: Arc::new(Mutex::new(SingboxManager::new())),
        }
    }
}
