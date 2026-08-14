//! Which screens the notch lives on.
//!
//! Everything else in this app treats the overlay as one window pinned to the top
//! of the primary monitor. That was true right up until a second screen was
//! plugged in, at which point "the notch" is a question with three answers: which
//! screen it is on, whether it is on all of them, and what happens to that choice
//! when the screen it named is unplugged.
//!
//! Two preferences and one watcher answer all three:
//!
//!  - `notch_display` names a screen, or `None` for "wherever the primary is".
//!  - `notch_all_displays` mirrors the notch onto every screen.
//!  - a poll notices the set of monitors changing and re-applies both.
//!
//! **A named screen that is not connected falls back to the primary without the
//! preference being rewritten.** That is the whole of the disconnect behaviour, and
//! the reason it is a fallback rather than a reset: a laptop that is docked every
//! morning and undocked every evening would otherwise forget the docked monitor
//! the first time it was unplugged, and the user would have to re-pick it daily.
//! Falling back at apply time means the notch comes home when the screen goes and
//! goes back when it returns, and nobody has to say so twice.
//!
//! ## The mirror windows
//!
//! Mirroring is real windows, not one window stretched: the overlay is a fixed
//! 560×420 transparent canvas pinned to one screen's top edge, and there is no
//! single rectangle that is the top edge of two monitors. So each extra screen
//! gets its own window, labelled `notch-widget-2`, `-3`, …, loading the same
//! bundle and mounting the same `App`. They are built on demand and destroyed when
//! their screen goes away.
//!
//! `notch-widget` itself is never destroyed — it is built from `tauri.conf.json`,
//! several other modules look it up by name, and the whole app quits with it. It
//! is always the *first* target, and the target list is ordered primary-first, so
//! the original window stays on the primary screen whenever the primary has a
//! notch at all.
//!
//! Each mirror is a full instance of the notch, with its own cursor poll and its
//! own watchers. That is the price of the feature and it is mostly paid in WinRT
//! round trips. The one thing that must *not* be duplicated is the auto-updater —
//! two copies would race to spend the same parked update — so `App` runs it only
//! in the lead window. See `useAutoUpdate`'s caller.

use std::time::Duration;

use serde::Serialize;
use tauri::window::Monitor;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::settings::{NotchPosition, Settings};
use crate::tray::NOTCH_LABEL;

/// Label prefix for the extra windows mirroring puts on the other screens. The
/// number is the target's index plus one, so the first mirror is `notch-widget-2`
/// — `notch-widget` is display one and has no suffix.
pub const MIRROR_PREFIX: &str = "notch-widget-";

/// The overlay's canvas, in logical px. Mirrors the `notch-widget` entry in
/// `tauri.conf.json`, which is where the original window's copy lives; a mirror is
/// built here instead, so the two have to agree. Never resized — cards animate
/// inside it (see `Architecture.md`).
const CANVAS_W: f64 = 560.0;
const CANVAS_H: f64 = 420.0;

/// How often the monitor set is re-read.
///
/// A poll rather than `WM_DISPLAYCHANGE`, which would mean subclassing a window
/// procedure to reach a message tao already owns. Three seconds is the cost of
/// enumerating monitors twenty times a minute, which is nothing, and the latency a
/// user sees between plugging a screen in and the notch appearing on it. Windows
/// itself takes about that long to finish rearranging the desktop.
const WATCH_MS: u64 = 3_000;

/// Whether a window label belongs to the notch — the original or a mirror.
///
/// Anything that used to compare against `NOTCH_LABEL` and means "the overlay"
/// rather than "that specific window" goes through this instead.
pub fn is_notch(label: &str) -> bool {
    label == NOTCH_LABEL || label.starts_with(MIRROR_PREFIX)
}

/// Every notch window currently built, in no particular order.
pub fn notch_windows(app: &AppHandle) -> Vec<WebviewWindow> {
    app.webview_windows()
        .into_iter()
        .filter(|(label, _)| is_notch(label))
        .map(|(_, window)| window)
        .collect()
}

