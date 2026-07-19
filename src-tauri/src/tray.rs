use crate::events::now_millis;
use crate::i18n;
use crate::settings;
use crate::state::{AppState, ConnectionState};
use crate::sysproxy::ProxyStatus;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

pub const TRAY_ID: &str = "main-tray";

const ID_OPEN: &str = "open";
const ID_CONNECT: &str = "connect";
const ID_DISCONNECT: &str = "disconnect";
const ID_PAUSE_RESUME: &str = "pause_resume";
const ID_SYSTEM_PROXY: &str = "system_proxy";
const ID_QUIT: &str = "quit";

/// Bumped on every `on_state_change` call. A Connected-state ticker thread
/// captures the value at spawn time and compares against this on each tick;
/// a mismatch means some *other* transition has happened since (a drop, a
/// disconnect, a fresh reconnect), so the stale ticker exits instead of
/// fighting the icon/tooltip that a newer call already set.
static TICK_GENERATION: AtomicU64 = AtomicU64::new(0);

/// Handles to the mutable menu items, kept alive so later state/preference
/// changes can repaint labels, enabled state, and the checkbox without
/// rebuilding the whole menu. Populated once by `build`.
struct TrayItems {
    open: MenuItem<tauri::Wry>,
    connect: MenuItem<tauri::Wry>,
    disconnect: MenuItem<tauri::Wry>,
    pause_resume: MenuItem<tauri::Wry>,
    system_proxy: CheckMenuItem<tauri::Wry>,
    quit: MenuItem<tauri::Wry>,
}

static TRAY_ITEMS: Mutex<Option<TrayItems>> = Mutex::new(None);

fn icon_bytes(category: &str) -> &'static [u8] {
    match category {
        "connected" => include_bytes!("../icons/tray/connected.png"),
        "error" => include_bytes!("../icons/tray/error.png"),
        "busy" => include_bytes!("../icons/tray/busy.png"),
        "proxy_active" => include_bytes!("../icons/tray/proxy_active.png"),
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
    i18n::tooltip(state, format_elapsed)
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Builds the tray icon: the status-driven bits (Open/Exit, icon, tooltip)
/// plus Connect/Disconnect/Pause-Resume actions and a checkable "System
/// Proxy" item so the tunnel and the OS proxy setting can both be driven
/// entirely from the tray, without opening the window.
pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, ID_OPEN, i18n::open_app(), true, None::<&str>)?;
    let connect_item = MenuItem::with_id(app, ID_CONNECT, i18n::connect(), true, None::<&str>)?;
    let disconnect_item = MenuItem::with_id(app, ID_DISCONNECT, i18n::stop(), false, None::<&str>)?;
    // Label/enabled state gets repainted by sync_system_proxy once the
    // initial preference is known; "Pause protection" is just the starting
    // guess for the common (proxy-currently-on) case.
    let pause_resume_item =
        MenuItem::with_id(app, ID_PAUSE_RESUME, i18n::pause_protection(), true, None::<&str>)?;
    let system_proxy_enabled = settings::load(app).system_proxy_enabled;
    let system_proxy_item = CheckMenuItem::with_id(
        app,
        ID_SYSTEM_PROXY,
        i18n::system_proxy(),
        true,
        system_proxy_enabled,
        None::<&str>,
    )?;
    let quit_item = MenuItem::with_id(app, ID_QUIT, i18n::exit(), true, None::<&str>)?;

    let tray_menu = Menu::with_items(
        app,
        &[
            &open_item,
            &PredefinedMenuItem::separator(app)?,
            &connect_item,
            &disconnect_item,
            &pause_resume_item,
            &system_proxy_item,
            &PredefinedMenuItem::separator(app)?,
            &quit_item,
        ],
    )?;

    *TRAY_ITEMS.lock().unwrap() = Some(TrayItems {
        open: open_item,
        connect: connect_item,
        disconnect: disconnect_item,
        pause_resume: pause_resume_item,
        system_proxy: system_proxy_item,
        quit: quit_item,
    });

    let icon = Image::from_bytes(icon_bytes("idle")).expect("embedded tray icon must decode");

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip(tooltip_text(&ConnectionState::Idle))
        .menu(&tray_menu)
        .show_menu_on_left_click(false)
        .on_menu_event(handle_menu_event)
        .on_tray_icon_event(|tray, event| {
            // Restore the window on a left double-click on the icon.
            if let TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } = event {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    match event.id.as_ref() {
        ID_QUIT => app.exit(0),
        ID_OPEN => show_main_window(app),
        ID_CONNECT => {
            let state = app.state::<AppState>();
            let manager = state.manager.clone();
            crate::aether::start_connect(app.clone(), manager, None).ok();
        }
        ID_DISCONNECT => {
            let state = app.state::<AppState>();
            let _ = crate::aether::request_disconnect(app, &state.manager);
        }
        ID_PAUSE_RESUME | ID_SYSTEM_PROXY => {
            // Both items drive the exact same preference — Pause/Resume is
            // just a friendlier phrasing of the same checkbox for people
            // who think in terms of "pause the tunnel" rather than "system
            // proxy". "Pause" doesn't kill the Aether process (that would
            // throw away the negotiated route and force a full reconnect);
            // it stops the OS from routing traffic through it while the
            // tunnel stays warm underneath, so Resume is instant.
            let current = settings::load(app).system_proxy_enabled;
            let state = app.state::<AppState>();
            let status = state.manager.lock().unwrap().status();
            crate::sysproxy::set_user_enabled(app, &status, !current);
        }
        _ => {}
    }
}

/// Single entry point called from `aether::set_state_and_emit` right after
/// every state transition: repaints the icon/tooltip, fires an OS
/// notification for the transitions a backgrounded user actually cares
/// about, keeps the Connect/Disconnect items' enabled state honest, and
/// (re)starts the live "Connected · HH:MM:SS" tooltip ticker.
pub fn on_state_change(app: &AppHandle, previous: &ConnectionState, new_state: &ConnectionState) {
    let generation = TICK_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;

    repaint(app, new_state);
    notify(app, previous, new_state);
    update_connection_actions(new_state);

    if let ConnectionState::Connected { connected_at_ms, profile_summary, .. } = new_state {
        let app = app.clone();
        let connected_at_ms = *connected_at_ms;
        let profile_summary = profile_summary.clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_secs(1));
            // A newer transition happened — stop, the new one already
            // repainted the icon/tooltip for its own state.
            if TICK_GENERATION.load(Ordering::SeqCst) != generation {
                return;
            }
            if let Some(tray) = app.tray_by_id(TRAY_ID) {
                let text = i18n::tooltip_connected(&profile_summary, connected_at_ms, format_elapsed);
                let _ = tray.set_tooltip(Some(text));
            }
        });
    }
}

