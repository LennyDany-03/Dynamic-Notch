//! Tray popup — a webview menu instead of the native Win32 one.
//!
//! `Menu`/`MenuItem` hand the drawing to the OS, which means no Mica, no radius,
//! no motion — the menu could never match the notch it belongs to. So the tray
//! carries no menu at all: a right-click positions a borderless always-on-top
//! window against the taskbar and shows it, and the popup renders in React from
//! the same tokens as every other surface.
//!
//! The window is built at startup and reused. Creating it on demand would cost a
//! WebView2 spin-up on the first right-click, which is far too slow for a menu.

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};
use tauri_plugin_autostart::ManagerExt;

pub const MENU_LABEL: &str = "tray-menu";
pub const NOTCH_LABEL: &str = "notch-widget";

/// Logical px held between the popup's *card* and the work-area edge it docks
/// against.
const EDGE_GAP: f64 = 8.0;

/// Logical px of transparent gutter the webview leaves around the visible card so
/// it can cast a shadow. Mirrors `MARGIN` in `TrayMenu.tsx` — the window is the
/// card plus twice this on each axis, and that component sizes the window to
/// match, so this is a reader of that relationship rather than a second source.
const CARD_MARGIN: f64 = 12.0;

/// Place the popup near `cursor` and show it.
///
/// Anchors to the monitor's *work area* rather than its full bounds, so the popup
/// lands flush above the taskbar instead of underneath it — and anchors the
/// **card**, not the window. Those are not the same rectangle: the window is
/// `CARD_MARGIN` larger on every side, so positioning the window put the card
/// 12px further from the taskbar and 12px further from the screen edge than the
/// gap asks for, and pushed it off the icon it belongs to.
pub fn show_menu(app: &AppHandle, cursor: PhysicalPosition<f64>) -> tauri::Result<()> {
    let Some(win) = app.get_webview_window(MENU_LABEL) else {
        return Ok(());
    };

    // Read at show time, not from the config: `TrayMenu.tsx` sizes this window to
    // whatever its rows actually measure, so adding a row cannot leave the popup
    // clipped or mispositioned against a stale number.
    let size = win.outer_size()?;
    let (w, h) = (size.width as f64, size.height as f64);

    // The tray may sit on a secondary monitor with its own scale factor, so the
    // monitor under the cursor decides the anchor rect, the gap and the gutter.
    let monitor = match app.monitor_from_point(cursor.x, cursor.y)? {
        Some(m) => Some(m),
        None => app.primary_monitor()?,
    };

    let (x, y) = match monitor {
        Some(m) => {
            let area = m.work_area();
            let scale = m.scale_factor();
            let gap = EDGE_GAP * scale;
            let gutter = CARD_MARGIN * scale;

            // The card, which is what the user sees and what has to clear the
            // taskbar. The window is this plus a gutter on every side.
            let card_w = (w - gutter * 2.0).max(1.0);
            let card_h = (h - gutter * 2.0).max(1.0);

            let left = area.position.x as f64;
            let top = area.position.y as f64;
            let right = left + area.size.width as f64;
            let bottom = top + area.size.height as f64;

            // Centred on the icon that was clicked, then held inside the work
            // area. `max` keeps the clamp valid if the card is wider than it.
            let card_x =
                (cursor.x - card_w / 2.0).clamp(left + gap, (right - card_w - gap).max(left + gap));

            // The tray lives on the taskbar, so the click tells us which edge the
            // taskbar is docked to: past the midpoint means bottom, so open upward.
            let card_y = if cursor.y > (top + bottom) / 2.0 {
                bottom - card_h - gap
            } else {
                top + gap
            };

            // Back out to the window's own origin.
            (card_x - gutter, card_y - gutter)
        }
        // No monitor info, so no scale factor to convert the gutter with. Hang the
        // window above the cursor and accept being a gutter off.
        None => (cursor.x - w / 2.0, cursor.y - h),
    };

    win.set_position(PhysicalPosition {
        x: x.round() as i32,
        y: y.round() as i32,
    })?;
    win.show()?;
    win.set_focus()?;

    // The window is reused, so React never remounts — this is what replays the
    // open animation.
    let _ = win.emit("tray-menu-opened", ());

    Ok(())
}

/// Dismiss the popup. Anything that opens another surface calls this first, so
/// focus never bounces between the popup and whatever it launched.
pub(crate) fn hide_menu(app: &AppHandle) {
    if let Some(win) = app.get_webview_window(MENU_LABEL) {
        let _ = win.hide();
    }
}

/// Bring the notch up and hand it an intent, closing the popup first so focus
/// does not bounce between the two windows.
fn reveal_notch(app: &AppHandle, event: &str, payload: Option<String>) {
    hide_menu(app);

    if let Some(notch) = app.get_webview_window(NOTCH_LABEL) {
        let _ = notch.show();
        let _ = notch.set_focus();
        // The window is always visible; the React state machine decides whether a
        // card is drawn. Only this event actually opens the notch.
        let _ = match payload {
            Some(value) => notch.emit(event, value),
            None => notch.emit(event, ()),
        };
    }
}

/// Open the notch. Shared by the popup's first row and by a left-click on the
/// tray icon, which should do the same thing.
pub fn show_notch(app: &AppHandle) {
    reveal_notch(app, "tray-show", None);
}

#[tauri::command]
pub fn tray_menu_close(app: AppHandle) {
    hide_menu(&app);
}

#[tauri::command]
pub fn tray_show_notch(app: AppHandle) {
    show_notch(&app);
}

#[tauri::command]
pub fn tray_navigate(app: AppHandle, module: String) {
    reveal_notch(&app, "tray-navigate", Some(module));
}

#[tauri::command]
pub fn tray_autostart_enabled(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
pub fn tray_set_autostart(app: AppHandle, enabled: bool) -> bool {
    let manager = app.autolaunch();
    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };

    // Report the state actually reached, not the one asked for, so a failed write
    // snaps the toggle back instead of lying.
    match result {
        Ok(()) => enabled,
        Err(_) => manager.is_enabled().unwrap_or(false),
    }
}

#[tauri::command]
pub fn tray_quit(app: AppHandle) {
    app.exit(0);
}
