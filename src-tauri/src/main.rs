#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod aether;
mod commands;
mod error;
mod events;
mod focus;
mod prefs;
mod state;
mod tray;

use state::AppState;
use tauri::{Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        // Launched by the OS at login with `--minimized`: start in the tray.
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .manage(AppState::default())
        .setup(|app| {
            let data_dir = app.handle().path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            // Reap any Aether process left running from a prior crash before
            // the user can click Connect and spawn a second one onto the
            // same port.
            aether::orphan::reap_orphan(&data_dir);
            // A crash while the OS proxy pointed at the tunnel must not
            // leave the user offline.
            aether::sysproxy::restore_stale(app.handle());
            focus::spawn_watcher(app.handle().clone());
            tray::init(app)?;

            // The window starts hidden (tauri.conf.json) so an autostart
            // launch can stay in the tray without a flash.
            let minimized = std::env::args().any(|a| a == "--minimized");
            if let Some(w) = app.get_webview_window("main") {
                if !minimized {
                    let _ = w.show();
                }
            }

            // Connect on launch, with the last profile that worked. Zero
            // Trust profiles are skipped: their credentials are never saved.
            let handle = app.handle().clone();
            if prefs::get_bool(&handle, "auto_connect")
                && aether::profiles::load(&handle)
                    .zero_trust_team
                    .trim()
                    .is_empty()
            {
                let manager = app.state::<AppState>().manager.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(800));
                    let _ = aether::start_connect(handle, manager, None);
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::connect,
            commands::disconnect,
            commands::submit_access_code,
            commands::get_status,
            commands::get_default_profile,
            commands::set_default_profile,
            commands::get_close_to_tray,
            commands::set_close_to_tray,
            commands::get_autostart,
            commands::set_autostart,
            commands::get_auto_connect,
            commands::set_auto_connect,
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
                aether::shutdown_blocking(&state.manager, &data_dir);
                aether::sysproxy::restore(app_handle);
            }
        });
}
