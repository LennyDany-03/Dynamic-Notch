mod media;
mod notifications;

use tauri::{Emitter, Manager};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_autostart::ManagerExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            media::get_current_media,
            media::media_play_pause,
            media::media_next,
            media::media_prev,
            media::media_seek,
            notifications::get_windows_notifications,
            notifications::dismiss_notification,
            notifications::clear_all_notifications,
        ])
        .setup(|app| {
            // Enable autostart on Windows login
            let _ = app.autolaunch().enable();

            let window = app.get_webview_window("notch-widget").unwrap();

            // Center the window horizontally on the primary monitor
            if let Some(monitor) = window.primary_monitor()? {
                let screen_size = monitor.size();
                let win_size = window.outer_size()?;
                let x = (screen_size.width as i32 - win_size.width as i32) / 2;
                window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y: 0 }))?;
            }

            // System tray menu
            let show = MenuItem::with_id(app, "show", "Show Notch", true, None::<&str>)?;
            let music = MenuItem::with_id(app, "music", "Music Player", true, None::<&str>)?;
            let calendar = MenuItem::with_id(app, "calendar", "Calendar", true, None::<&str>)?;
            let notif = MenuItem::with_id(app, "notifications", "Notifications", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &show,
                    &PredefinedMenuItem::separator(app)?,
                    &music,
                    &calendar,
                    &notif,
                    &PredefinedMenuItem::separator(app)?,
                    &quit,
                ],
            )?;

            let icon = app.default_window_icon().cloned()
                .expect("failed to load tray icon");

            TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .tooltip("Crest")
                .on_menu_event(|app, event| {
                    let window = app.get_webview_window("notch-widget");
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(w) = window {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        tab @ ("music" | "calendar" | "notifications") => {
                            if let Some(w) = window {
                                let _ = w.show();
                                let _ = w.set_focus();
                                let _ = w.emit("tray-navigate", tab.to_string());
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button, .. } = event {
                        if matches!(button, MouseButton::Left) {
                            let window = tray.app_handle().get_webview_window("notch-widget");
                            if let Some(w) = window {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
