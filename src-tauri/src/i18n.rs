use crate::state::ConnectionState;
use std::sync::atomic::{AtomicU8, Ordering};

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Lang {
    En,
    Fa,
}

impl Lang {
    pub fn from_code(code: &str) -> Lang {
        if code == "fa" { Lang::Fa } else { Lang::En }
    }

    pub fn code(self) -> &'static str {
        match self {
            Lang::En => "en",
            Lang::Fa => "fa",
        }
    }
}

// Read far more often (every tooltip tick, every menu repaint) than written
// (only on an explicit language change), so a plain atomic beats a Mutex —
// no blocking, and callers never need to worry about poisoning.
static CURRENT: AtomicU8 = AtomicU8::new(0); // 0 = En, 1 = Fa

/// Call once from `main.rs::setup`, before `tray::build`, so the tray is
/// built with the right language from its very first frame instead of
/// flashing English and then retranslating.
pub fn init(app: &tauri::AppHandle) {
    set(Lang::from_code(&crate::settings::load(app).language));
}

pub fn set(lang: Lang) {
    CURRENT.store(if lang == Lang::Fa { 1 } else { 0 }, Ordering::SeqCst);
}

pub fn current() -> Lang {
    if CURRENT.load(Ordering::SeqCst) == 1 { Lang::Fa } else { Lang::En }
}

// --- Tray menu item labels -------------------------------------------------

pub fn open_app() -> &'static str {
    match current() {
        Lang::En => "Open Aether-GUI",
        Lang::Fa => "باز کردن Aether-GUI",
    }
}

pub fn connect() -> &'static str {
    match current() {
        Lang::En => "Connect",
        Lang::Fa => "اتصال",
    }
}

pub fn stop() -> &'static str {
    match current() {
        Lang::En => "Stop",
        Lang::Fa => "توقف",
    }
}

pub fn pause_protection() -> &'static str {
    match current() {
        Lang::En => "Pause Protection",
        Lang::Fa => "توقف موقت محافظت",
    }
}

pub fn resume_protection() -> &'static str {
    match current() {
        Lang::En => "Resume Protection",
        Lang::Fa => "از سرگیری محافظت",
    }
}

pub fn system_proxy() -> &'static str {
    match current() {
        Lang::En => "System Proxy",
        Lang::Fa => "پراکسی سیستم",
    }
}

pub fn exit() -> &'static str {
    match current() {
        Lang::En => "Exit",
        Lang::Fa => "خروج",
    }
}

// --- Tray tooltip -----------------------------------------------------------

fn app_name() -> &'static str {
    // Kept untranslated on purpose — it's a proper noun/brand name, the one
    // string a Persian speaker would still expect in Latin script.
    "Aether-GUI"
}

/// Used both by `tooltip` (below) for a fresh Connected transition and by
/// tray.rs's per-second ticker, which only has `profile_summary` +
/// `connected_at_ms` on hand and shouldn't need to reconstruct a whole
/// `ConnectionState::Connected { .. }` just to ask for a tooltip string.
pub fn tooltip_connected(profile_summary: &str, connected_at_ms: u64, format_elapsed: impl Fn(u64) -> String) -> String {
    match current() {
        Lang::En => format!(
            "{} · Connected · {} · {}",
            app_name(),
            profile_summary,
            format_elapsed(connected_at_ms)
        ),
        Lang::Fa => format!(
            "{} · متصل · {} · {}",
            app_name(),
            profile_summary,
            format_elapsed(connected_at_ms)
        ),
    }
}

pub fn tooltip(state: &ConnectionState, format_elapsed: impl Fn(u64) -> String) -> String {
    match current() {
        Lang::En => match state {
            ConnectionState::Idle => format!("{} · Idle", app_name()),
            ConnectionState::Launching => format!("{} · Starting…", app_name()),
            ConnectionState::Connecting => format!("{} · Finding a route…", app_name()),
            ConnectionState::Connected { connected_at_ms, profile_summary, .. } => {
                tooltip_connected(profile_summary, *connected_at_ms, format_elapsed)
            }
            ConnectionState::Reconnecting { attempt, max_attempts } => {
                format!("{} · Reconnecting ({attempt}/{max_attempts})", app_name())
            }
            ConnectionState::Disconnecting => format!("{} · Disconnecting…", app_name()),
            ConnectionState::Error { .. } => format!("{} · Error", app_name()),
        },
        Lang::Fa => match state {
            ConnectionState::Idle => format!("{} · غیرفعال", app_name()),
            ConnectionState::Launching => format!("{} · در حال شروع…", app_name()),
            ConnectionState::Connecting => format!("{} · در حال یافتن مسیر…", app_name()),
            ConnectionState::Connected { connected_at_ms, profile_summary, .. } => {
                tooltip_connected(profile_summary, *connected_at_ms, format_elapsed)
            }
            ConnectionState::Reconnecting { attempt, max_attempts } => {
                format!("{} · اتصال مجدد ({attempt}/{max_attempts})", app_name())
            }
            ConnectionState::Disconnecting => format!("{} · در حال قطع اتصال…", app_name()),
            ConnectionState::Error { .. } => format!("{} · خطا", app_name()),
        },
    }
}

// --- OS notifications --------------------------------------------------------

pub fn notification_title() -> &'static str {
    app_name()
}

pub fn notification_connected(profile_summary: &str) -> String {
    match current() {
        Lang::En => format!("Connected — {profile_summary}"),
        Lang::Fa => format!("متصل شد — {profile_summary}"),
    }
}

pub fn notification_disconnected() -> &'static str {
    match current() {
        Lang::En => "Disconnected.",
        Lang::Fa => "اتصال قطع شد.",
    }
}

pub fn notification_error(message: &str) -> String {
    match current() {
        Lang::En => format!("Connection error: {message}"),
        Lang::Fa => format!("خطای اتصال: {message}"),
    }
}
