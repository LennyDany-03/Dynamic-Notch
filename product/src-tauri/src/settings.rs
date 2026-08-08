//! Persisted preferences, and the window that edits them.
//!
//! Storage is the same shape as `notes.rs`: a flat JSON file in the app-data dir,
//! read on demand and rewritten whole. These are a handful of scalars with nothing
//! to query or join, so a database would buy nothing.
//!
//! Every field carries `#[serde(default = ...)]`. The first launch after any new
//! preference ships reads a file that predates it, and a bare `Deserialize` would
//! fail the whole parse and silently reset every *other* preference with it.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::tray::{hide_menu, NOTCH_LABEL};

pub const SETTINGS_LABEL: &str = "settings";

/// Must agree with `alwaysOnTop` on the `notch-widget` entry in
/// `tauri.conf.json`. The window is built from that config and only corrected
/// afterwards by `apply`, so a disagreement would flicker the notch behind other
/// windows on every launch.
fn always_on_top_default() -> bool {
    true
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// Whether the overlay is pinned above other windows. Off means it sits at
    /// normal z-order, i.e. behind whatever the user is working in.
    #[serde(default = "always_on_top_default")]
    pub always_on_top: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            always_on_top: always_on_top_default(),
        }
    }
}

/// In-memory copy of the preferences, seeded at startup.
///
/// `notch_settle` runs every time the overlay collapses, which is often enough
/// that it has no business reading a file. Disk stays the durable record; this is
/// what the running app answers from.
#[derive(Default)]
pub struct Current(Mutex<Settings>);

impl Current {
    /// A poisoned lock here means a previous holder panicked mid-update. The value
    /// behind it is a plain `bool`, so it cannot be half-written — recovering beats
    /// propagating a panic into every later call.
    fn get(&self) -> Settings {
        self.0.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }

    fn set(&self, settings: Settings) {
        *self.0.lock().unwrap_or_else(|e| e.into_inner()) = settings;
    }
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("could not create {dir:?}: {e}"))?;
    Ok(dir.join("settings.json"))
}

/// Read the stored preferences, falling back to defaults for anything that is
/// missing, unreadable or corrupt.
///
/// Infallible on purpose: this runs during `setup`, where the alternative to a
/// default is refusing to start over a preferences file.
pub fn load(app: &AppHandle) -> Settings {
    let Ok(path) = settings_path(app) else {
        return Settings::default();
    };
    let Ok(raw) = fs::read_to_string(&path) else {
        return Settings::default();
    };
    // Strip a UTF-8 BOM before parsing. `serde_json` rejects one outright, every
    // default Windows text editor writes it, and this is a file a user might
    // plausibly hand-edit — without this the whole set silently reverts to
    // defaults with nothing said.
    serde_json::from_str(raw.trim_start_matches('\u{feff}')).unwrap_or_default()
}

fn save(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let path = settings_path(app)?;
    let payload = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;

    // Write-then-rename, as in `notes.rs`: an interrupted save must not leave a
    // truncated file that reads back as "all preferences at default".
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, payload).map_err(|e| format!("could not write {tmp:?}: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("could not replace {path:?}: {e}"))?;
    Ok(())
}

/// Push the stored preferences onto the live windows.
///
/// Called at startup, on every change, and each time the overlay appears, so there
/// is exactly one place that knows how a preference maps onto window state.
fn apply_topmost(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let Some(notch) = app.get_webview_window(NOTCH_LABEL) else {
        return Err("notch window is unavailable".into());
    };

    // The bounce is load-bearing. tao caches its own `ALWAYS_ON_TOP` flag and
    // `apply_diff` returns early when the requested value equals the cached one —
    // so asking for `true` when it already believes `true` issues no `SetWindowPos`
    // at all. That cache says nothing about the real z-order: a fullscreen app or
    // another overlay can push this window out of the topmost band behind tao's
    // back, and from then on every re-assert is a silent no-op. Going through the
    // opposite value first guarantees a genuine z-order write. The window is
    // non-topmost for the microseconds between two calls queued onto the same
    // window thread, which is not observable.
    if enabled {
        notch
            .set_always_on_top(false)
            .map_err(|error| format!("could not clear always-on-top: {error}"))?;
    }
    notch
        .set_always_on_top(enabled)
        .map_err(|error| format!("could not set always-on-top: {error}"))?;

    // Tauri queues its own window updates on the main thread. Queue the native
    // operation there too, after those updates, so it is the final z-order write
    // rather than being overwritten by an earlier queued focus/show operation.
    #[cfg(windows)]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            GetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, HWND_NOTOPMOST, HWND_TOPMOST,
            SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOOWNERZORDER, SWP_NOSIZE, WS_EX_TOPMOST,
        };

        let hwnd = notch
            .hwnd()
            .map_err(|error| format!("could not get notch window handle: {error}"))?;
        let hwnd = hwnd.0 as isize;
        app.run_on_main_thread(move || {
            // Tauri currently exposes its handle through a newer `windows` crate
            // than this app's direct Win32 dependency. HWND is a transparent
            // pointer wrapper, so rebuilding it from the raw value is lossless.
            let native_hwnd = windows::Win32::Foundation::HWND(hwnd as _);
            let insert_after = if enabled {
                HWND_TOPMOST
            } else {
                HWND_NOTOPMOST
            };

            // Ask, then check that it landed, because `WS_EX_TOPMOST` is the bit
            // Windows actually picks the z-order band from and nothing above this
            // point reads it back — every failed request was previously silent.
            // A single retry is the whole budget: this runs on the window thread
            // on every appearance, and a request that fails twice is a condition
            // a third call will not clear either.
            for _ in 0..2 {
                unsafe {
                    if let Err(error) = SetWindowPos(
                        native_hwnd,
                        insert_after,
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER,
                    ) {
                        eprintln!("could not apply native always-on-top: {error}");
                        break;
                    }

                    let ex_style = GetWindowLongPtrW(native_hwnd, GWL_EXSTYLE) as u32;
                    if (ex_style & WS_EX_TOPMOST.0 != 0) == enabled {
                        break;
                    }
                }
            }
        })
        .map_err(|error| format!("could not reach the window thread: {error}"))?;
    }

    Ok(())
}

