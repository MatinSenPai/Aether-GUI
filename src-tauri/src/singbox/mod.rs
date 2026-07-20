pub mod config;
pub mod process;
pub mod status;

use crate::error::AetherError;
use crate::events::{now_millis, LogEvent, LOG_EVENT, STATUS_EVENT};
use crate::state::ConnectionState;
use process::SingboxProcess;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

pub struct SingboxManager {
    pub process: Option<SingboxProcess>,
    pub config_path: Option<PathBuf>,
    pub active: bool,
}

impl SingboxManager {
    pub fn new() -> Self {
        Self {
            process: None,
            config_path: None,
            active: false,
        }
    }

    pub fn is_active(&self) -> bool {
        self.active
    }
}

/// Strip ANSI escape codes from a string (sing-box colors its log output).
fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' && chars.peek() == Some(&'[') {
            chars.next();
            for c2 in chars.by_ref() {
                if c2.is_ascii_alphabetic() {
                    break;
                }
            }
            continue;
        }
        out.push(c);
    }
    out
}

fn app_data_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
}

fn resolve_binary(app: &AppHandle) -> Result<PathBuf, AetherError> {
    let dir = app
        .path()
        .resource_dir()
        .map_err(|e| AetherError::Internal(e.to_string()))?;
    let name = if cfg!(windows) { "sing-box.exe" } else { "sing-box" };
    let path = dir.join("binaries").join(name);
    if !path.exists() {
        return Err(AetherError::SingboxBinaryMissing(path.display().to_string()));
    }
    Ok(path)
}

fn write_config(data_dir: &Path, aether_socks_port: u16) -> Result<PathBuf, AetherError> {
    let config_content = config::generate_config(aether_socks_port);
    let config_path = data_dir.join("singbox-config.json");
    fs::write(&config_path, &config_content)
        .map_err(|e| AetherError::SingboxConfigFailed(e.to_string()))?;
    Ok(config_path)
}

fn write_pid(data_dir: &Path, pid: u32) {
    let _ = fs::write(data_dir.join("singbox.pid"), pid.to_string());
}

fn clear_pid(data_dir: &Path) {
    let _ = fs::remove_file(data_dir.join("singbox.pid"));
}

pub fn reap_orphan(data_dir: &Path) {
    let path = data_dir.join("singbox.pid");
    if let Ok(contents) = fs::read_to_string(&path) {
        if let Ok(pid) = contents.trim().parse::<u32>() {
            if is_alive(pid) {
                kill_pid(pid);
            }
        }
        let _ = fs::remove_file(&path);
    }
    // Also kill any sing-box process not tracked by our PID file (e.g. left
    // over from a manual kill or crash).
    kill_stale_singbox();
    // Remove a stale TUN adapter if the previous sing-box was killed
    // forcefully and the wintun driver didn't clean up.
    cleanup_tun_adapter();
}

#[cfg(windows)]
fn is_alive(pid: u32) -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    std::process::Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}")])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains(&pid.to_string()))
        .unwrap_or(false)
}

#[cfg(windows)]
fn kill_pid(pid: u32) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let _ = std::process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/F"])
        .creation_flags(CREATE_NO_WINDOW)
        .status();
}

