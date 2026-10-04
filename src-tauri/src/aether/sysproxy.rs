//! Points the OS-wide proxy setting at Aether's HTTP CONNECT listener while a
//! tunnel is up, and puts the previous setting back afterwards.
//!
//! Safety net: the previous setting is written to `sysproxy-backup.json`
//! before anything is changed. If the app dies while the proxy is set, the
//! next launch calls [`restore_stale`] so a dead proxy never strands the
//! user without internet.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager};

static APPLIED: AtomicBool = AtomicBool::new(false);

fn backup_file(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("sysproxy-backup.json")
}

pub fn apply(app: &AppHandle, addr: &SocketAddr) -> Result<(), String> {
    let backup = backup_file(app);
    // A backup left by an earlier crash holds the user's *real* settings;
    // never overwrite it with ours.
    if backup.exists() {
        platform::restore(&backup);
        let _ = std::fs::remove_file(&backup);
    }
    platform::apply(addr, &backup)?;
    APPLIED.store(true, Ordering::Relaxed);
    Ok(())
}

/// Cheap no-op unless this process applied the proxy.
pub fn restore(app: &AppHandle) {
    if APPLIED.swap(false, Ordering::Relaxed) {
        let backup = backup_file(app);
        platform::restore(&backup);
        let _ = std::fs::remove_file(&backup);
    }
}

/// Startup: undo a proxy a previous (crashed) run left behind.
pub fn restore_stale(app: &AppHandle) {
    let backup = backup_file(app);
    if backup.exists() {
        platform::restore(&backup);
        let _ = std::fs::remove_file(&backup);
    }
}

