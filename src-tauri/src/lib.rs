mod media;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            media::get_current_media,
            media::media_play_pause,
            media::media_next,
            media::media_prev,
            media::media_seek,
        ])
        .setup(|app| {
            let window = app.get_webview_window("notch-widget").unwrap();

            // Center the window horizontally on the primary monitor
            if let Some(monitor) = window.primary_monitor()? {
                let screen_size = monitor.size();
                let win_size = window.outer_size()?;
                let x = (screen_size.width as i32 - win_size.width as i32) / 2;
                window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y: 0 }))?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