/// Kill any sing-box.exe process running on the system, regardless of PID
/// file. Catches orphans from manual kills or crashes.
#[cfg(windows)]
fn kill_stale_singbox() {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let _ = std::process::Command::new("taskkill")
        .args(["/IM", "sing-box.exe", "/F"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
}

/// Remove a stale "aether-tun" network adapter left behind when sing-box
/// was force-killed and the wintun driver didn't clean up.
#[cfg(windows)]
fn cleanup_tun_adapter() {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let _ = std::process::Command::new("netsh")
        .args(["interface", "delete", "interface", "aether-tun"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
}

#[cfg(unix)]
fn is_alive(pid: u32) -> bool {
    std::process::Command::new("kill")
        .args(["-0", &pid.to_string()])
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[cfg(unix)]
fn kill_pid(pid: u32) {
    let _ = std::process::Command::new("kill")
        .args(["-9", &pid.to_string()])
        .status();
}

#[cfg(unix)]
fn kill_stale_singbox() {}

#[cfg(unix)]
fn cleanup_tun_adapter() {}

/// Starts the sing-box TUN tunnel. Called after Aether's SOCKS5 is confirmed
/// live. Writes the config, spawns sing-box, and monitors it on a background
/// thread. Emits Tunneling state on success.
pub fn start_tunnel(
    app: AppHandle,
    manager: Arc<Mutex<SingboxManager>>,
    aether_socks_port: u16,
) -> Result<(), AetherError> {
    let binary = resolve_binary(&app)?;
    let data_dir = app_data_dir(&app);
    std::fs::create_dir_all(&data_dir).map_err(|e| AetherError::Internal(e.to_string()))?;

    {
        let mgr = manager.lock().unwrap();
        if mgr.active {
            return Err(AetherError::SingboxAlreadyRunning);
        }
    }

    let config_path = write_config(&data_dir, aether_socks_port)?;
    // Log the config for debugging.
    let _ = app.emit(LOG_EVENT, &LogEvent {
        line: format!("[singbox] config written to {}", config_path.display()),
        timestamp: now_millis(),
    });
    let proc = process::spawn(&binary, &config_path)?;
    let pid = proc.pid();
    write_pid(&data_dir, pid);

    {
        let mut mgr = manager.lock().unwrap();
        mgr.process = Some(proc);
        mgr.config_path = Some(config_path);
        mgr.active = true;
    }

    // Wait for sing-box to stay alive — if it doesn't crash within the settle
    // time, the TUN interface is up. No DNS probing needed.
    let start = Instant::now();
    let app_clone = app.clone();
    let manager_clone = Arc::clone(&manager);
    std::thread::spawn(move || {
        let deadline = start + status::TUN_STARTUP_TIMEOUT;
        let mut settled = false;
        loop {
            std::thread::sleep(Duration::from_millis(300));

            // Check if sing-box exited prematurely.
            {
                let mut mgr = manager_clone.lock().unwrap();
                if let Some(exit) = mgr.process.as_mut().and_then(|s| s.try_wait()) {
                    let raw_stderr = mgr.process.as_mut().map(|s| s.read_stderr()).unwrap_or_default();
                    let stderr = strip_ansi(&raw_stderr);
                    let msg = if stderr.trim().is_empty() {
                        format!("sing-box exited ({exit})")
                    } else {
                        let last = stderr.lines().filter(|l| !l.trim().is_empty()).last().unwrap_or(&stderr);
                        format!("sing-box: {last}")
                    };
                    mgr.active = false;
                    mgr.process = None;
                    clear_pid(&app_data_dir(&app_clone));
                    let _ = app_clone.emit(
                        STATUS_EVENT,
                        &ConnectionState::Error {
                            message: msg,
                            phase: "tunnel".into(),
                        },
                    );
                    return;
                }
            }

            if !settled {
                // Once the process has been alive for TUN_SETTLE_TIME, consider it up.
                if Instant::now().duration_since(start) >= status::TUN_SETTLE_TIME {
                    settled = true;
                }
            }

            if settled {
                let _ = app_clone.emit(STATUS_EVENT, &ConnectionState::Tunneling {
                    tun_addr: format!("{}/30", status::TUN_ADDR),
                    socks_addr: format!("127.0.0.1:{aether_socks_port}"),
                    connected_at_ms: now_millis(),
                });
                // Hand off to long-running monitor.
                monitor_tunnel(app_clone, manager_clone);
                return;
            }

            if Instant::now() >= deadline {
                // sing-box didn't stay alive — kill and report error.
                {
                    let mut mgr = manager_clone.lock().unwrap();
                    if let Some(proc) = mgr.process.as_mut() {
                        proc.kill();
                    }
                    mgr.active = false;
                    mgr.process = None;
                    clear_pid(&app_data_dir(&app_clone));
                }
                let _ = app_clone.emit(
                    STATUS_EVENT,
                    &ConnectionState::Error {
                        message: "sing-box TUN interface did not come up in time".into(),
                        phase: "tunnel".into(),
                    },
                );
                return;
            }
        }
    });

    Ok(())
}

/// Watches sing-box after TUN is confirmed live. Only watches for unexpected
/// process exits — there is no polling beyond that.
fn monitor_tunnel(app: AppHandle, manager: Arc<Mutex<SingboxManager>>) {
    loop {
        std::thread::sleep(Duration::from_millis(500));
        let mut mgr = manager.lock().unwrap();
        // Process was cleared by stop_tunnel — exit quietly.
        if mgr.process.is_none() {
            return;
        }
        if let Some(exit) = mgr.process.as_mut().and_then(|s| s.try_wait()) {
            let raw_stderr = mgr.process.as_mut().map(|s| s.read_stderr()).unwrap_or_default();
            let stderr = strip_ansi(&raw_stderr);
            let msg = if stderr.trim().is_empty() {
                format!("sing-box TUN lost ({exit})")
            } else {
                let last = stderr.lines().filter(|l| !l.trim().is_empty()).last().unwrap_or(&stderr);
                format!("sing-box: {last}")
            };
            mgr.active = false;
            mgr.process = None;
            drop(mgr);
            clear_pid(&app_data_dir(&app));
            let _ = app.emit(
                STATUS_EVENT,
                &ConnectionState::Error {
                    message: msg,
                    phase: "tunnel".into(),
                },
            );
            return;
        }
    }
}

/// Stops the sing-box process gracefully.
pub fn stop_tunnel(app: &AppHandle, manager: &Arc<Mutex<SingboxManager>>) {
    let data_dir = app_data_dir(app);
    let mut mgr = manager.lock().unwrap();
    if let Some(proc) = mgr.process.as_mut() {
        proc.kill();
    }
    mgr.process = None;
    mgr.active = false;
    mgr.config_path = None;
    drop(mgr);
    clear_pid(&data_dir);
}
