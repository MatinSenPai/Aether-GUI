use crate::aether::{self, profiles::ConnectionProfile};
use crate::error::AetherError;
use crate::settings;
use crate::state::{AppState, ConnectionState};
use tauri::{AppHandle, State};
use tauri_plugin_autostart::ManagerExt;

#[tauri::command]
pub fn connect(
    app: AppHandle,
    state: State<AppState>,
    profile_override: Option<ConnectionProfile>,
) -> Result<(), AetherError> {
    aether::start_connect(app, state.manager.clone(), profile_override)
}

#[tauri::command]
pub fn disconnect(app: AppHandle, state: State<AppState>) -> Result<(), AetherError> {
    aether::request_disconnect(&app, &state.manager)
}

#[tauri::command]
pub fn get_status(state: State<AppState>) -> ConnectionState {
    state.manager.lock().unwrap().status()
}

#[tauri::command]
pub fn get_default_profile(app: AppHandle) -> ConnectionProfile {
    aether::profiles::load(&app)
}

#[tauri::command]
pub fn set_default_profile(app: AppHandle, profile: ConnectionProfile) -> Result<(), AetherError> {
    aether::profiles::save(&app, &profile);
    Ok(())
}

/// `launch_on_startup` isn't part of `AppSettings` — it's read live from the
/// autostart plugin (the actual OS registration), not our own store. See
/// settings.rs's doc-comment on why the two are kept separate.
#[derive(serde::Serialize)]
pub struct FullAppSettings {
    pub start_minimized: bool,
    pub auto_connect: bool,
    pub launch_on_startup: bool,
    pub language: String,
}

#[tauri::command]
pub fn get_app_settings(app: AppHandle) -> FullAppSettings {
    let stored = settings::load(&app);
    let launch_on_startup = app.autolaunch().is_enabled().unwrap_or(false);
    FullAppSettings {
        start_minimized: stored.start_minimized,
        auto_connect: stored.auto_connect,
        launch_on_startup,
        language: stored.language,
    }
}

#[tauri::command]
pub fn set_start_minimized(app: AppHandle, enabled: bool) {
    let mut stored = settings::load(&app);
    stored.start_minimized = enabled;
    settings::save(&app, &stored);
}

#[tauri::command]
pub fn set_auto_connect(app: AppHandle, enabled: bool) {
    let mut stored = settings::load(&app);
    stored.auto_connect = enabled;
    settings::save(&app, &stored);
}

#[tauri::command]
pub fn set_launch_on_startup(app: AppHandle, enabled: bool) -> Result<(), AetherError> {
    let autostart = app.autolaunch();
    let result = if enabled { autostart.enable() } else { autostart.disable() };
    result.map_err(|e| AetherError::Internal(e.to_string()))
}

/// Switches the tray/notification language immediately (via
/// `i18n::set` + `tray::retranslate`) and persists the choice so the next
/// launch starts in it — the frontend keeps its own separate copy of the
/// choice (and its own dictionary) for the webview UI, synced by whichever
/// surface the user changed it from.
#[tauri::command]
pub fn set_language(app: AppHandle, lang: String) {
    let mut stored = settings::load(&app);
    stored.language = lang.clone();
    settings::save(&app, &stored);
    crate::i18n::set(crate::i18n::Lang::from_code(&lang));
    crate::tray::retranslate(&app);
}

/// Whether the user currently *wants* the Windows system proxy pointed at
/// Aether-GUI's SOCKS5 port. Independent of `ConnectionState` — see
/// sysproxy.rs's doc comments — so this can be `true` even while Idle (it's
/// just a standing preference that takes effect the moment a tunnel comes
/// up) or `false` while Connected (the tunnel stays up, the OS just isn't
/// pointed at it).
#[tauri::command]
pub fn get_system_proxy_enabled(app: AppHandle) -> bool {
    settings::load(&app).system_proxy_enabled
}

#[tauri::command]
pub fn set_system_proxy_enabled(app: AppHandle, state: State<AppState>, enabled: bool) {
    let status = state.manager.lock().unwrap().status();
    crate::sysproxy::set_user_enabled(&app, &status, enabled);
}
