use tauri::{LogicalSize, PhysicalPosition, WebviewWindow};

/// Native window shell: real Mica, rounded corners, and sizing.
///
/// Mica is an OS-level backdrop applied to a whole window — it cannot be scoped
/// to a region inside one. That is why the window is resized to match each card
/// rather than drawn inside a larger transparent canvas: anything else paints a
/// Mica rectangle across the desktop around the card.
///
/// It also samples the *wallpaper*, not the windows underneath, which is the
/// property the design depends on ("wallpaper faintly visible through Mica").
/// CSS `backdrop-filter` cannot reproduce this: in a transparent WebView2 window
/// it only blurs content inside the webview, so over a dark window it collapses to
/// a flat near-black slab.

#[cfg(target_os = "windows")]
pub fn apply_backdrop(window: &WebviewWindow) {
    // `Some(true)` selects the dark Mica variant.
    if let Err(err) = window_vibrancy::apply_mica(window, Some(true)) {
        // Mica needs Windows 11 22000+. On anything older the CSS surface in
        // index.css remains as the fallback, so this is not fatal.
        eprintln!("mica unavailable, falling back to the CSS surface: {err}");
    }
    round_corners(window);
}

#[cfg(not(target_os = "windows"))]
pub fn apply_backdrop(_window: &WebviewWindow) {}

#[cfg(target_os = "windows")]
fn round_corners(window: &WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND,
    };

    let Ok(handle) = window.hwnd() else { return };
    let preference = DWMWCP_ROUND;
    unsafe {
        let _ = DwmSetWindowAttribute(
            HWND(handle.0 as _),
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &preference as *const _ as *const core::ffi::c_void,
            std::mem::size_of_val(&preference) as u32,
        );
    }
}

/// Resize to a card size and re-centre against the top edge of the primary
/// monitor. Called on every state and module change.
#[tauri::command]
pub fn resize_notch(window: WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| e.to_string())?;

    let Ok(Some(monitor)) = window.primary_monitor() else {
        return Ok(());
    };
    let scale = monitor.scale_factor();
    let screen_width = monitor.size().width as f64;
    let x = ((screen_width - width * scale) / 2.0).round() as i32;

    window
        .set_position(PhysicalPosition { x, y: 0 })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_notch_visible(window: WebviewWindow, visible: bool) -> Result<(), String> {
    if visible {
        window.show().map_err(|e| e.to_string())
    } else {
        window.hide().map_err(|e| e.to_string())
    }
}