/// A stable-enough key for a monitor.
///
/// Windows hands tao the adapter's device name (`\\.\DISPLAY1`), which survives a
/// reboot and a resolution change but is positional rather than tied to the panel
/// — swapping two monitors' cables swaps their ids. That is the identity the OS
/// itself uses for "which screen", and inventing a better one would mean EDID
/// parsing for a preference whose failure mode is the notch appearing on the wrong
/// screen until the user picks again.
///
/// The geometry fallback is for a driver that reports no name at all. It changes
/// if the display is moved in the desktop layout, which is why it is a fallback.
fn monitor_id(monitor: &Monitor) -> String {
    if let Some(name) = monitor.name() {
        if !name.trim().is_empty() {
            return name.clone();
        }
    }
    let position = monitor.position();
    let size = monitor.size();
    format!("@{},{}:{}x{}", position.x, position.y, size.width, size.height)
}

/// What to call a screen in the picker.
///
/// `\\.\DISPLAY2` is the id and not a name anybody would choose to read, so the
/// tail is unwrapped into "Display 2" — which is also what Windows' own display
/// settings numbers them, so the picker and the Settings app agree. Anything that
/// is not in that shape is shown as-is, and a nameless monitor falls back to its
/// position in the list.
fn friendly(id: &str, index: usize) -> String {
    let tail = id.rsplit('\\').next().unwrap_or(id).trim();

    if let Some(number) = tail.strip_prefix("DISPLAY") {
        if !number.is_empty() && number.chars().all(|c| c.is_ascii_digit()) {
            return format!("Display {number}");
        }
    }
    if tail.is_empty() || tail.starts_with('@') {
        return format!("Display {}", index + 1);
    }
    tail.to_string()
}

fn monitors(app: &AppHandle) -> Vec<Monitor> {
    app.available_monitors().unwrap_or_default()
}

/// One screen, as the Display pane draws it.
///
/// Carries the geometry because the picker is a *map* rather than a list: two
/// screens side by side and two stacked are the same two rows of text and
/// completely different desktops, and the user picks the one they can point at.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DisplayInfo {
    pub id: String,
    pub name: String,
    /// Whether Windows considers this the primary display.
    pub primary: bool,
    /// Physical bounds in virtual-desktop coordinates. The picker only ever uses
    /// these relative to each other, so the units do not matter to it.
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
    /// Whether the notch is on this screen *right now*.
    ///
    /// Resolved rather than compared against the stored preference, which is what
    /// makes the fallback visible: a user who picked a monitor that is currently
    /// unplugged sees the notch marked on their primary, which is where it is.
    pub active: bool,
}

/// Every connected screen, and which of them the notch is on.
#[tauri::command]
pub fn list_displays(app: AppHandle) -> Vec<DisplayInfo> {
    let settings = crate::settings::current(&app);
    let all = monitors(&app);
    let primary = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|monitor| monitor_id(&monitor));

    let occupied: Vec<String> = targets(&app, &settings).iter().map(monitor_id).collect();

    all.iter()
        .enumerate()
        .map(|(index, monitor)| {
            let id = monitor_id(monitor);
            let position = monitor.position();
            let size = monitor.size();
            DisplayInfo {
                name: friendly(&id, index),
                primary: primary.as_deref() == Some(id.as_str()),
                active: occupied.contains(&id),
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
                scale: monitor.scale_factor(),
                id,
            }
        })
        .collect()
}

