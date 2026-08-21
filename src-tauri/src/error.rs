use thiserror::Error;

#[derive(Debug, Error)]
pub enum AetherError {
    #[error("Aether is already running")]
    AlreadyRunning,
    // The payload is a newline-separated list of the locations searched; the
    // frontend splits it and renders each one as its own path line.
    #[error("Aether binary not found. Looked in:\n{0}")]
    BinaryMissing(String),
    #[error("failed to launch Aether: {0}")]
    SpawnFailed(String),
    #[error("port {0} is already in use by another process")]
    PortInUse(u16),
    #[error("no active connection")]
    NotConnected,
    #[error("internal error: {0}")]
    Internal(String),
}

// Tauri v2 command errors must be Serialize; Aether-GUI has no need to
// distinguish error variants on the frontend beyond the message text, so
// this serializes to a plain string rather than a tagged enum.
impl serde::Serialize for AetherError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
