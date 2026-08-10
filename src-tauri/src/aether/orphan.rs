use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

fn pid_file(data_dir: &Path) -> PathBuf {
    data_dir.join("aether.pid")
}

pub fn write_pid(data_dir: &Path, pid: u32) {
    let _ = fs::write(pid_file(data_dir), pid.to_string());
}

pub fn clear_pid(data_dir: &Path) {
    let _ = fs::remove_file(pid_file(data_dir));
}

fn expected_aether_name(name: &str) -> bool {
    if cfg!(windows) {
        name.eq_ignore_ascii_case("aether.exe")
    } else {
        name == "aether"
    }
}

#[cfg(windows)]
fn no_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(windows)]
fn is_expected_process(pid: u32) -> bool {
    let mut command = Command::new("tasklist");
    command.args(["/FI", &format!("PID eq {pid}"), "/FO", "CSV", "/NH"]);
    no_window(&mut command);
    command
        .output()
        .map(|output| {
            String::from_utf8_lossy(&output.stdout).lines().any(|line| {
                line.split(',')
                    .next()
                    .map(|name| expected_aether_name(name.trim_matches('"')))
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

#[cfg(unix)]
fn is_expected_process(pid: u32) -> bool {
    Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "comm="])
        .output()
        .map(|output| {
            String::from_utf8_lossy(&output.stdout).lines().any(|line| {
                Path::new(line.trim())
                    .file_name()
                    .map(|name| expected_aether_name(&name.to_string_lossy()))
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

#[cfg(windows)]
fn kill_pid(pid: u32) -> bool {
    let mut command = Command::new("taskkill");
    command.args(["/PID", &pid.to_string(), "/F"]);
    no_window(&mut command);
    command
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[cfg(unix)]
fn kill_pid(pid: u32) -> bool {
    Command::new("kill")
        .args(["-9", &pid.to_string()])
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

/// On startup, clean up a surviving Aether process from a prior crash.
///
/// A PID file alone is not proof of ownership: operating systems can reuse a
/// PID after the original process exits. Verify that the PID still belongs to
/// the expected Aether executable before terminating it, otherwise a stale PID
/// file could cause the GUI to kill an unrelated process.
pub fn reap_orphan(data_dir: &Path) {
    let path = pid_file(data_dir);
    let Ok(contents) = fs::read_to_string(&path) else {
        return;
    };
    let Ok(pid) = contents.trim().parse::<u32>() else {
        let _ = fs::remove_file(&path);
        return;
    };

    if !is_expected_process(pid) {
        let _ = fs::remove_file(&path);
        return;
    }

    // Keep the PID file when termination fails so a later startup can retry;
    // deleting it would lose the only record of a still-running owned process.
    if kill_pid(pid) {
        let _ = fs::remove_file(&path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_the_aether_executable_name() {
        assert!(expected_aether_name(if cfg!(windows) {
            "aether.exe"
        } else {
            "aether"
        }));
        assert!(!expected_aether_name("not-aether.exe"));
        assert!(!expected_aether_name("aether-helper.exe"));
    }
}
