use crate::error::AetherError;
use std::io::Read;
use std::path::Path;
use std::process::{Child, Command, Stdio};

pub struct SingboxProcess {
    child: Child,
}

impl SingboxProcess {
    pub fn pid(&self) -> u32 {
        self.child.id()
    }

    pub fn try_wait(&mut self) -> Option<std::process::ExitStatus> {
        self.child.try_wait().ok().flatten()
    }

    pub fn kill(&mut self) {
        let pid = self.child.id();
        // Kill first, THEN drain pipes. Draining before kill would block
        // forever because read_to_end waits for EOF which only arrives
        // after the process exits.
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            let _ = std::process::Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        }
        #[cfg(not(windows))]
        {
            let _ = self.child.kill();
        }
        // Now that the process is dead, drain pipes and reap.
        self.drain_pipes();
        let _ = self.child.wait();
    }

    fn drain_pipes(&mut self) {
        if let Some(ref mut stdout) = self.child.stdout {
            let _ = stdout.read_to_end(&mut Vec::new());
        }
        if let Some(ref mut stderr) = self.child.stderr {
            let _ = stderr.read_to_end(&mut Vec::new());
        }
    }

    /// Reads any available stderr output. Used after process exit to get
    /// the actual error message from sing-box.
    pub fn read_stderr(&mut self) -> String {
        let mut buf = String::new();
        if let Some(ref mut stderr) = self.child.stderr {
            let _ = stderr.read_to_string(&mut buf);
        }
        buf
    }
}

/// Spawns sing-box with the given config file path. Unlike Aether, sing-box
/// is non-interactive so no PTY is needed — plain piped stdio suffices.
///
/// On Windows, CREATE_NO_WINDOW prevents a console window from popping up.
pub fn spawn(binary: &Path, config_path: &Path) -> Result<SingboxProcess, AetherError> {
    let mut cmd = Command::new(binary);
    cmd.arg("run")
        .arg("-c")
        .arg(config_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Prevent a console window on Windows.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd
        .spawn()
        .map_err(|e| AetherError::SpawnFailed(format!("failed to launch sing-box: {e}")))?;

    Ok(SingboxProcess { child })
}