/// Called from `sysproxy::apply` after every re-evaluation (both on
/// connection-state changes and on user toggles), so the checkbox and the
/// Pause/Resume label always mirror the real, currently-in-effect
/// preference regardless of which surface (window, tray checkbox, tray
/// Pause item) last changed it.
///
/// Icon: connection state (idle/connected/busy/error — same as before) is
/// still the base color. System-proxy-Active is layered on top as a purple
/// accent, since it's a genuinely different fact ("traffic is actually
/// being routed through us right now") — not a replacement for the
/// connection color. The moment the proxy goes back off (user toggle, or a
/// disconnect), this repaints using the connection color again, since that
/// path (a pure toggle with no connection-state change) is the only call
/// that would otherwise leave a stale purple icon behind.
pub fn sync_system_proxy(
    app: &AppHandle,
    conn_state: &ConnectionState,
    user_enabled: bool,
    status: ProxyStatus,
) {
    {
        let items = TRAY_ITEMS.lock().unwrap();
        if let Some(items) = items.as_ref() {
            let _ = items.system_proxy.set_checked(user_enabled);
            let _ = items.pause_resume.set_text(if user_enabled {
                i18n::pause_protection()
            } else {
                i18n::resume_protection()
            });
        }
    }
    let icon_category =
        if status == ProxyStatus::Active { "proxy_active" } else { category(conn_state) };
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        if let Ok(icon) = Image::from_bytes(icon_bytes(icon_category)) {
            let _ = tray.set_icon(Some(icon));
        }
    }
}

/// Called from the `set_language` command right after `i18n::set`, so every
/// tray surface — menu labels and tooltip — updates immediately instead of
/// waiting for the next connection-state change or proxy toggle to happen
/// to repaint them.
pub fn retranslate(app: &AppHandle) {
    {
        let items = TRAY_ITEMS.lock().unwrap();
        if let Some(items) = items.as_ref() {
            let _ = items.open.set_text(i18n::open_app());
            let _ = items.connect.set_text(i18n::connect());
            let _ = items.disconnect.set_text(i18n::stop());
            let _ = items.system_proxy.set_text(i18n::system_proxy());
            // Pause/Resume's label depends on the current preference, not
            // just the language — re-derive it the same way
            // sync_system_proxy does rather than assuming "Pause".
            let user_enabled = settings::load(app).system_proxy_enabled;
            let _ = items.pause_resume.set_text(if user_enabled {
                i18n::pause_protection()
            } else {
                i18n::resume_protection()
            });
            let _ = items.quit.set_text(i18n::exit());
        }
    }
    if let Some(state) = app.try_state::<AppState>() {
        let status = state.manager.lock().unwrap().status();
        let _ = app.tray_by_id(TRAY_ID).map(|tray| tray.set_tooltip(Some(tooltip_text(&status))));
    }
}

fn update_connection_actions(state: &ConnectionState) {
    let items = TRAY_ITEMS.lock().unwrap();
    let Some(items) = items.as_ref() else { return };
    let idle_ish = matches!(state, ConnectionState::Idle | ConnectionState::Error { .. });
    let _ = items.connect.set_enabled(idle_ish);
    let _ = items.disconnect.set_enabled(!idle_ish);
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
        (_, ConnectionState::Connected { profile_summary, .. }) => {
            Some(i18n::notification_connected(profile_summary))
        }
        (ConnectionState::Connected { .. } | ConnectionState::Disconnecting, ConnectionState::Idle) => {
            Some(i18n::notification_disconnected().to_string())
        }
        (_, ConnectionState::Error { message, .. }) => Some(i18n::notification_error(message)),
        _ => None,
    };

    if let Some(body) = body {
        let _ =
            app.notification().builder().title(i18n::notification_title()).body(body).show();
    }
}
