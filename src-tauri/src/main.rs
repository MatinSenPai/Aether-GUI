#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod aether;
mod commands;
mod error;
mod events;
mod focus;
mod settings;
mod state;
mod sysproxy;
mod tray;

use state::AppState;
use tauri::{Manager, WindowEvent};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            // Passed to the binary when Windows/macOS launches it at login,
            // so `setup` can tell "OS autostart" apart from a manual
            // double-click even if the user's `start_minimized` setting is
            // off — autostart launches always start hidden to the tray.
            Some(vec!["--minimized".into()]),
        ))
        .manage(AppState::default())
        .setup(|app| {
            let data_dir = app.handle().path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            // Reap any Aether process left running from a prior crash before
            // the user can click Connect and spawn a second one onto the
            // same port.
            aether::orphan::reap_orphan(&data_dir);
            focus::spawn_watcher(app.handle().clone());

            // System tray: closing the window hides it instead of quitting
            // (handled in on_window_event below), so the tray is the only
            // way to fully exit while a tunnel may still be running. Icon
            // and tooltip start at "Idle" here and are repainted live from
            // aether::set_state_and_emit via tray::on_state_change.
            tray::build(app.handle())?;

            // The main window is created hidden (see tauri.conf.json) so an
            // autostart/minimized launch never flashes it on screen; show it
            // now unless the user asked to start minimized, or the OS
            // launched us at login with the --minimized flag.
            let app_settings = settings::load(app.handle());
            let launched_minimized = std::env::args().any(|a| a == "--minimized");
            if !(app_settings.start_minimized || launched_minimized) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            if app_settings.auto_connect {
                let app_handle = app.handle().clone();
                let manager = app.state::<AppState>().manager.clone();
                // Give orphan-reap and the tray a moment to settle before
                // spawning Aether, rather than racing app startup.
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(300));
                    let _ = aether::start_connect(app_handle, manager, None);
                });
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Clicking the window's close button hides it to the tray
            // instead of exiting the app, so an active tunnel keeps running
            // in the background. Real shutdown only happens via the tray's
            // "Exit" item (which calls app.exit(0) and triggers RunEvent::Exit
            // below).
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::connect,
            commands::disconnect,
            commands::get_status,
            commands::get_default_profile,
            commands::set_default_profile,
            commands::get_app_settings,
            commands::set_start_minimized,
            commands::set_auto_connect,
            commands::set_launch_on_startup,
            commands::get_system_proxy_enabled,
            commands::set_system_proxy_enabled,
        ])
        .build(tauri::generate_context!())
        .expect("error building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                sysproxy::restore_if_active();
                let state = app_handle.state::<AppState>();
                let data_dir = app_handle
                    .path()
                    .app_data_dir()
                    .unwrap_or_else(|_| std::env::temp_dir());
                aether::shutdown_blocking(&state.manager, &data_dir);
            }
        });
}