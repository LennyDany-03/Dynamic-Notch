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

use crate::notifications;
use crate::tray::{hide_menu, NOTCH_LABEL};

pub const SETTINGS_LABEL: &str = "settings";

/// Must agree with `alwaysOnTop` on the `notch-widget` entry in
/// `tauri.conf.json`. The window is built from that config and only corrected
/// afterwards by `apply`, so a disagreement would flicker the notch behind other
/// windows on every launch.
fn always_on_top_default() -> bool {
    true
}

fn notifications_default() -> bool {
    true
}

/// Where along the top edge the notch sits.
///
/// The overlay window is a fixed 560×420 canvas and the card is drawn centred
/// inside it, so this moves the *window* rather than the card: everything that
/// reads geometry — `layout.ts`, the hotzone poll, the guide bar — works off
/// `window.innerWidth / 2` and follows for free. Offsetting the card inside the
/// canvas instead would have ~60px of slack to play with (the widest card is
/// 440), which is not a position change anyone would notice.
#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NotchPosition {
    Left,
    Center,
    Right,
}

impl NotchPosition {
    /// Window origin along the free horizontal span (screen width − window width).
    fn offset(self, span: i32) -> i32 {
        match self {
            NotchPosition::Left => 0,
            NotchPosition::Center => span / 2,
            NotchPosition::Right => span,
        }
    }
}

fn notch_position_default() -> NotchPosition {
    NotchPosition::Center
}

/// Whether a hairline is drawn at the top edge marking the trigger strip.
///
/// On by default: the notch is invisible until the cursor finds it, and "where do
/// I put my cursor" is the first question a new install raises. It costs nothing
/// once the pill is resting on screen — the hint is only drawn while nothing else
/// is (see `NotchShell`).
fn hotzone_hint_default() -> bool {
    true
}

/// Opacity of the Mica surface, as a percentage.
///
/// Must agree with the `--mica-alpha` fallback in `src/index.css` and with
/// `DEFAULTS` in `useSettings.ts` — those are what paint before this value is
/// read, and a disagreement is a visible correction on every launch.
///
/// Deliberately above the design export's 80: at .80 the wallpaper reads straight
/// through body copy, which is the complaint this preference exists to answer.
fn background_opacity_default() -> u8 {
    92
}

/// Floor and ceiling for `background_opacity`.
///
/// The floor is not politeness — a value near zero is an overlay nobody can see
/// or find, set from a window that is itself invisible at that point. Clamped on
/// write *and* on load, since the file is one a user might hand-edit.
const OPACITY_MIN: u8 = 60;
const OPACITY_MAX: u8 = 100;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// Whether the overlay is pinned above other windows. Off means it sits at
    /// normal z-order, i.e. behind whatever the user is working in.
    #[serde(default = "always_on_top_default")]
    pub always_on_top: bool,

    /// Whether arriving Windows notifications are announced by the notch.
    #[serde(default = "notifications_default")]
    pub notifications: bool,

    /// Whether Windows' own corner banner is suppressed while Crest runs, so the
    /// notch is the only place a notification appears. Off by default: this one
    /// reaches outside the app and changes a system setting, which is never
    /// something to do because the user installed something.
    #[serde(default)]
    pub mute_windows_banners: bool,

    /// How solid every Mica surface is drawn, as a percentage — the notch's
    /// cards, the tray popup and the settings window alike.
    ///
    /// Purely a frontend concern: nothing in `apply` touches it, because there is
    /// no window state behind it. It travels the same path as the rest so that it
    /// is stored, clamped and broadcast in one place.
    #[serde(default = "background_opacity_default")]
    pub background_opacity: u8,

    /// Where along the top edge of the primary monitor the overlay sits.
    #[serde(default = "notch_position_default")]
    pub notch_position: NotchPosition,

    /// Whether the trigger strip is marked with a hairline while the notch is
    /// away. Purely a frontend concern, like `background_opacity` — the notch
    /// draws it from the broadcast and there is no window state behind it.
    #[serde(default = "hotzone_hint_default")]
    pub hotzone_hint: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            always_on_top: always_on_top_default(),
            notifications: notifications_default(),
            mute_windows_banners: false,
            background_opacity: background_opacity_default(),
            notch_position: notch_position_default(),
            hotzone_hint: hotzone_hint_default(),
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
    let mut settings: Settings =
        serde_json::from_str(raw.trim_start_matches('\u{feff}')).unwrap_or_default();

    // Same reasoning as the BOM: a hand-edited `"backgroundOpacity": 0` is a
    // wholly invisible app, and the window that would fix it is invisible too.
    settings.background_opacity = settings.background_opacity.clamp(OPACITY_MIN, OPACITY_MAX);
    settings
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