#[cfg(windows)]
mod platform {
    use super::*;
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE, REG_DWORD};
    use winreg::{RegKey, RegValue};

    const KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Internet Settings";

    fn notify() {
        use windows_sys::Win32::Networking::WinInet::InternetSetOptionW;
        // INTERNET_OPTION_SETTINGS_CHANGED, then INTERNET_OPTION_REFRESH:
        // makes running browsers re-read the proxy without a restart.
        unsafe {
            InternetSetOptionW(std::ptr::null(), 39, std::ptr::null(), 0);
            InternetSetOptionW(std::ptr::null(), 37, std::ptr::null(), 0);
        }
    }

    pub fn apply(addr: &SocketAddr, backup: &PathBuf) -> Result<(), String> {
        let key = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey_with_flags(KEY, KEY_READ | KEY_WRITE)
            .map_err(|e| e.to_string())?;
        let saved = serde_json::json!({
            "enable": key.get_value::<u32, _>("ProxyEnable").ok(),
            "server": key.get_value::<String, _>("ProxyServer").ok(),
            "override": key.get_value::<String, _>("ProxyOverride").ok(),
        });
        std::fs::write(backup, saved.to_string()).map_err(|e| e.to_string())?;
        key.set_value("ProxyServer", &addr.to_string())
            .map_err(|e| e.to_string())?;
        key.set_value("ProxyOverride", &"<local>")
            .map_err(|e| e.to_string())?;
        key.set_raw_value(
            "ProxyEnable",
            &RegValue {
                vtype: REG_DWORD,
                bytes: 1u32.to_le_bytes().to_vec(),
            },
        )
        .map_err(|e| e.to_string())?;
        notify();
        Ok(())
    }

    pub fn restore(backup: &PathBuf) {
        let Ok(text) = std::fs::read_to_string(backup) else {
            return;
        };
        let Ok(saved) = serde_json::from_str::<serde_json::Value>(&text) else {
            return;
        };
        let Ok(key) =
            RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(KEY, KEY_READ | KEY_WRITE)
        else {
            return;
        };
        let put = |name: &str, v: &serde_json::Value| match v {
            serde_json::Value::String(s) => {
                let _ = key.set_value(name, s);
            }
            _ => {
                let _ = key.delete_value(name);
            }
        };
        put("ProxyServer", &saved["server"]);
        put("ProxyOverride", &saved["override"]);
        let enable = saved["enable"].as_u64().unwrap_or(0) as u32;
        let _ = key.set_value("ProxyEnable", &enable);
        notify();
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::*;
    use std::process::Command;

    fn networksetup(args: &[&str]) -> Result<String, String> {
        let out = Command::new("networksetup")
            .args(args)
            .output()
            .map_err(|e| e.to_string())?;
        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).into_owned())
        } else {
            Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
        }
    }

    pub fn apply(addr: &SocketAddr, backup: &PathBuf) -> Result<(), String> {
        let listing = networksetup(&["-listallnetworkservices"])?;
        // First line is a notice; services starting with `*` are disabled.
        let services: Vec<String> = listing
            .lines()
            .skip(1)
            .filter(|l| !l.starts_with('*') && !l.is_empty())
            .map(String::from)
            .collect();
        std::fs::write(backup, serde_json::json!(services).to_string())
            .map_err(|e| e.to_string())?;
        let (host, port) = (addr.ip().to_string(), addr.port().to_string());
        for svc in &services {
            networksetup(&["-setwebproxy", svc, &host, &port])?;
            networksetup(&["-setsecurewebproxy", svc, &host, &port])?;
        }
        Ok(())
    }

    // ponytail: macOS restores to "proxy off", not to a previous manual proxy.
    pub fn restore(backup: &PathBuf) {
        let services: Vec<String> = std::fs::read_to_string(backup)
            .ok()
            .and_then(|t| serde_json::from_str(&t).ok())
            .unwrap_or_default();
        for svc in &services {
            let _ = networksetup(&["-setwebproxystate", svc, "off"]);
            let _ = networksetup(&["-setsecurewebproxystate", svc, "off"]);
        }
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
mod platform {
    use super::*;
    use std::process::Command;

    fn gsettings(args: &[&str]) -> Result<String, String> {
        let out = Command::new("gsettings")
            .args(args)
            .output()
            .map_err(|e| format!("gsettings unavailable: {e}"))?;
        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
        } else {
            Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
        }
    }

    // ponytail: GNOME-family desktops only (gsettings). KDE and others get a
    // clear error in the log instead of a silent no-op.
    pub fn apply(addr: &SocketAddr, backup: &PathBuf) -> Result<(), String> {
        let mode = gsettings(&["get", "org.gnome.system.proxy", "mode"])?;
        std::fs::write(backup, mode.trim_matches('\'')).map_err(|e| e.to_string())?;
        let (host, port) = (addr.ip().to_string(), addr.port().to_string());
        for scheme in ["http", "https"] {
            let schema = format!("org.gnome.system.proxy.{scheme}");
            gsettings(&["set", &schema, "host", &host])?;
            gsettings(&["set", &schema, "port", &port])?;
        }
        gsettings(&["set", "org.gnome.system.proxy", "mode", "manual"])?;
        Ok(())
    }

    pub fn restore(backup: &PathBuf) {
        let mode = std::fs::read_to_string(backup).unwrap_or_else(|_| "none".into());
        let _ = gsettings(&["set", "org.gnome.system.proxy", "mode", mode.trim()]);
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};
    use winreg::RegKey;

    fn snapshot() -> (Option<u32>, Option<String>, Option<String>) {
        let key = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey_with_flags(
                r"Software\Microsoft\Windows\CurrentVersion\Internet Settings",
                KEY_READ,
            )
            .unwrap();
        (
            key.get_value("ProxyEnable").ok(),
            key.get_value("ProxyServer").ok(),
            key.get_value("ProxyOverride").ok(),
        )
    }

    /// Touches the real per-user proxy setting (and puts it back), so it only
    /// runs on request: `cargo test -- --ignored sysproxy`.
    #[test]
    #[ignore]
    fn apply_then_restore_round_trips_the_registry() {
        let before = snapshot();
        let backup = std::env::temp_dir().join("aether-sysproxy-test.json");
        let addr: SocketAddr = "127.0.0.1:1822".parse().unwrap();

        platform::apply(&addr, &backup).unwrap();
        let during = snapshot();
        assert_eq!(during.0, Some(1));
        assert_eq!(during.1.as_deref(), Some("127.0.0.1:1822"));

        platform::restore(&backup);
        let _ = std::fs::remove_file(&backup);
        assert_eq!(snapshot(), before);
    }
}
