#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod aether;
mod commands;
mod error;
mod events;
mod focus;
mod singbox;
mod state;
mod tray;

use state::AppState;
use tauri::{Manager, WindowEvent};

#[cfg(windows)]
pub(crate) fn is_admin() -> bool {
    use windows_sys::Win32::UI::Shell::IsUserAnAdmin;
    unsafe { IsUserAnAdmin() != 0 }
}

#[cfg(windows)]
pub(crate) fn relaunch_as_admin() -> bool {
    use std::os::windows::ffi::OsStrExt;
    let exe = std::env::current_exe().expect("failed to get exe path");
    let mut exe_wide: Vec<u16> = exe.as_os_str().encode_wide().collect();
    exe_wide.push(0);
    let verb: Vec<u16> = "runas\0".encode_utf16().collect();
    let result = unsafe {
        windows_sys::Win32::UI::Shell::ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            exe_wide.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL,
        )
    };
    if result as isize > 32 {
        std::process::exit(0);
    }
    false // UAC denied or failed
}

#[cfg(target_os = "linux")]
pub(crate) fn is_admin() -> bool {
    unsafe { libc::getuid() == 0 }
}

#[cfg(target_os = "linux")]
pub(crate) fn relaunch_as_admin() -> bool {
    let exe = std::env::current_exe().expect("failed to get exe path");
    std::process::Command::new("pkexec")
        .arg(exe)
        .status()
        .map(|s| {
            if s.success() { std::process::exit(0); }
            false
        })
        .unwrap_or(false)
}

#[cfg(target_os = "macos")]
pub(crate) fn is_admin() -> bool {
    unsafe { libc::getuid() == 0 }
}

#[cfg(target_os = "macos")]
pub(crate) fn relaunch_as_admin() -> bool {
    let exe = std::env::current_exe().expect("failed to get exe path");
    std::process::Command::new("osascript")
        .args(["-e", &format!("do shell script \"{}\" with administrator privileges", exe.display())])
        .status()
        .map(|s| {
            if s.success() { std::process::exit(0); }
            false
        })
        .unwrap_or(false)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AppState::default())
        .setup(|app| {
            let data_dir = app.handle().path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            // Reap any Aether or sing-box process left running from a prior crash
            // before the user can click Connect and spawn a second one onto the
            // same port.
            aether::orphan::reap_orphan(&data_dir);
            singbox::reap_orphan(&data_dir);
            focus::spawn_watcher(app.handle().clone());
            tray::init(app)?;
            // Ensure the window is in the foreground after UAC elevation —
            // Windows does not automatically grant foreground rights to a
            // newly-spawned elevated process.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::connect,
            commands::disconnect,
            commands::get_status,
            commands::get_default_profile,
            commands::set_default_profile,
            commands::get_close_to_tray,
            commands::set_close_to_tray,
            commands::get_tun_status,
            commands::elevate,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if tray::get_close_to_tray() {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app_handle.state::<AppState>();
                let data_dir = app_handle
                    .path()
                    .app_data_dir()
                    .unwrap_or_else(|_| std::env::temp_dir());
                aether::shutdown_blocking(&state.manager, &state.singbox, &data_dir);
            }
        });
}