/// The screens that should be carrying a notch, in window order.
///
/// Primary first when it is in the set, so `notch-widget` — the window built from
/// the config, the one every other module looks up by name — stays on the primary
/// screen whenever the primary screen has a notch at all. Mirroring should not
/// quietly move the original window somewhere else.
///
/// The single-screen case is where the disconnect rule lives: a stored id that no
/// longer matches anything falls through to the primary, and the preference is
/// left alone so the choice comes back with the cable.
fn targets(app: &AppHandle, settings: &Settings) -> Vec<Monitor> {
    let all = monitors(app);
    if all.is_empty() {
        return Vec::new();
    }

    let primary = app.primary_monitor().ok().flatten().map(|m| monitor_id(&m));

    if settings.notch_all_displays {
        let mut ordered = all;
        // `sort_by_key` is stable, so this only lifts the primary to the front and
        // leaves the driver's own order intact behind it.
        ordered.sort_by_key(|monitor| {
            usize::from(primary.as_deref() != Some(monitor_id(monitor).as_str()))
        });
        return ordered;
    }

    let chosen = settings
        .notch_display
        .as_deref()
        .and_then(|wanted| all.iter().find(|m| monitor_id(m) == wanted).cloned());

    let one = chosen
        .or_else(|| app.primary_monitor().ok().flatten())
        .or_else(|| all.first().cloned());

    one.into_iter().collect()
}

/// Put a notch window on a screen, at the end of the top edge the position
/// preference names.
///
/// The physical width is derived from the scale factor rather than read back with
/// `outer_size`, and that is not an optimisation. Windows rescales a window when it
/// crosses onto a display with a different DPI, so a size read *before* the move is
/// in the old screen's pixels and one read after needs the move to have landed
/// first — which would mean positioning twice and watching the notch jump from the
/// left edge to wherever it belongs. The canvas is fixed at 560 logical px, so its
/// physical width on any screen is exactly that times the scale.
fn place(window: &WebviewWindow, monitor: &Monitor, position: NotchPosition) -> tauri::Result<()> {
    let origin = monitor.position();
    let width = (CANVAS_W * monitor.scale_factor()).round() as i32;
    let span = (monitor.size().width as i32 - width).max(0);

    window.set_position(PhysicalPosition {
        x: origin.x + position.offset(span),
        y: origin.y,
    })
}

/// Build one of the extra windows mirroring puts on the other screens.
///
/// Every flag here mirrors the `notch-widget` entry in `tauri.conf.json`, with two
/// deliberate differences. It is born hidden and shown once `place` has run, so it
/// never flashes at whatever origin the OS would have picked; and always-on-top is
/// left off, because `settings::apply` sets it for every notch window a moment
/// later and having it on here would mean two sources for one preference.
///
/// **This call deadlocks if it runs on the main thread while the event loop is
/// live** — building a WebView2 instance from inside a webview's own IPC handler is
/// a documented wry problem (wry#583), and Tauri's guidance is to build windows
/// from async commands or separate threads. It is the reason `settings` has an
/// `apply_detached` at all, and the reason `place_all` exists as the half that can
/// run anywhere. Nothing on the main thread reaches this, startup included.
fn build_mirror(app: &AppHandle, label: &str, monitor: &Monitor) -> tauri::Result<WebviewWindow> {
    let window = WebviewWindowBuilder::new(app, label, WebviewUrl::default())
        .title("")
        .inner_size(CANVAS_W, CANVAS_H)
        .min_inner_size(CANVAS_W, CANVAS_H)
        .max_inner_size(CANVAS_W, CANVAS_H)
        .decorations(false)
        .transparent(true)
        .always_on_top(false)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .visible(false)
        .focused(false)
        .build()?;

    place(&window, monitor, NotchPosition::Center)?;
    Ok(window)
}

/// Which window label belongs on which screen.
///
/// The one place that pairs the two, so `apply` and `place_all` cannot disagree
/// about where `notch-widget-2` lives.
fn assignments(app: &AppHandle, settings: &Settings) -> Vec<(String, Monitor)> {
    targets(app, settings)
        .into_iter()
        .enumerate()
        .map(|(index, monitor)| {
            let label = if index == 0 {
                NOTCH_LABEL.to_string()
            } else {
                format!("{MIRROR_PREFIX}{}", index + 1)
            };
            (label, monitor)
        })
        .collect()
}

