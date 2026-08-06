mod clipboard;
mod launcher;
mod media;
mod notes;
mod notifications;
mod shelf;

use tauri::{Emitter, Manager};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_autostart::ManagerExt;

/// The notch is an always-on-top transparent window. Two instances blend their
/// cards together, which looks like UI from one module is leaking behind another
/// and also makes native drag gestures target the wrong window.
#[cfg(windows)]
fn acquire_instance_lock() -> bool {
    use windows::core::w;
    use windows::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};
    use windows::Win32::System::Threading::CreateMutexW;

    unsafe {
        let handle = match CreateMutexW(None, true, w!("Local\\com.lenny.crest.dynamic-notch")) {
            Ok(handle) => handle,
            Err(_) => return true,
        };
        if GetLastError() == ERROR_ALREADY_EXISTS {
            return false;
        }
        // Keep the mutex alive for the process lifetime; Windows releases it on
        // exit, including a crash.
        let _ = handle;
        true
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(windows)]
    if !acquire_instance_lock() {
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            media::get_current_media,
            media::media_play_pause,
            media::media_next,
            media::media_prev,
            media::media_seek,
            notes::read_notes,
            notes::write_notes,
            launcher::list_installed_apps,
            launcher::launch_app,
            launcher::read_pinned,
            launcher::write_pinned,
            clipboard::get_clipboard_history,
            clipboard::copy_to_clipboard,
            clipboard::clear_clipboard_history,
            shelf::read_shelf,
            shelf::write_shelf,
            shelf::start_file_drag,
            notifications::get_windows_notifications,
            notifications::dismiss_notification,
            notifications::clear_all_notifications,
        ])
        .setup(|app| {
            // Enable autostart on Windows login
            let _ = app.autolaunch().enable();

            clipboard::start_listener();

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
