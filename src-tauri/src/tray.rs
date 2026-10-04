use crate::state::{AppState, ConnectionState};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Wry,
};

const TRAY_ID: &str = "main";
/// "Connect" / "Disconnect" entry, kept so its label can follow the state.
static TOGGLE: OnceLock<MenuItem<Wry>> = OnceLock::new();

const GREEN: [u8; 3] = [0x22, 0xC5, 0x5E];
const AMBER: [u8; 3] = [0xF5, 0x9E, 0x0B];

/// Paints a status dot in the icon's bottom-right corner (RGBA in, RGBA out).
fn with_dot(rgba: &[u8], width: u32, height: u32, color: [u8; 3]) -> Vec<u8> {
    let mut out = rgba.to_vec();
    let (cx, cy) = (width as f32 * 0.74, height as f32 * 0.74);
    let r = width.min(height) as f32 * 0.24;
    for y in 0..height {
        for x in 0..width {
            let d = ((x as f32 - cx).powi(2) + (y as f32 - cy).powi(2)).sqrt();
            let i = ((y * width + x) * 4) as usize;
            if d <= r {
                out[i..i + 4].copy_from_slice(&[color[0], color[1], color[2], 255]);
            } else if d <= r + 1.5 {
                // thin dark ring so the dot reads on any taskbar colour
                out[i..i + 4].copy_from_slice(&[0x10, 0x10, 0x12, 255]);
            }
        }
    }
    out
}

/// Called on every state change: the tray icon gets a green dot while
/// connected and an amber one while working on it, plus a matching tooltip
/// and a Connect/Disconnect menu entry.
pub fn update_state(app: &AppHandle, state: &ConnectionState) {
    let (dot, tip, toggle) = match state {
        ConnectionState::Connected { socks_addr, .. } => (
            Some(GREEN),
            format!("Aether-GUI \u{2014} connected ({socks_addr})"),
            "Disconnect",
        ),
        ConnectionState::Launching
        | ConnectionState::Connecting
        | ConnectionState::Reconnecting { .. } => (
            Some(AMBER),
            "Aether-GUI \u{2014} connecting\u{2026}".into(),
            "Cancel",
        ),
        ConnectionState::Disconnecting => (
            Some(AMBER),
            "Aether-GUI \u{2014} disconnecting\u{2026}".into(),
            "Cancel",
        ),
        ConnectionState::Idle | ConnectionState::Error { .. } => {
            (None, "Aether-GUI".into(), "Connect")
        }
    };
    if let Some(item) = TOGGLE.get() {
        let _ = item.set_text(toggle);
    }
    let (Some(tray), Some(base)) = (app.tray_by_id(TRAY_ID), app.default_window_icon()) else {
        return;
    };
    let icon = match dot {
        Some(c) => Image::new_owned(
            with_dot(base.rgba(), base.width(), base.height(), c),
            base.width(),
            base.height(),
        ),
        None => base.clone(),
    };
    let _ = tray.set_icon(Some(icon));
    let _ = tray.set_tooltip(Some(tip));
}

fn toggle_connection(app: &AppHandle) {
    let manager = app.state::<AppState>().manager.clone();
    let idle = matches!(
        manager.lock().unwrap().status(),
        ConnectionState::Idle | ConnectionState::Error { .. }
    );
    if idle {
        let _ = crate::aether::start_connect(app.clone(), manager, None);
    } else {
        let _ = crate::aether::request_disconnect(app, &manager);
    }
}

/// Global flag — toggled from the frontend via the `set_close_to_tray` command
/// and persisted to disk via `tauri-plugin-store`. Using an atomic here instead
/// of the store directly because the `on_window_event` callback fires on every
/// close and reading the store there would be wasteful.
static CLOSE_TO_TRAY: AtomicBool = AtomicBool::new(false);

const STORE_FILE: &str = "settings.json";
const STORE_KEY: &str = "close_to_tray";

pub fn get_close_to_tray() -> bool {
    CLOSE_TO_TRAY.load(Ordering::Relaxed)
}

pub fn set_close_to_tray(app: &AppHandle, enabled: bool) {
    CLOSE_TO_TRAY.store(enabled, Ordering::Relaxed);
    // Persist so it survives restarts.
    use tauri_plugin_store::StoreExt;
    if let Ok(store) = app.store(STORE_FILE) {
        store.set(STORE_KEY, serde_json::Value::Bool(enabled));
        let _ = store.save();
    }
}

/// Load persisted preference and sync the atomic.
fn load_preference(app: &AppHandle) {
    use tauri_plugin_store::StoreExt;
    let enabled = app
        .store(STORE_FILE)
        .ok()
        .and_then(|s| s.get(STORE_KEY))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    CLOSE_TO_TRAY.store(enabled, Ordering::Relaxed);
}

/// Create the system-tray icon, menu, and event handlers. Call from `setup`.
pub fn init(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    load_preference(app.handle());

    let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", "Connect", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &toggle, &quit])?;
    let _ = TOGGLE.set(toggle);

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Aether-GUI")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_window(app),
            "toggle" => toggle_connection(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

fn show_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dot_paints_corner_and_keeps_the_rest() {
        let base = vec![7u8; 32 * 32 * 4];
        let out = with_dot(&base, 32, 32, GREEN);
        let centre = ((24 * 32 + 24) * 4) as usize; // inside the dot
        assert_eq!(&out[centre..centre + 3], &GREEN);
        assert_eq!(&out[0..4], &[7, 7, 7, 7]); // top-left untouched
    }

    #[test]
    fn atomic_flag_round_trips() {
        CLOSE_TO_TRAY.store(false, Ordering::Relaxed);
        assert!(!get_close_to_tray());
        CLOSE_TO_TRAY.store(true, Ordering::Relaxed);
        assert!(get_close_to_tray());
    }
}
