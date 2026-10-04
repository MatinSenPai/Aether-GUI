//! Small app-level on/off preferences kept in settings.json, next to
//! close-to-tray. (Per-connection options live in the profile instead.)

use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";

pub fn get_bool(app: &AppHandle, key: &str) -> bool {
    app.store(STORE_FILE)
        .ok()
        .and_then(|s| s.get(key))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

pub fn set_bool(app: &AppHandle, key: &str, value: bool) {
    if let Ok(store) = app.store(STORE_FILE) {
        store.set(key, serde_json::Value::Bool(value));
        let _ = store.save();
    }
}
