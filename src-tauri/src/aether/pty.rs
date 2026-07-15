use super::profiles::ConnectionProfile;
use super::prompts::{looks_like_choice_prompt, PROMPT_TABLE};
use crate::error::AetherError;
use crate::events::{now_millis, LogEvent};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashSet;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};

pub struct PtySession {
    child: Box<dyn Child + Send + Sync>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    prompts_done: Arc<AtomicBool>,
    // Keeps the pty master (and thus the slave/child's controlling tty) alive
    // for the life of the session; never read from directly after spawn.
    _master: Box<dyn MasterPty + Send>,
}

impl PtySession {
    pub fn pid(&self) -> u32 {
        self.child.process_id().unwrap_or(0)
    }

    pub fn prompts_done(&self) -> bool {
        self.prompts_done.load(Ordering::Relaxed)
    }

    pub fn try_wait(&mut self) -> Option<portable_pty::ExitStatus> {
        self.child.try_wait().ok().flatten()
    }

    /// Ctrl-C (ETX) — the same byte a real terminal sends for SIGINT. See
    /// aether/status.rs::GRACEFUL_SHUTDOWN_GRACE for why callers should
    /// follow this with only a short wait before `kill()`, not a long one.
    pub fn send_ctrl_c(&self) {
        if let Ok(mut w) = self.writer.lock() {
            let _ = w.write_all(&[0x03]);
            let _ = w.flush();
        }
    }

    pub fn kill(&mut self) {
        let _ = self.child.kill();
    }
}

/// Spawns Aether in a real PTY (not a plain piped subprocess) and answers its
/// known interactive prompts as they appear. A PTY is required because
/// interactive-prompt libraries typically check `isatty()` and behave
/// differently — or refuse to prompt at all — over a plain pipe.
///
/// `cwd` should be a stable, dedicated directory (the app's data dir): Aether
/// writes its provisioned identity (`aether-masque.toml` / `aether.toml`)
/// into its working directory, so this must stay consistent across launches
/// for that identity to persist rather than being silently re-provisioned
/// every run.
pub fn spawn(
    binary: &Path,
    cwd: &Path,
    profile: ConnectionProfile,
    log_tx: Sender<LogEvent>,
) -> Result<PtySession, AetherError> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize { rows: 40, cols: 120, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| AetherError::SpawnFailed(e.to_string()))?;

    let mut cmd = CommandBuilder::new(binary);
    cmd.cwd(cwd);

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| AetherError::SpawnFailed(e.to_string()))?;
    // Drop our end of the slave once the child has it; on Unix this matters
    // so that the child (not us) is the last holder of that side of the pty.
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| AetherError::SpawnFailed(e.to_string()))?;

    // portable-pty's take_writer() may only be called once per master, so we
    // grab it a single time here and share it (reader thread answers prompts;
    // PtySession::send_ctrl_c is called from other threads on disconnect).
    let raw_writer = pair
        .master
        .take_writer()
        .map_err(|e| AetherError::SpawnFailed(e.to_string()))?;
    let writer = Arc::new(Mutex::new(raw_writer));
    let writer_for_thread = Arc::clone(&writer);

    let prompts_done = Arc::new(AtomicBool::new(false));
    let prompts_done_for_thread = Arc::clone(&prompts_done);

    std::thread::spawn(move || {
        read_loop(reader.as_mut(), writer_for_thread, profile, log_tx, prompts_done_for_thread);
    });

    Ok(PtySession { child, writer, prompts_done, _master: pair.master })
}

fn read_loop(
    reader: &mut dyn Read,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    profile: ConnectionProfile,
    log_tx: Sender<LogEvent>,
    prompts_done: Arc<AtomicBool>,
) {
    let mut answered: HashSet<&'static str> = HashSet::new();
    let mut current_section: Option<&'static str> = None;
    let mut line_buf = String::new();
    let mut byte_buf = [0u8; 4096];

    loop {
        let n = match reader.read(&mut byte_buf) {
            Ok(0) => break, // EOF: process exited or pty closed
            Ok(n) => n,
            Err(_) => break,
        };
        line_buf.push_str(&String::from_utf8_lossy(&byte_buf[..n]));

        // Emit every complete line, tracking which known prompt "section"
        // we're currently in (the last recognized header line wins — plain
        // log lines in between don't reset it).
        while let Some(pos) = line_buf.find('\n') {
            let raw_line: String = line_buf.drain(..=pos).collect();
            let line = strip_ansi(raw_line.trim_end_matches(['\r', '\n']));
            if line.is_empty() {
                continue;
            }
            for rule in PROMPT_TABLE {
                if (rule.header_matches)(&line) {
                    current_section = Some(rule.id);
                }
            }
            if line.contains("hunting for a working") {
                prompts_done.store(true, Ordering::Relaxed);
            }
            let _ = log_tx.send(LogEvent { line, timestamp: now_millis() });
        }

        // Whatever remains (no newline yet) is either more output still
        // arriving, or Aether blocking on stdin for the current section's
        // answer.
        let partial = strip_ansi(&line_buf);
        if looks_like_choice_prompt(&partial) {
            if let Some(section) = current_section {
                if !answered.contains(section) {
                    if let Some(rule) = PROMPT_TABLE.iter().find(|r| r.id == section) {
                        let answer = (rule.answer)(&profile);
                        if let Ok(mut w) = writer.lock() {
                            let _ = w.write_all(answer.as_bytes());
                            let _ = w.write_all(b"\r\n");
                            let _ = w.flush();
                        }
                        answered.insert(section);
                        if answered.len() == PROMPT_TABLE.len() {
                            prompts_done.store(true, Ordering::Relaxed);
                        }
                    }
                }
            }
        }
    }
}

/// Aether's output includes ANSI color codes (e.g. `\x1b[32m`) around log
/// level names — stripped so header-line matching and the log panel both see
/// plain text. Minimal hand-rolled CSI-sequence stripper: no regex needed for
/// a single well-known pattern (`ESC [ ... letter`).
fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' {
            match chars.peek() {
                Some(&'[') => {
                    chars.next();
                    for c2 in chars.by_ref() {
                        if c2.is_ascii_alphabetic() {
                            break;
                        }
                    }
                    continue;
                }
                Some(&']') => {
                    chars.next();
                    let mut st_escaped = false;
                    for c2 in chars.by_ref() {
                        if c2 == '\x07' {
                            break;
                        }
                        if c2 == '\u{1b}' {
                            st_escaped = true;
                        } else if st_escaped && c2 == '\\' {
                            break;
                        } else {
                            st_escaped = false;
                        }
                    }
                    continue;
                }
                _ => {}
            }
        }
        out.push(c);
    }
    out
}
