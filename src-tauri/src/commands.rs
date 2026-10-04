use crate::aether::{self, profiles::ConnectionProfile};
use crate::error::AetherError;
use crate::state::{AppState, ConnectionState};
use crate::tray;
use tauri::{AppHandle, State};
use tauri_plugin_autostart::ManagerExt;

const AUTO_CONNECT: &str = "auto_connect";

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
pub fn submit_access_code(state: State<AppState>, code: String) -> Result<(), AetherError> {
    aether::submit_access_code(&state.manager, code)
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

#[tauri::command]
pub fn get_close_to_tray() -> bool {
    tray::get_close_to_tray()
}

#[tauri::command]
pub fn set_close_to_tray(app: AppHandle, enabled: bool) {
    tray::set_close_to_tray(&app, enabled);
}

#[tauri::command]
pub fn get_autostart(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    let launcher = app.autolaunch();
    if enabled {
        launcher.enable()
    } else {
        launcher.disable()
    }
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_auto_connect(app: AppHandle) -> bool {
    crate::prefs::get_bool(&app, AUTO_CONNECT)
}

#[tauri::command]
pub fn set_auto_connect(app: AppHandle, enabled: bool) {
    crate::prefs::set_bool(&app, AUTO_CONNECT, enabled);
}