/// Move the overlay window along the top edge of the primary monitor.
///
/// This is the whole of the position preference. The window is never resized, so
/// the only thing to decide is its origin: `y` is the top of the monitor and `x`
/// walks the free span between the two screen edges. The card stays centred in
/// its canvas, which is why nothing in the frontend has to know this happened —
/// with one exception, the cursor poll's cached window origin, which is why every
/// change is broadcast (see `useHotzone`).
///
/// This replaced the hardcoded centring `lib.rs` used to do at startup; it runs
/// from `apply`, so the stored position is honoured on the first frame rather
/// than as a correction afterwards.
fn apply_position(app: &AppHandle, position: NotchPosition) -> Result<(), String> {
    let Some(notch) = app.get_webview_window(NOTCH_LABEL) else {
        return Err("notch window is unavailable".into());
    };

    let monitor = notch
        .primary_monitor()
        .map_err(|error| format!("could not read the monitor: {error}"))?;
    let Some(monitor) = monitor else {
        return Ok(());
    };

    let size = notch
        .outer_size()
        .map_err(|error| format!("could not read the notch size: {error}"))?;

    // Monitor origin rather than 0, so a primary monitor that is not at the
    // origin of the virtual desktop (a second screen placed to its left) still
    // gets the notch on *it* rather than somewhere off its edge.
    let origin = monitor.position();
    let span = (monitor.size().width as i32 - size.width as i32).max(0);

    notch
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: origin.x + position.offset(span),
            y: origin.y,
        }))
        .map_err(|error| format!("could not move the notch: {error}"))
}

/// Push the banner preference onto Windows' own notification settings.
///
/// Muting is conditional on the notch actually announcing notifications, and on
/// Windows granting the access that lets it: the two together are a redirection,
/// and either one alone is just a user who no longer sees their notifications.
/// Access is re-checked on every apply rather than only where the switch is
/// thrown, because it can be revoked from Windows' own settings months later —
/// the preference survives that, its effect does not, and the banners come back
/// on the next apply instead of the silence going unnoticed.
///
/// What was changed and what to put back is `notifications`' business, not a
/// preference; see the memo it keeps.
fn apply_banners(settings: &Settings) -> Result<(), String> {
    let mute =
        settings.mute_windows_banners && settings.notifications && notifications::access_allowed();
    notifications::set_muted(mute)
}

pub fn apply(app: &AppHandle, settings: &Settings) {
    let _ = apply_position(app, settings.notch_position);
    let _ = apply_topmost(app, settings.always_on_top);
    let _ = apply_banners(settings);
}

/// Read the file, apply it, and seed the in-memory copy. Startup only.
pub fn init(app: &AppHandle) {
    let stored = load(app);
    apply(app, &stored);
    if let Some(current) = app.try_state::<Current>() {
        current.set(stored);
    }
}

