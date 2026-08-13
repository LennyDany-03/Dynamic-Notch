mod clipboard;
mod icons;
mod launcher;
mod media;
mod notes;
mod notifications;
mod perf;
mod settings;
mod shelf;
mod system;
mod tray;
mod updater;

use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
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
        // HANDLE is a Copy type without a Rust destructor, so merely keeping the
        // value until here is enough: Windows owns the handle and releases it on
        // process exit, including a crash.
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
        .manage(settings::Current::default())
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
            notifications::notifications_available,
            notifications::notification_logo,
            notifications::dismiss_notification,
            notifications::clear_all_notifications,
            system::get_system_status,
            perf::get_performance,
            perf::power_action,
            tray::tray_menu_close,
            tray::tray_show_notch,
            tray::tray_navigate,
            tray::tray_autostart_enabled,
            tray::tray_set_autostart,
            tray::tray_quit,
            settings::read_settings,
            settings::set_always_on_top,
            settings::set_notifications,
            settings::set_system_alerts,
            settings::set_mute_windows_banners,
            settings::set_background_opacity,
            settings::set_notch_position,
            settings::set_hotzone_hint,
            settings::notch_raise,
            settings::notch_settle,
            settings::settings_open,
            settings::settings_close,
            updater::updater_check,
            updater::updater_install,
        ])
        .on_window_event(|window, event| {
            // A popup menu must close when it loses focus, the same as the native
            // one it replaces.
            if window.label() == tray::MENU_LABEL {
                if let tauri::WindowEvent::Focused(false) = event {
                    let _ = window.hide();
                }
            }

            // Settings is built once and reused, so a real close would destroy the
            // webview and leave `settings_open` with nothing to show. The window
            // has no title bar, but Alt+F4 still reaches it.
            if window.label() == settings::SETTINGS_LABEL {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            // Enable autostart on Windows login
            let _ = app.autolaunch().enable();

            clipboard::start_listener();

            // Consent for reading the notification centre, asked for once. On a
            // thread because the WinRT request is blocking and setup runs before
            // the first frame — a notch that appears a beat late on every launch
            // to ask about a feature the user may not have turned on is a worse
            // trade than the notch missing the first notification of the session.
            std::thread::spawn(notifications::request_access);

            // Before `settings::init`, which applies the banner preference and so
            // needs the memo of what Windows' own settings were beforehand.
            notifications::init(app.handle());

            // The window was just built from `tauri.conf.json`, which hardcodes
            // always-on-top. Anyone who turned that off expects it to stay off.
            //
            // This also places the window: `tauri.conf.json` can only pin `y`, and
            // where it sits along the top edge is a preference now, so the
            // horizontal centring that used to live here is `apply_position`'s.
            settings::init(app.handle());

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
        // Built rather than run outright so there is somewhere to hook `Exit`:
        // silencing Windows' notification banners is a system-wide change that
        // must not outlive the app making up for it. See `settings::shutdown`.
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                settings::shutdown(app);
            }
        });
}
