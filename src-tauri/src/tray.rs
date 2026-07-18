use crate::events::now_millis;
use crate::state::ConnectionState;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

pub const TRAY_ID: &str = "main-tray";

/// Bumped on every `on_state_change` call. A Connected-state ticker thread
/// captures the value at spawn time and compares against this on each tick;
/// a mismatch means some *other* transition has happened since (a drop, a
/// disconnect, a fresh reconnect), so the stale ticker exits instead of
/// fighting the icon/tooltip that a newer call already set.
static TICK_GENERATION: AtomicU64 = AtomicU64::new(0);

fn icon_bytes(category: &str) -> &'static [u8] {
    match category {
        "connected" => include_bytes!("../icons/tray/connected.png"),
        "error" => include_bytes!("../icons/tray/error.png"),
        "busy" => include_bytes!("../icons/tray/busy.png"),
        _ => include_bytes!("../icons/tray/idle.png"),
    }
}

/// Buckets the full state machine (state.rs) down to the four states the
/// tray icon actually distinguishes visually.
fn category(state: &ConnectionState) -> &'static str {
    match state {
        ConnectionState::Idle => "idle",
        ConnectionState::Connected { .. } => "connected",
        ConnectionState::Error { .. } => "error",
        ConnectionState::Launching
        | ConnectionState::Connecting
        | ConnectionState::Reconnecting { .. }
        | ConnectionState::Disconnecting => "busy",
    }
}

fn format_elapsed(connected_at_ms: u64) -> String {
    let secs = now_millis().saturating_sub(connected_at_ms) / 1000;
    format!("{:02}:{:02}:{:02}", secs / 3600, (secs % 3600) / 60, secs % 60)
}

fn tooltip_text(state: &ConnectionState) -> String {
    match state {
        ConnectionState::Idle => "Aether-GUI · Idle".into(),
        ConnectionState::Launching => "Aether-GUI · Starting…".into(),
        ConnectionState::Connecting => "Aether-GUI · Finding a route…".into(),
        ConnectionState::Connected { connected_at_ms, .. } => {
            format!("Aether-GUI · Connected · {}", format_elapsed(*connected_at_ms))
        }
        ConnectionState::Reconnecting { attempt, max_attempts } => {
            format!("Aether-GUI · Reconnecting ({attempt}/{max_attempts})")
        }
        ConnectionState::Disconnecting => "Aether-GUI · Disconnecting…".into(),
        ConnectionState::Error { .. } => "Aether-GUI · Error".into(),
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Builds the tray icon. Replaces the inline tray setup that used to live in
/// `main.rs::setup` — same menu/click behavior, plus an id so later state
/// changes can look it up via `app.tray_by_id(TRAY_ID)` and repaint it.
pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, "open", "Open Aether-GUI", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?;
    let tray_menu = Menu::with_items(app, &[&open_item, &quit_item])?;

    let icon = Image::from_bytes(icon_bytes("idle")).expect("embedded tray icon must decode");

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip(tooltip_text(&ConnectionState::Idle))
        .menu(&tray_menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            "open" => show_main_window(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Restore the window on a left double-click on the icon.
            if let TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } = event {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// Single entry point called from `aether::set_state_and_emit` right after
/// every state transition: repaints the icon/tooltip, fires an OS
/// notification for the transitions a backgrounded user actually cares
/// about, and (re)starts the live "Connected · HH:MM:SS" tooltip ticker.
pub fn on_state_change(app: &AppHandle, previous: &ConnectionState, new_state: &ConnectionState) {
    let generation = TICK_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;

    repaint(app, new_state);
    notify(app, previous, new_state);

    if let ConnectionState::Connected { connected_at_ms, .. } = new_state {
        let app = app.clone();
        let connected_at_ms = *connected_at_ms;
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_secs(1));
            // A newer transition happened — stop, the new one already
            // repainted the icon/tooltip for its own state.
            if TICK_GENERATION.load(Ordering::SeqCst) != generation {
                return;
            }
            if let Some(tray) = app.tray_by_id(TRAY_ID) {
                let _ = tray.set_tooltip(Some(format!(
                    "Aether-GUI · Connected · {}",
                    format_elapsed(connected_at_ms)
                )));
            }
        });
    }
}

fn repaint(app: &AppHandle, state: &ConnectionState) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else { return };
    if let Ok(icon) = Image::from_bytes(icon_bytes(category(state))) {
        let _ = tray.set_icon(Some(icon));
    }
    let _ = tray.set_tooltip(Some(tooltip_text(state)));
}

/// Deliberately narrow: only Connected, a real Disconnect (from Connected or
/// mid-graceful-shutdown), and Error. Launching/Connecting/Reconnecting
/// churn stays silent — those are exactly the states where the user is
/// usually still watching the window, and notifying on every retry attempt
/// would be noisy rather than useful.
fn notify(app: &AppHandle, previous: &ConnectionState, new_state: &ConnectionState) {
    use tauri_plugin_notification::NotificationExt;

    let body: Option<String> = match (previous, new_state) {
        (_, ConnectionState::Connected { .. }) => Some("Connected.".into()),
        (ConnectionState::Connected { .. } | ConnectionState::Disconnecting, ConnectionState::Idle) => {
            Some("Disconnected.".into())
        }
        (_, ConnectionState::Error { message, .. }) => Some(format!("Connection error: {message}")),
        _ => None,
    };

    if let Some(body) = body {
        let _ = app.notification().builder().title("Aether-GUI").body(body).show();
    }
}
