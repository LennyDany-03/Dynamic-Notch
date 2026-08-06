mod clipboard;
mod icons;
mod launcher;
mod media;
mod notes;
mod notifications;
mod shelf;
mod tray;
mod updater;

use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(updater::PendingUpdate::default())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
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
            icons::app_icon,
            clipboard::get_clipboard_history,
            clipboard::copy_to_clipboard,
            clipboard::clear_clipboard_history,
            shelf::read_shelf,
            shelf::write_shelf,
            shelf::start_file_drag,
            notifications::get_windows_notifications,
            notifications::dismiss_notification,
            notifications::clear_all_notifications,
            tray::tray_menu_close,
            tray::tray_show_notch,
            tray::tray_navigate,
            tray::tray_autostart_enabled,
            tray::tray_set_autostart,
            tray::tray_quit,
            updater::updater_check,
            updater::updater_install,
        ])
        // A popup menu must close when it loses focus, the same as the native one
        // it replaces.
        .on_window_event(|window, event| {
            if window.label() == tray::MENU_LABEL {
                if let tauri::WindowEvent::Focused(false) = event {
                    let _ = window.hide();
                }
            }
        })
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
                window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                    x,
                    y: 0,
                }))?;
            }

            let icon = app
                .default_window_icon()
                .cloned()
                .expect("failed to load tray icon");

            // No `.menu()` — a native menu cannot be styled, so the popup in
            // `tray.rs` stands in for it. See that module for why.
            TrayIconBuilder::new()
                .icon(icon)
                .tooltip("Crest")
                .on_tray_icon_event(|tray, event| {
                    let TrayIconEvent::Click {
                        button,
                        button_state,
                        position,
                        ..
                    } = event
                    else {
                        return;
                    };
                    // Windows reports both press and release; acting on each would
                    // open the popup and then immediately toggle it shut.
                    if button_state != MouseButtonState::Up {
                        return;
                    }

                    let app = tray.app_handle();
                    match button {
                        MouseButton::Left => {
                            tray::show_notch(app);
                        }
                        MouseButton::Right => {
                            let _ = tray::show_menu(app, position);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