/// Give Windows its banners back on the way out.
///
/// A muted shell plus a notch that is no longer running is a machine with no
/// notifications at all, which is not a state any preference asked for. The
/// preference itself is left alone in the file, so the next launch silences the
/// shell again — this undoes the effect for exactly as long as Crest is gone.
pub fn shutdown(_app: &AppHandle) {
    if notifications::is_muted() {
        let _ = notifications::set_muted(false);
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

/// Whether arriving notifications are announced by the notch.
///
/// Turning this off also hands Windows its banners back, through `apply_banners`
/// — muting the shell is only defensible while something else is showing the
/// notifications, and this is the switch that says whether anything is.
#[tauri::command]
pub fn set_notifications(
    app: AppHandle,
    current: State<'_, Current>,
    enabled: bool,
) -> Result<bool, String> {
    let mut settings = current.get();
    settings.notifications = enabled;
    apply_banners(&settings)?;
    current.set(settings.clone());
    save(&app, &settings)?;

    // The notch is what polls for notifications, and the switch lives in another
    // window; without this it would keep polling (or keep quiet) until relaunch.
    let _ = app.emit("settings-changed", settings.clone());

    Ok(enabled)
}

/// Suppress Windows' own corner banner, so an arriving notification is drawn by
/// the notch and nowhere else.
///
/// Refuses in the two cases where it would leave the user with no notification
/// at all: the notch's own half switched off, and Windows not granting access to
/// the notification centre — without which the notch has nothing to announce, no
/// matter how loudly the preference says otherwise. The listener is checked here
/// rather than trusted from a startup probe because "Let apps access your
/// notifications" can be revoked at any moment, from outside this app.
#[tauri::command]
pub fn set_mute_windows_banners(
    app: AppHandle,
    current: State<'_, Current>,
    enabled: bool,
) -> Result<bool, String> {
    let mut settings = current.get();

    if enabled {
        if !settings.notifications {
            return Err("Turn on notifications in the notch first.".into());
        }
        if !notifications::access_allowed() {
            return Err(
                "Windows hasn't given Crest access to notifications, so the notch has nothing to \
                 show. Turn on Privacy & security → Notifications and try again."
                    .into(),
            );
        }
    }

    settings.mute_windows_banners = enabled;
    // Before the write, so a registry the app cannot change leaves the stored
    // preference — and the switch in the window — where they were.
    apply_banners(&settings)?;
    current.set(settings.clone());
    save(&app, &settings)?;

    let _ = app.emit("settings-changed", settings.clone());

    Ok(enabled)
}

/// How solid the Mica surfaces are drawn, as a percentage.
///
/// The only preference here with nothing to apply — every window paints itself
/// from the broadcast, so this stores, clamps and announces, and that is all.
/// Clamping rather than refusing an out-of-range value is deliberate: the caller
/// is a slider, not a person typing a number, and it takes the returned value
/// back as its position.
#[tauri::command]
pub fn set_background_opacity(
    app: AppHandle,
    current: State<'_, Current>,
    percent: u8,
) -> Result<u8, String> {
    let percent = percent.clamp(OPACITY_MIN, OPACITY_MAX);

    let mut settings = current.get();
    settings.background_opacity = percent;
    current.set(settings.clone());
    save(&app, &settings)?;

    // This is the whole mechanism: the notch and the tray popup are separate
    // windows that never rebuild, and the slider lives in neither of them.
    let _ = app.emit("settings-changed", settings.clone());

    Ok(percent)
}

/// Move the notch along the top edge, and remember where.
///
/// The window is moved before the file is written, for the same reason as
/// always-on-top: the visible change is what the user asked for, and a disk error
/// should cost them the preference at next launch rather than the move.
#[tauri::command]
pub fn set_notch_position(
    app: AppHandle,
    current: State<'_, Current>,
    position: NotchPosition,
) -> Result<NotchPosition, String> {
    let mut settings = current.get();
    settings.notch_position = position;
    apply_position(&app, position)?;
    current.set(settings.clone());
    save(&app, &settings)?;

    // The notch itself does not read this — Rust moved the window — but its
    // cursor poll caches the window origin, and the broadcast is what tells it to
    // re-read rather than hit-testing against the old position for up to 2s.
    let _ = app.emit("settings-changed", settings.clone());

    Ok(position)
}

/// Whether the trigger strip is marked while the notch is away.
///
/// Nothing to apply: the notch draws the hint from the broadcast, exactly as it
/// does the surface opacity. Stored and announced here so there is still only one
/// path a preference travels.
#[tauri::command]
pub fn set_hotzone_hint(
    app: AppHandle,
    current: State<'_, Current>,
    enabled: bool,
) -> Result<bool, String> {
    let mut settings = current.get();
    settings.hotzone_hint = enabled;
    current.set(settings.clone());
    save(&app, &settings)?;

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
    // Re-apply the preferences afterwards so this ordinary focused window cannot
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
