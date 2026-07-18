use crate::state::ConnectionState;

/// Single entry point, called from the same places as `tray::on_state_change`
/// (see aether/mod.rs). Enables the Windows system proxy the moment we enter
/// `Connected`, restores whatever the user had before the moment we leave
/// it (Idle, Error, or Reconnecting — a dropped connection means the SOCKS
/// port is dead, so the system proxy must stop pointing at it immediately
/// rather than staying set until a retry succeeds).
pub fn on_state_change(previous: &ConnectionState, new_state: &ConnectionState) {
    let was_connected = matches!(previous, ConnectionState::Connected { .. });
    let is_connected = matches!(new_state, ConnectionState::Connected { .. });

    if is_connected && !was_connected {
        if let ConnectionState::Connected { socks_addr, .. } = new_state {
            if let Some(port) = socks_addr.rsplit(':').next().and_then(|p| p.parse::<u16>().ok()) {
                imp::enable(port);
            }
        }
    } else if was_connected && !is_connected {
        imp::restore();
    }
}

/// Safety net for `RunEvent::Exit` (app.rs's `shutdown_blocking`), which kills
/// the Aether process directly without going through `on_state_change` —
/// there is no `ConnectionState` transition to hook on exit, so this must be
/// called unconditionally to guarantee the system proxy never survives
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

    pub fn enable(port: u16) {
        let mut saved = SAVED.lock().unwrap();
        // Already own it (e.g. a reconnect landed here before a matching
        // restore somehow ran) — don't overwrite the real original values
        // with our own already-modified ones.
        if saved.is_some() {
            return;
        }
        let Ok(key) = open_internet_settings() else { return };

        let previous = SavedProxyState {
            proxy_enable: key.get_value::<u32, _>("ProxyEnable").unwrap_or(0),
            proxy_server: key.get_value::<String, _>("ProxyServer").ok(),
            proxy_override: key.get_value::<String, _>("ProxyOverride").ok(),
        };

        let _ = key.set_value("ProxyEnable", &1u32);
        let _ = key.set_value("ProxyServer", &format!("socks=127.0.0.1:{port}"));
        // Preserve any existing bypass list; otherwise at least exempt
        // loopback/local traffic from being tunneled through ourselves.
        if previous.proxy_override.is_none() {
            let _ = key.set_value("ProxyOverride", &"<local>".to_string());
        }

        *saved = Some(previous);
        drop(saved);
        broadcast_settings_changed();
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
    pub fn enable(_port: u16) {}
    pub fn restore() {}
}
