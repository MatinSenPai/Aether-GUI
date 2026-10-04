use std::fs;
use std::path::{Path, PathBuf};

fn pid_file(data_dir: &Path) -> PathBuf {
    data_dir.join("aether.pid")
}

pub fn write_pid(data_dir: &Path, pid: u32) {
    let _ = fs::write(pid_file(data_dir), pid.to_string());
}

pub fn clear_pid(data_dir: &Path) {
    let _ = fs::remove_file(pid_file(data_dir));
}

/// Kills a process and all of its descendants. Aether launches Tor and
/// Psiphon as children; a plain kill of the parent orphans them.
pub fn kill_tree(pid: u32) {
    kill_tree_impl(pid);
}

#[cfg(windows)]
fn kill_tree_impl(pid: u32) {
    use std::os::windows::process::CommandExt;
    let _ = std::process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
        .status();
}

// The PTY makes Aether a session leader, so its pid is also its process group.
#[cfg(unix)]
fn kill_tree_impl(pid: u32) {
    let _ = std::process::Command::new("kill")
        .args(["-9", "--", &format!("-{pid}")])
        .status();
}

/// On startup, if a pid file survives from a prior crash and that process is
/// still alive, kill it before the user can click Connect — otherwise a
/// leftover Aether would just fail to bind the SOCKS port for the new one.
/// This is a defensive backstop; `connect()`'s own port-in-use check (see
/// aether/mod.rs) covers the case where this file is missing or stale.
pub fn reap_orphan(data_dir: &Path) {
    let path = pid_file(data_dir);
    let Ok(contents) = fs::read_to_string(&path) else {
        return;
    };
    if let Ok(pid) = contents.trim().parse::<u32>() {
        if is_alive(pid) {
            kill_tree(pid);
        }
    }
    let _ = fs::remove_file(&path);
}

#[cfg(unix)]
fn is_alive(pid: u32) -> bool {
    std::process::Command::new("kill")
        .args(["-0", &pid.to_string()])
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[cfg(windows)]
fn is_alive(pid: u32) -> bool {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}")])
        .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains(&pid.to_string()))
        .unwrap_or(false)
}
