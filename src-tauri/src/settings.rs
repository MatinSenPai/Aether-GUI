use serde::{Deserialize, Serialize};

/// App-level settings, separate from `aether::profiles::ConnectionProfile`
/// (which is *connection* configuration). `launch_on_startup` is deliberately
/// NOT stored here: tauri-plugin-autostart owns that as an OS-level
/// registration (registry entry on Windows) and is queried live via
/// `ManagerExt::autolaunch().is_enabled()` — duplicating it into our own
/// store would just create a second source of truth that can drift from
/// what Windows actually has registered.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppSettings {
    /// Keep the main window hidden on launch (manual or autostart) instead
    /// of showing it — the tray icon remains the only visible surface.
    #[serde(default)]
    pub start_minimized: bool,
    /// Kick off `connect()` automatically once the app finishes `setup()`,
    /// using whatever profile `profiles::load` resolves to.
    #[serde(default)]
    pub auto_connect: bool,
    /// User's *intent* for the Windows system proxy, independent of the
    /// tunnel's own connection state (see sysproxy.rs). Defaults to `true`
    /// so behavior out of the box matches the old always-on-while-connected
    /// wiring; once a user flips this off, it stays off across restarts and
    /// reconnects until they flip it back on themselves.
    #[serde(default = "default_true")]
    pub system_proxy_enabled: bool,
    /// UI/tray/notification language — "en" or "fa". Read once at startup
    /// by `i18n::init` into the in-memory `i18n::CURRENT` atomic (tray menu
    /// labels and OS notifications are built in Rust, not the webview, so
    /// they need their own copy rather than reading the frontend's state);
    /// changed later via the `set_language` command, which updates both.
    #[serde(default = "default_language")]
    pub language: String,
}

fn default_language() -> String {
    "en".to_string()
}

fn default_true() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            start_minimized: false,
            auto_connect: false,
            system_proxy_enabled: true,
            language: default_language(),
        }
    }
}

const STORE_FILE: &str = "settings.json";
const STORE_KEY: &str = "app_settings";

pub fn load(app: &tauri::AppHandle) -> AppSettings {
    use tauri_plugin_store::StoreExt;
    app.store(STORE_FILE)
        .ok()
        .and_then(|s| s.get(STORE_KEY))
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

pub fn save(app: &tauri::AppHandle, settings: &AppSettings) {
    use tauri_plugin_store::StoreExt;
    if let Ok(store) = app.store(STORE_FILE) {
        if let Ok(value) = serde_json::to_value(settings) {
            store.set(STORE_KEY, value);
            let _ = store.save();
        }
    }
}
