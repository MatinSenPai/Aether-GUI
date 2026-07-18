use crate::settings;
use crate::state::ConnectionState;
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

/// Emitted every time the *user's* system-proxy preference changes (from
/// either the main window's toggle or the tray's checkbox/Pause item) so
/// every surface — the window and the tray — stays in sync with whichever
/// one the user just touched. Not emitted on ordinary connect/disconnect,
/// since those don't change what the user asked for, only whether it's
/// currently possible to honor it.
pub const SYSTEM_PROXY_EVENT: &str = "aether://system-proxy";

#[derive(Serialize, Clone, Debug)]
pub struct SystemProxyPayload {
    pub enabled: bool,
}

/// What the OS proxy setting is actually doing right now, as opposed to
/// what the user asked for — the two can differ (e.g. wanted-on but no
/// tunnel up yet, or wanted-on but the registry write itself failed). This
/// is what the tray icon's color follows (see tray::category_for_proxy),
/// since "green" should mean traffic is really being routed through us,
/// not merely that the user flipped a switch.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProxyStatus {
    /// Not pointed at us right now — either the user turned it off, or
    /// there's no live tunnel to point it at. Not an error.
    Inactive,
    /// Successfully pointed the OS proxy at our local SOCKS5 port.
    Active,
    /// The user wants it on and a tunnel is up, but writing the registry
    /// value itself failed (e.g. permissions) — traffic is NOT protected.
    Error,
}

static LAST_STATUS: Mutex<ProxyStatus> = Mutex::new(ProxyStatus::Inactive);

pub fn current_status() -> ProxyStatus {
    *LAST_STATUS.lock().unwrap()
}

/// Pulls the SOCKS port out of `ConnectionState::Connected`, if we're in it.
fn connected_port(state: &ConnectionState) -> Option<u16> {
    match state {
        ConnectionState::Connected { socks_addr, .. } => {
            socks_addr.rsplit(':').next().and_then(|p| p.parse::<u16>().ok())
        }
        _ => None,
    }
}

/// The single place that decides whether the OS-level proxy should actually
/// be pointed at us right now: only when the tunnel is up *and* the user
/// wants it. Called after every connection-state transition (with the
/// user's stored preference) and after every user toggle/tray action (with
/// the tunnel's current state) — either input changing re-derives the same
/// answer, so the two can never drift out of sync. Returns the resulting
/// `ProxyStatus` so callers (and the tray icon) can reflect what actually
/// happened, not just what was requested.
fn apply(app: &AppHandle, conn_state: &ConnectionState, user_enabled: bool) -> ProxyStatus {
    let status = match connected_port(conn_state) {
        Some(port) if user_enabled => {
            if imp::enable(port) { ProxyStatus::Active } else { ProxyStatus::Error }
        }
        _ => {
            imp::restore();
            ProxyStatus::Inactive
        }
    };
    *LAST_STATUS.lock().unwrap() = status;
    crate::tray::sync_system_proxy(app, conn_state, user_enabled, status);
    status
}

/// Called from `aether::set_state_and_emit` (and the two other places a
/// transition happens without going through it) right after every
/// connection-state change. Re-applies using the user's saved preference —
/// a fresh connect while the toggle is off should stay off; a drop while
/// it's on must tear the proxy down immediately regardless.
pub fn on_state_change(app: &AppHandle, new_state: &ConnectionState) {
    let user_enabled = settings::load(app).system_proxy_enabled;
    apply(app, new_state, user_enabled);
}

/// Called from the `set_system_proxy_enabled` command and from the tray's
/// checkbox/Pause-Resume item. Persists the new preference, then re-applies
/// it against whatever the tunnel is doing right now, and notifies the
/// window so its toggle reflects a tray-driven change (or vice versa).
pub fn set_user_enabled(app: &AppHandle, conn_state: &ConnectionState, enabled: bool) {
    let mut stored = settings::load(app);
    stored.system_proxy_enabled = enabled;
    settings::save(app, &stored);

    apply(app, conn_state, enabled);

    let _ = app.emit(SYSTEM_PROXY_EVENT, SystemProxyPayload { enabled });
}

/// Safety net for `RunEvent::Exit` (app.rs's `shutdown_blocking`), which
/// kills the Aether process directly without going through `on_state_change`
/// — there is no `ConnectionState` transition to hook on exit, so this must
/// be called unconditionally to guarantee the system proxy never survives
/// pointing at a process that's about to disappear.
pub fn restore_if_active() {
    imp::restore();
}