/// Position the notch windows that already exist, and build or destroy nothing.
///
/// The half of `apply` that is safe to run on the main thread. `settings::init`
/// calls it during `setup`, where the window has to reach its final position before
/// the first frame — a detached placement would paint the notch at whatever origin
/// the OS chose and slide it over afterwards — and where `apply`'s window building
/// is the deadlock this module's callers are all arranged around. See
/// `settings::apply_detached`.
pub fn place_all(app: &AppHandle, settings: &Settings) {
    for (label, monitor) in assignments(app, settings) {
        if let Some(window) = app.get_webview_window(&label) {
            let _ = place(&window, &monitor, settings.notch_position);
        }
    }
}

/// Put the notch on the screens the preferences ask for, building and retiring
/// mirror windows as the answer changes.
///
/// Called from `settings::apply`, so it runs at startup, on every preference
/// change, every time Settings is opened, and whenever the monitor set changes. It
/// is idempotent: on the common call nothing is built or destroyed and each
/// existing window is re-positioned to where it already is.
///
/// **Not safe on the main thread while the event loop is live**, because
/// `build_mirror` is not — see it, and `settings::apply_detached`, which is how
/// every command reaches this.
pub fn apply(app: &AppHandle, settings: &Settings) {
    let assignments = assignments(app, settings);
    if assignments.is_empty() {
        // No monitors at all — a locked session or a display asleep mid-poll.
        // Leaving every window where it is beats destroying the mirrors and
        // rebuilding them a moment later.
        return;
    }

    let mut wanted: Vec<String> = Vec::with_capacity(assignments.len());

    for (label, monitor) in &assignments {
        wanted.push(label.clone());

        let window = match app.get_webview_window(label) {
            Some(existing) => existing,
            None => match build_mirror(app, label, monitor) {
                Ok(built) => built,
                Err(error) => {
                    eprintln!("could not open a notch on {label}: {error}");
                    continue;
                }
            },
        };

        if let Err(error) = place(&window, monitor, settings.notch_position) {
            eprintln!("could not place {label}: {error}");
        }
        let _ = window.show();
    }

    // Retire the mirrors nothing wants any more — mirroring switched off, or a
    // screen unplugged. Only the mirrors: `notch-widget` is always target zero and
    // destroying it would take the app's own window out from under it.
    for (label, window) in app.webview_windows() {
        if label.starts_with(MIRROR_PREFIX) && !wanted.contains(&label) {
            let _ = window.destroy();
        }
    }
}

/// A cheap value that changes exactly when the desktop layout does.
///
/// Ids alone would miss a monitor being moved or its resolution changed, both of
/// which move the top edge the notch is pinned to.
fn fingerprint(app: &AppHandle) -> String {
    monitors(app)
        .iter()
        .map(|monitor| {
            let position = monitor.position();
            let size = monitor.size();
            format!(
                "{}|{},{}|{}x{}|{}",
                monitor_id(monitor),
                position.x,
                position.y,
                size.width,
                size.height,
                monitor.scale_factor()
            )
        })
        .collect::<Vec<_>>()
        .join(";")
}

/// Watch for screens arriving and leaving, and re-apply the preferences when they
/// do.
///
/// This is what makes the disconnect rule work without the user doing anything:
/// unplugging the screen the notch was named onto changes the fingerprint, which
/// re-runs `apply`, which finds the stored id matches nothing and falls back to the
/// primary. Plugging it back in does the same in reverse.
///
/// The event is for the Settings window, which draws a live map of the monitors and
/// would otherwise show a screen that had been unplugged minutes ago.
pub fn start_watcher(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        let mut seen = fingerprint(&app);
        loop {
            std::thread::sleep(Duration::from_millis(WATCH_MS));

            let next = fingerprint(&app);
            if next == seen {
                continue;
            }
            seen = next;

            crate::settings::reapply(&app);
            let _ = app.emit("displays-changed", ());
        }
    });
}
