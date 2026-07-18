use crate::aether::{self, profiles::ConnectionProfile};
use crate::error::AetherError;
use crate::state::{AppState, ConnectionState};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn connect(
    app: AppHandle,
    state: State<AppState>,
    profile_override: Option<ConnectionProfile>,
    enable_tun: Option<bool>,
) -> Result<(), AetherError> {
    aether::start_connect(app, state.manager.clone(), profile_override, enable_tun.unwrap_or(false), state.singbox.clone())
}

#[tauri::command]
pub fn disconnect(app: AppHandle, state: State<AppState>) -> Result<(), AetherError> {
    aether::request_disconnect(&app, &state.manager, &state.singbox)
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
pub fn get_tun_status(state: State<AppState>) -> bool {
    state.singbox.lock().unwrap().is_active()
}