#[cfg(windows)]
mod imp {
    use std::sync::Mutex;
    use winreg::enums::*;
    use winreg::RegKey;

    const SUBKEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Internet Settings";

    /// What the user's system proxy looked like before Aether-GUI touched
    /// it. `None` in a field means the value didn't exist at all (as
    /// opposed to existing-but-empty) — restore must delete it rather than
    /// write back an empty string, or a user who never had a proxy
    /// configured would end up with stray registry values after
    /// disconnecting.
    struct SavedProxyState {
        proxy_enable: u32,
        proxy_server: Option<String>,
        proxy_override: Option<String>,
    }

    // In-memory only (reset on every process start) — deliberately not
    // persisted to disk. `Some` means "we currently own the system proxy
    // setting and know what to restore it to"; populated once by `enable`
    // and taken (cleared) by `restore`, so a stray double-call of either
    // never clobbers or double-restores.
    static SAVED: Mutex<Option<SavedProxyState>> = Mutex::new(None);

    fn open_internet_settings() -> std::io::Result<RegKey> {
        RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(SUBKEY, KEY_READ | KEY_WRITE)
    }

    pub fn enable(port: u16) -> bool {
        let mut saved = SAVED.lock().unwrap();
        // Already own it (e.g. re-applying the same desired state after an
        // unrelated transition) — don't overwrite the real original values
        // with our own already-modified ones. Still worth re-writing the
        // port/server value in case it changed (a reconnect can land on a
        // different local port), so do that unconditionally before bailing.
        if let Some(_existing) = saved.as_ref() {
            let Ok(key) = open_internet_settings() else { return false };
            let ok = key.set_value("ProxyServer", &format!("socks=127.0.0.1:{port}")).is_ok();
            broadcast_settings_changed();
            return ok;
        }
        let Ok(key) = open_internet_settings() else { return false };

        let previous = SavedProxyState {
            proxy_enable: key.get_value::<u32, _>("ProxyEnable").unwrap_or(0),
            proxy_server: key.get_value::<String, _>("ProxyServer").ok(),
            proxy_override: key.get_value::<String, _>("ProxyOverride").ok(),
        };

        let enabled_ok = key.set_value("ProxyEnable", &1u32).is_ok();
        let server_ok = key.set_value("ProxyServer", &format!("socks=127.0.0.1:{port}")).is_ok();
        // Preserve any existing bypass list; otherwise at least exempt
        // loopback/local traffic from being tunneled through ourselves.
        if previous.proxy_override.is_none() {
            let _ = key.set_value("ProxyOverride", &"<local>".to_string());
        }

        *saved = Some(previous);
        drop(saved);
        broadcast_settings_changed();
        enabled_ok && server_ok
    }

    pub fn restore() {
        let mut saved = SAVED.lock().unwrap();
        let Some(previous) = saved.take() else { return }; // nothing to restore
        drop(saved);

        let Ok(key) = open_internet_settings() else { return };
        let _ = key.set_value("ProxyEnable", &previous.proxy_enable);

        match previous.proxy_server {
            Some(value) => {
                let _ = key.set_value("ProxyServer", &value);
            }
            None => {
                let _ = key.delete_value("ProxyServer");
            }
        }
        match previous.proxy_override {
            Some(value) => {
                let _ = key.set_value("ProxyOverride", &value);
            }
            None => {
                let _ = key.delete_value("ProxyOverride");
            }
        }

        broadcast_settings_changed();
    }

    /// Without this, apps that read the proxy config via WinINet (rather
    /// than re-reading the registry themselves) keep using the old settings
    /// until they're restarted.
    fn broadcast_settings_changed() {
        use windows_sys::Win32::Networking::WinInet::{
            InternetSetOptionW, INTERNET_OPTION_REFRESH, INTERNET_OPTION_SETTINGS_CHANGED,
        };
        unsafe {
            InternetSetOptionW(std::ptr::null_mut(), INTERNET_OPTION_SETTINGS_CHANGED, std::ptr::null_mut(), 0);
            InternetSetOptionW(std::ptr::null_mut(), INTERNET_OPTION_REFRESH, std::ptr::null_mut(), 0);
        }
    }
}

#[cfg(not(windows))]
mod imp {
    // System-wide proxy configuration is a Windows-Internet-Settings concept;
    // Aether-GUI's tray/autostart/notification story is Windows-first (see
    // main.rs), so non-Windows builds simply no-op here rather than
    // implementing the very different per-desktop-environment equivalents.
    pub fn enable(_port: u16) -> bool {
        true
    }
    pub fn restore() {}
}
