#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod aether;
mod commands;
mod error;
mod events;
mod focus;
mod singbox;
mod state;

use state::AppState;
use tauri::Manager;

#[cfg(windows)]
fn is_admin() -> bool {
    std::process::Command::new("net")
        .args(["session"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[cfg(windows)]
fn relaunch_as_admin() {
    use std::os::windows::ffi::OsStrExt;
    let exe = std::env::current_exe().expect("failed to get exe path");
    let mut exe_wide: Vec<u16> = exe.as_os_str().encode_wide().collect();
    exe_wide.push(0);
    let verb: Vec<u16> = "runas\0".encode_utf16().collect();
    unsafe {
        windows_sys::Win32::UI::Shell::ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            exe_wide.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL,
        );
    }
    std::process::exit(0);
}

fn main() {
    #[cfg(windows)]
    if !is_admin() {
        relaunch_as_admin();
    }

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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::connect,
            commands::disconnect,
            commands::get_status,
            commands::get_default_profile,
            commands::set_default_profile,
            commands::get_tun_status,
        ])
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