pub fn apply(app: &AppHandle, settings: &Settings) {
    let _ = apply_topmost(app, settings.always_on_top);
}

/// Read the file, apply it, and seed the in-memory copy. Startup only.
pub fn init(app: &AppHandle) {
    let stored = load(app);
    apply(app, &stored);
    if let Some(current) = app.try_state::<Current>() {
        current.set(stored);
    }
}

#[tauri::command]
pub fn read_settings(current: State<'_, Current>) -> Settings {
    current.get()
}

/// Put the overlay at the top of the topmost band, whatever the preference says.
/// Called every time the notch is about to be looked at — the cursor reaching for
/// it, or the card growing.
///
/// Unconditional on purpose. Being in the topmost band once is not the same as
/// staying at the top of it: the overlay never takes focus, so anything that goes
/// topmost afterwards — a maximised window, a fullscreen video — lands above it
/// and stays there. A notch that is drawn underneath the app you are using is a
/// notch that does not work, and that is true no matter which way the switch is
/// set: a surface you reached for and cannot see is indistinguishable from a
/// broken one.
///
/// What keeps the preference observable is `notch_settle`, its counterpart on the
/// way down. Promotion is scoped to the moments the notch is actually on screen;
/// the rest of the time the window sits in the band the switch selects. An earlier
/// version promoted here unconditionally *without* that counterpart, which left a
/// switched-off notch permanently topmost after the first hover — the two calls
/// only make sense as a pair.
#[tauri::command]
pub fn notch_raise(app: AppHandle) {
    let _ = apply_topmost(&app, true);
}

/// Return the overlay to the band the preference selects, called when the notch
/// has collapsed back out of sight.
///
/// This is what the switch actually buys once `notch_raise` promotes regardless
/// of it: with the preference off the window is topmost only for the moments a
/// card is drawn, and drops back to normal z-order as soon as the notch is gone.
/// A transparent, click-through window left in the topmost band is not merely
/// untidy — Windows weighs topmost windows when deciding whether an app may take
/// exclusive fullscreen.
///
/// With the preference on this is the same call `notch_raise` makes, and the
/// notch never collapses far enough to fire it anyway.
#[tauri::command]
pub fn notch_settle(app: AppHandle, current: State<'_, Current>) {
    let _ = apply_topmost(&app, current.get().always_on_top);
}

/// Apply and persist the always-on-top preference, returning the state actually
/// reached so the switch reflects the window rather than the request.
///
/// The window is changed before the file is written: the visible behaviour is
/// what the user asked about, and a disk error should cost them the preference at
/// next launch, not the change they just made.
#[tauri::command]
pub fn set_always_on_top(
    app: AppHandle,
    current: State<'_, Current>,
    enabled: bool,
) -> Result<bool, String> {
    let mut settings = current.get();
    settings.always_on_top = enabled;
    apply_topmost(&app, enabled)?;
    current.set(settings.clone());
    save(&app, &settings)?;

    // The notch decides from this whether its pill rests on screen or collapses
    // away, and the switch that moved lives in a different window. Broadcasting
    // is what closes that gap — neither window is ever rebuilt, so nothing else
    // would tell the notch until the next relaunch. Emitted after the write so a
    // listener can never see a value that failed to persist.
    let _ = app.emit("settings-changed", settings.clone());

    Ok(enabled)
}

/// Show the settings window, closing the tray popup that usually opened it so
/// focus does not bounce between the two.
#[tauri::command]
pub fn settings_open(app: AppHandle, current: State<'_, Current>) -> tauri::Result<()> {
    hide_menu(&app);

    let Some(win) = app.get_webview_window(SETTINGS_LABEL) else {
        return Ok(());
    };

    // Only centre a window that is coming back from hidden. Re-centring one that
    // is already up would yank it out from under a user who dragged it aside.
    if !win.is_visible().unwrap_or(false) {
        let _ = win.center();
    }
    let _ = win.unminimize();
    win.show()?;
    win.set_focus()?;

    // Showing and focusing Settings happens after the notch's startup promotion.
    // Re-apply the preference afterwards so this ordinary focused window cannot
    // cover a notch that is meant to stay above it. Routed through `apply` rather
    // than a hardcoded promotion so the switch being off is honoured here too.
    apply(&app, &current.get());

    // The window is hidden and reshown, never rebuilt, so React does not remount.
    // This is what tells it to re-read preferences that may have changed
    // elsewhere — autostart-style external edits, or the tray's own rows.
    let _ = win.emit("settings-opened", ());

    Ok(())
}

#[tauri::command]
pub fn settings_close(app: AppHandle) {
    if let Some(win) = app.get_webview_window(SETTINGS_LABEL) {
        let _ = win.hide();
    }
}
