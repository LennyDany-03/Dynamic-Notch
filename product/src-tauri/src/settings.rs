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

use crate::display;
use crate::hotkey;
use crate::notifications;
use crate::tray::hide_menu;

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

/// Whether the notch reports the machine's own state — a charger going in or
/// out, a Bluetooth device connecting, the Wi-Fi changing, or the CPU, memory,
/// GPU or disk pinned at the top of its range.
///
/// One switch for two polls (`system.rs` and `perf.rs`) because it answers one
/// question: does the notch tell me about my machine. Splitting it would ask the
/// user to answer that twice.
///
/// On by default, unlike `mute_windows_banners`: this only reads state Windows
/// already shows in the tray and Task Manager, and changes nothing outside the
/// app. The load half earns the default separately — an overload is precisely the
/// thing a user would not otherwise notice until it had already cost them time.
fn system_alerts_default() -> bool {
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
    pub(crate) fn offset(self, span: i32) -> i32 {
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

/// Which screen the notch lives on, as a monitor id (`\\.\DISPLAY2`), or `None`
/// for "wherever Windows says the primary is".
///
/// `None` is not the same as storing the primary's own id, and the difference
/// matters on a machine whose primary changes — a laptop docked to a monitor that
/// is then made the main display. `None` follows that; an id does not.
///
/// A stored id that matches no connected screen is **not** an error and is never
/// rewritten. `display::targets` falls back to the primary, which is the whole of
/// the "unplug the monitor and the notch comes home" behaviour, and the preference
/// survives so it goes back when the cable does. See `display.rs`.
fn notch_display_default() -> Option<String> {
    None
}

/// Whether the notch is drawn on every connected screen rather than just one.
///
/// Off by default: a second notch is a second always-on-top overlay and a second
/// set of watchers, which is not something to start doing because the user plugged
/// in a projector. It is also the only preference here that *builds windows* — see
/// `display::apply`.
fn notch_all_displays_default() -> bool {
    false
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
/// **The floor was 60 and that made the preference look broken.** Crest's Mica
/// base is `rgb(32,32,32)` and the thing most often *behind* the notch is a dark
/// editor or a dark browser at around `rgb(31,31,31)`. Composite one over the
/// other at 60% and the result is 31.6 against 32 at full — a difference of less
/// than half a value out of 255, i.e. nothing. The whole 60→100 range was
/// invisible on exactly the desktops this app is used on, so dragging the slider
/// genuinely did nothing anyone could see and the only surface that appeared to
/// respond was the settings window itself, which now deliberately does not (see
/// `SettingsWindow`).
///
/// 25 gives the range something to do. It is still a floor rather than 0 because
/// the fill is what makes the card a card, but it is a much lower one than the old
/// reasoning assumed it had to be: `--mica-alpha` governs the *surface fill only*
/// — the text, the tiles, the hairline and the drop shadow all stay fully opaque —
/// so a notch at 25% is a legible card on a faint wash, not a notch nobody can
/// find. The other half of that old reasoning ("set from a window that is itself
/// invisible at that point") no longer applies at all.
///
/// Clamped on write *and* on load, since the file is one a user might hand-edit.
const OPACITY_MIN: u8 = 25;
const OPACITY_MAX: u8 = 100;

/// The resting pill's own size, in CSS pixels.
///
/// Every bound here has a reason and none of them is taste:
///
/// **Width.** The pill is a three-column grid — a music mark, the clock, the
/// charge — with the outer columns fixed and equal so the time sits on the centre
/// line (see `CollapsedPill`). Below 240 the middle column stops holding
/// "10:08 AM" and the clock starts eliding, i.e. the pill loses the one thing it
/// exists to show. The ceiling is the canvas: the overlay window is a fixed 560
/// wide and a pill that reached the edges would have no shadow and no room to
/// spring into.
///
/// **Height.** The chips inside are 22 tall, so 26 is the point at which they
/// touch the pill's own edge. The ceiling is `announce`'s 64 — the banner has to
/// stay visibly larger than the pill, or the notch *reporting* something looks the
/// same as the notch merely being there.
const NOTCH_WIDTH_MIN: u16 = 240;
const NOTCH_WIDTH_MAX: u16 = 460;
const NOTCH_HEIGHT_MIN: u16 = 26;
const NOTCH_HEIGHT_MAX: u16 = 56;

/// Corner radius of every Mica shell, in CSS pixels.
///
/// No floor: square corners are a legitimate look and the design still holds at 0.
/// The ceiling is half the shortest pill — past `NOTCH_HEIGHT_MIN / 2` the radius
/// is clamped by the browser anyway and the slider would appear to stop working
/// halfway along, which reads as a bug rather than as a limit.
const CORNER_RADIUS_MAX: u8 = 28;

/// How fast the notch's own motion runs, as a percentage of the tuned springs.
///
/// A range and not a switch, because "too slow" and "too fast" are both real
/// complaints about the same animation. The bounds are where the motion stops
/// being motion: at half speed the card takes most of a second to settle, and at
/// double it arrives before the eye has followed it, which is indistinguishable
/// from no animation at all — for that there is the bottom of the range on the
/// *other* preference, `collapse_delay`, which is the one that actually controls
/// how long the notch is on screen.
const ANIMATION_MIN: u8 = 50;
const ANIMATION_MAX: u8 = 200;

/// How wide the expanded cards are drawn, as a percentage of the design's own.
///
/// Width only, never height. Heights are the one thing in `tokens.ts` that is
/// arithmetic rather than judgement — `system` is "26 nav + 16 padding + 16 header
/// + … = 266", and every box in it is pinned in the component — so scaling them
/// would put the card and its hit rect out of step and leave the stripe of empty
/// Mica that `layout.contentRect` exists to warn about. Widths have slack.
///
/// The ceiling is generous because `layout.ts` clamps the *result* to what fits
/// the 560px canvas; the calendar (480 wide) therefore stops growing before the
/// slider does, and the narrower cards keep going. That is the right way round —
/// the alternative is a range chosen for the widest card that barely moves the
/// others.
const PANEL_SCALE_MIN: u8 = 85;
const PANEL_SCALE_MAX: u8 = 115;

/// How long the notch waits after the cursor leaves before it steps down, in ms.
///
/// The floor is the width of an accidental exit: a cursor that clips the corner of
/// a card on its way somewhere else is off it for around a tenth of a second, and
/// below that the notch collapses on gestures the user did not make. The ceiling
/// is where a notch that will not go away stops being a feature — two seconds of
/// an expanded card sitting over the work underneath is already a long time to
/// wait for a surface you have finished with.
const COLLAPSE_DELAY_MIN: u16 = 100;
const COLLAPSE_DELAY_MAX: u16 = 2000;

/// The pill at rest. Mirrors `size.peek` in `tokens.ts` and `DEFAULTS` in
/// `useSettings.ts` — the frontend paints from those before this value is read.
fn notch_width_default() -> u16 {
    264
}

fn notch_height_default() -> u16 {
    34
}

/// Mirrors `radius.shell` in the design export, and the `--radius-shell` fallback
/// in `src/index.css`.
fn corner_radius_default() -> u8 {
    16
}

/// 100 % — the springs exactly as `tokens.ts` tuned them.
fn animation_speed_default() -> u8 {
    100
}

/// 100 % — the card widths exactly as the design export drew them.
fn panel_scale_default() -> u8 {
    100
}

/// Mirrors `timing.graceMs`.
fn collapse_delay_default() -> u16 {
    300
}

/// Whether the notch keeps an eye on the screenshot folders.
///
/// On by default, unlike `mute_windows_banners` and like `system_alerts`: it reads
/// files the user already has, in folders Windows chose, and changes nothing
/// anywhere. What it gates is a directory listing every couple of seconds and the
/// banner that follows a capture — see `useScreenshots`.
fn screenshots_default() -> bool {
    true
}

/// Whether a finished countdown makes a noise.
///
/// On by default, and the switch matters more here than it does for the others
/// in this file: Crest has never made a sound in its life, so a chime nobody can
/// turn off would be the app acquiring a new kind of presence without asking. It
/// is the *only* sound in the app, which is also why this is its own preference
/// rather than a corner of `notifications` — that switch answers "does the notch
/// read my notification centre", and this one answers "may it beep".
///
/// Nothing for `apply` to do, exactly like `screenshots`: the frontend owns the
/// oscillator and reads this from the broadcast.
fn timer_sound_default() -> bool {
    true
}

/// Which palette every surface in the app is drawn from.
///
/// A closed set, unlike `panels` — a theme is a block of custom properties in
/// `src/index.css`, so an id Rust does not recognise is not a card from a newer
/// build, it is a palette that does not exist and an app with no colours. The
/// variants mirror the `[data-theme='…']` blocks in that file exactly.
///
/// Serialised camelCase, matching `ThemeId` in `useSettings.ts`.
#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Theme {
    /// The design export's own palette — near-black Mica, violet accent.
    Crest,
    Glacier,
    Ember,
    Daylight,
    Mono,
}

impl Theme {
    /// The accent this palette was drawn around.
    ///
    /// Here rather than only in the CSS because picking a theme has to *set* the
    /// accent preference, not merely offer one. The accent is written inline onto
    /// `:root` by `useAccentColor` and inline styles beat any stylesheet, so a
    /// theme whose accent lived only in CSS would be overridden by whatever the
    /// last accent was — Glacier with a violet scrub bar, Mono with a violet
    /// anything. `set_theme` writes both in one go, which also makes the pair a
    /// single broadcast rather than two states the windows could catch mid-change.
    ///
    /// These must match the `--accent` in each theme's block in `src/index.css`.
    /// That block is not dead weight for having a copy here: it is what paints the
    /// picker's preview cards, which are scoped subtrees rather than the root.
    fn accent(self) -> &'static str {
        match self {
            Theme::Crest => "#7C3AED",
            Theme::Glacier => "#6FB1D9",
            Theme::Ember => "#E8934A",
            Theme::Daylight => "#2F6FED",
            Theme::Mono => "#F0F0F0",
        }
    }
}

/// The palette the app is drawn from before anyone chooses otherwise.
///
/// Must agree with the `:root` block in `src/index.css` and with `DEFAULTS` in
/// `useSettings.ts` — those are what paint before the preference is read.
fn theme_default() -> Theme {
    Theme::Crest
}

/// The accent, as `#RRGGBB`.
///
/// Must agree with the `--accent` fallback in `src/index.css` and with `DEFAULTS`
/// in `useSettings.ts`, for the same reason `background_opacity` must: those are
/// what paint before the preference is read.
///
/// This is the design export's own `#7C3AED`, and `Theme::Crest`'s accent. It is
/// the *default* rather than the value now, which is the whole of this feature —
/// but it stays the default because the export is still the design, and a user
/// who never opens Settings should get the app as drawn.
fn accent_color_default() -> String {
    theme_default().accent().to_string()
}

/// Normalise a user-supplied accent to `#RRGGBB`, or reject it.
///
/// Accepts with or without the hash and in either case, because this is reached
/// from a text field as well as from the swatches — someone pasting `7c3aed` out
/// of a design tool means the obvious thing. Three-digit shorthand is expanded
/// for the same reason.
///
/// Everything else is refused rather than coerced. The value ends up in a CSS
/// custom property, and a malformed one does not fail loudly: it simply fails to
/// parse as a colour and leaves the *previous* accent standing, which would look
/// exactly like the preference having silently not saved.
fn normalise_accent(raw: &str) -> Option<String> {
    let hex = raw.trim().trim_start_matches('#');

    let expanded = match hex.len() {
        // `#abc` → `#aabbcc`, the CSS shorthand.
        3 => hex.chars().flat_map(|c| [c, c]).collect::<String>(),
        6 => hex.to_string(),
        _ => return None,
    };

    if !expanded.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    Some(format!("#{}", expanded.to_ascii_uppercase()))
}

/// One row of the `panels` preference: which card, and whether it is in the ring
/// the nav arrows cycle.
///
/// **`id` is an opaque string and nothing here ever interprets it.** Which
/// modules exist is a frontend fact — a card is a React component, a size token
/// and a switch arm, none of which Rust knows about — so teaching this file the
/// set would mean editing Rust every time a card is added, for no gain. The
/// frontend reconciles the stored list against the modules that actually exist
/// (`resolvePanels` in `types/notch.ts`), which is also the only place that can
/// know what to do about a module that has just shipped or just been removed.
///
/// That means this value is not validated on the way in beyond being well-formed
/// JSON, and that is deliberate: a stored id Rust does not recognise is not
/// necessarily wrong, it may simply be from a newer build.
#[derive(Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Panel {
    pub id: String,
    pub visible: bool,
}

/// Where the weather module looks.
///
/// Stored as coordinates *and* the name they were resolved from, rather than as a
/// query string re-geocoded on every poll: the forecast API takes a latitude and
/// a longitude, and a place name is ambiguous in a way coordinates are not
/// (there are some thirty Springfields). The name is kept because it is what the
/// card puts on screen and what Settings shows back to the user — re-deriving it
/// from the coordinates would be a second network call to answer a question that
/// was already answered when they picked the place.
#[derive(Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WeatherPlace {
    /// What to call it — "Chennai", "Chennai, Tamil Nadu".
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
    /// IANA zone from the geocoder, so a forecast for somewhere else is drawn
    /// against *its* clock rather than against this machine's.
    #[serde(default)]
    pub timezone: Option<String>,
}

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

    /// Whether the notch announces charger, Bluetooth, Wi-Fi and system-load
    /// changes.
    ///
    /// Nothing for `apply` to do — like `background_opacity` it is read by the
    /// notch off the broadcast. Both polls behind it run regardless, because both
    /// also feed something drawn all the time (the charge on the pill, the meters
    /// on the system monitor); this switches off the announcing and, in
    /// `system.rs`, the Bluetooth enumeration nothing else reads.
    #[serde(default = "system_alerts_default")]
    pub system_alerts: bool,

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

    /// Where along the top edge of its screen the overlay sits.
    #[serde(default = "notch_position_default")]
    pub notch_position: NotchPosition,

    /// Which screen the overlay sits on, or `None` to follow the primary.
    #[serde(default = "notch_display_default")]
    pub notch_display: Option<String>,

    /// Whether every connected screen gets its own notch.
    #[serde(default = "notch_all_displays_default")]
    pub notch_all_displays: bool,

    /// Whether the trigger strip is marked with a hairline while the notch is
    /// away. Purely a frontend concern, like `background_opacity` — the notch
    /// draws it from the broadcast and there is no window state behind it.
    #[serde(default = "hotzone_hint_default")]
    pub hotzone_hint: bool,

    /// Which palette every surface is drawn from. Frontend-only, like
    /// `background_opacity`: it is one attribute on each window's `:root` and
    /// `apply` has nothing to do with it.
    #[serde(default = "theme_default")]
    pub theme: Theme,

    /// The accent, as `#RRGGBB`. Frontend-only, like `background_opacity`: it is
    /// one CSS variable per window and `apply` has nothing to do with it.
    ///
    /// Set by `set_theme` alongside the theme, and independently settable
    /// afterwards — a theme is where an accent comes from, not a lock on it.
    #[serde(default = "accent_color_default")]
    pub accent_color: String,

    /// Which cards the notch offers, and in what order.
    ///
    /// Empty means "never set" — the frontend falls back to `MODULES`, its own
    /// default order, with everything visible. It is not `Option` because an
    /// empty list and "no preference" are the same thing here: a user cannot
    /// switch every card off (the picker refuses, and `resolvePanels` falls back
    /// if the file says otherwise), so an empty list can only mean untouched.
    #[serde(default)]
    pub panels: Vec<Panel>,

    /// Whether startup has been set up at least once.
    ///
    /// Not a preference — the OS is the source of truth for whether Crest starts
    /// with Windows, and this only records that the question has been *asked*.
    /// Without it `autostart::migrate` cannot tell a fresh install (where startup
    /// should default on) from a user who turned it off (where enabling it again
    /// on every launch is the bug the old unconditional `autolaunch().enable()`
    /// had).
    #[serde(default)]
    pub autostart_configured: bool,

    /// Where the weather module looks, or `None` until the user picks somewhere.
    ///
    /// No default, and deliberately no guess. Every way of guessing reaches
    /// outside the machine — an IP lookup hands a third party the user's address
    /// on launch — and this app's rule for anything that reaches outside is that
    /// the user asks for it first (see `mute_windows_banners`). The module says
    /// as much and offers the search rather than sitting empty.
    #[serde(default)]
    pub weather_place: Option<WeatherPlace>,

    /// The resting pill's width and height, in CSS pixels.
    ///
    /// Frontend-only, like `background_opacity`, and for a reason worth stating
    /// outright: **this is not the window's size.** The overlay is a fixed 560×420
    /// transparent canvas that is never resized — spring-resizing a transparent
    /// always-on-top window on Windows makes `backdrop-filter` re-sample every
    /// frame and tears — so what moves here is the card drawn *inside* it. The
    /// notch reads these through the broadcast and hands them to `layout.ts`,
    /// which is the single source of geometry for both the visible card and the
    /// rect the cursor is hit-tested against.
    #[serde(default = "notch_width_default")]
    pub notch_width: u16,

    #[serde(default = "notch_height_default")]
    pub notch_height: u16,

    /// Corner radius of every Mica shell — the notch's cards, the tray popup and
    /// the settings window alike. One CSS variable (`--radius-shell`), written per
    /// window by `useCornerRadius`, exactly as the accent and the opacity are.
    #[serde(default = "corner_radius_default")]
    pub corner_radius: u8,

    /// How fast the notch's own motion runs, as a percentage.
    ///
    /// Frontend-only. Applied by scaling the springs rather than by swapping in a
    /// different set — see `scaleSpring` in `tokens.ts`, which preserves the
    /// damping ratio so a faster notch is the same motion in less time rather than
    /// a bouncier one.
    #[serde(default = "animation_speed_default")]
    pub animation_speed: u8,

    /// How wide the expanded cards are drawn, as a percentage of the design's own
    /// widths. Frontend-only; clamped again in `layout.ts` to what fits the canvas.
    #[serde(default = "panel_scale_default")]
    pub panel_scale: u8,

    /// How long the notch waits after the cursor leaves before stepping down, in
    /// milliseconds. Frontend-only — it is `timing.graceMs`, made adjustable.
    #[serde(default = "collapse_delay_default")]
    pub collapse_delay: u16,

    /// The shortcut that summons the notch, or `None` for no shortcut.
    ///
    /// **The one preference here that `apply` can fail at**, which is why
    /// `set_hotkey` registers before it stores rather than after. Windows hands a
    /// global shortcut to exactly one process, so the combination the user picked
    /// may simply belong to something else — and a preference that saved happily
    /// while doing nothing would be a shortcut that "does not work" with no
    /// explanation available anywhere.
    ///
    /// Stored as an accelerator string (`"Ctrl+Shift+KeyN"`). See `hotkey.rs` for
    /// why the key half is a `KeyboardEvent.code` name.
    #[serde(default)]
    pub hotkey: Option<String>,

    /// Whether the notch keeps recent screenshots to hand.
    ///
    /// Frontend-only: it gates the poll in `useScreenshots` and the banner that
    /// follows a capture. The card itself is switched on and off in Panels, like
    /// every other card — this is the watching, not the drawing, which is the same
    /// split `notifications` has.
    #[serde(default = "screenshots_default")]
    pub screenshots: bool,

    /// Whether a finished countdown plays a chime.
    ///
    /// Frontend-only: the tone is synthesised in the webview (see `chime.ts`), so
    /// there is nothing here to apply and no Windows permission behind it. The
    /// timer *card* is switched on and off in Panels like every other card —
    /// this is only the noise, which is the same split `notifications` and
    /// `screenshots` both have.
    #[serde(default = "timer_sound_default")]
    pub timer_sound: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            always_on_top: always_on_top_default(),
            notifications: notifications_default(),
            system_alerts: system_alerts_default(),
            mute_windows_banners: false,
            background_opacity: background_opacity_default(),
            notch_position: notch_position_default(),
            notch_display: notch_display_default(),
            notch_all_displays: notch_all_displays_default(),
            hotzone_hint: hotzone_hint_default(),
            theme: theme_default(),
            accent_color: accent_color_default(),
            panels: Vec::new(),
            autostart_configured: false,
            weather_place: None,
            notch_width: notch_width_default(),
            notch_height: notch_height_default(),
            corner_radius: corner_radius_default(),
            animation_speed: animation_speed_default(),
            panel_scale: panel_scale_default(),
            collapse_delay: collapse_delay_default(),
            hotkey: None,
            screenshots: screenshots_default(),
            timer_sound: timer_sound_default(),
        }
    }
}

/// In-memory copy of the preferences, seeded at startup.
///
/// `notch_settle` runs every time the overlay collapses, which is often enough
/// that it has no business reading a file. Disk stays the durable record; this is
/// what the running app answers from.
///
/// `None` until something has read the file, and **never a `Settings::default()`
/// standing in for one**. That distinction is the whole point of the `Option`: a
/// default here is a guess that says always-on-top is on, and the notch acts on
/// the first answer it gets and never asks again. Handing it a guess once put the
/// pill on screen for the life of the process for someone who had the preference
/// off — see `get`.
#[derive(Default)]
pub struct Current(Mutex<Option<Settings>>);

impl Current {
    /// The stored preferences, reading them from disk if nothing has yet.
    ///
    /// The fallback is not laziness for its own sake: a reader can arrive before
    /// `init` has seeded this. The webview posts its first `read_settings` while
    /// `setup` is still running, and `setup` pumps the message loop wherever it
    /// touches WinRT (the notification listener) — so the IPC is dispatched in the
    /// middle of startup, not after it. Loading here means the first reader gets
    /// the file whoever it is, rather than a default that is only correct for
    /// users who never changed anything.
    ///
    /// A poisoned lock means a previous holder panicked mid-update. The value
    /// behind it is a handful of scalars, so it cannot be half-written —
    /// recovering beats propagating a panic into every later call.
    fn get(&self, app: &AppHandle) -> Settings {
        let mut slot = self.0.lock().unwrap_or_else(|e| e.into_inner());
        match slot.as_ref() {
            Some(settings) => settings.clone(),
            None => {
                let stored = load(app);
                *slot = Some(stored.clone());
                stored
            }
        }
    }

    fn set(&self, settings: Settings) {
        *self.0.lock().unwrap_or_else(|e| e.into_inner()) = Some(settings);
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
    // And a hand-edited accent that is not a colour would leave every active
    // state painted in whatever the last valid value was, with no way to tell
    // that from the preference having failed to save.
    settings.accent_color = normalise_accent(&settings.accent_color).unwrap_or_else(accent_color_default);

    // The geometry preferences, on the same reasoning as the opacity: every one of
    // them can be hand-edited into a notch that cannot be used or found, and the
    // window that would fix it is reached from a tray icon rather than from the
    // notch — but a 4px-tall pill is not something anyone would recognise as the
    // thing they broke. Clamping on load is what makes the file safe to edit.
    settings.notch_width = settings
        .notch_width
        .clamp(NOTCH_WIDTH_MIN, NOTCH_WIDTH_MAX);
    settings.notch_height = settings
        .notch_height
        .clamp(NOTCH_HEIGHT_MIN, NOTCH_HEIGHT_MAX);
    settings.corner_radius = settings.corner_radius.min(CORNER_RADIUS_MAX);
    settings.animation_speed = settings
        .animation_speed
        .clamp(ANIMATION_MIN, ANIMATION_MAX);
    settings.panel_scale = settings.panel_scale.clamp(PANEL_SCALE_MIN, PANEL_SCALE_MAX);
    settings.collapse_delay = settings
        .collapse_delay
        .clamp(COLLAPSE_DELAY_MIN, COLLAPSE_DELAY_MAX);

    // A stored shortcut that no longer parses is dropped rather than kept. It is
    // the one preference here with an effect *outside* the process — it takes a
    // key combination away from every other app — so "we could not understand it"
    // has to mean "nothing is registered", never "something is registered and we
    // are not sure what".
    if let Some(accelerator) = &settings.hotkey {
        if hotkey::parse(accelerator).is_err() {
            settings.hotkey = None;
        }
    }

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

/// Put one notch window in, or out of, the topmost band.
///
/// Split out of `apply_topmost` once mirroring made "the notch" a set of windows
/// rather than one. The preference is about the overlay as a whole, so `apply`
/// walks every screen's copy; `notch_raise` and `notch_settle` are about the window
/// the cursor is actually at, so they take the calling window and this is what they
/// reach. Promoting all of them because one grew would put a notch in front of a
/// fullscreen video playing on the other screen.
fn set_topmost(app: &AppHandle, notch: &tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
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

/// Put every notch window in the band the preference selects.
///
/// One window before mirroring existed, and it stays one window on the overwhelming
/// majority of machines. What changed is that the count is no longer known here:
/// `display::notch_windows` answers it.
fn apply_topmost(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let windows = display::notch_windows(app);
    if windows.is_empty() {
        return Err("notch window is unavailable".into());
    }

    // Every window is asked, and the first failure is reported. Stopping there
    // rather than carrying on is deliberate: a failure here is the window thread
    // being unreachable, which the next window would hit too.
    for window in &windows {
        set_topmost(app, window, enabled)?;
    }
    Ok(())
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

/// Serialises applies, so two of them cannot reconcile the window set at once.
///
/// Only matters now that `apply_detached` exists: flipping the mirroring switch
/// twice quickly would otherwise have two threads deciding which windows should
/// exist from two different answers, and the loser would build a window the winner
/// had just destroyed. A plain `Mutex<()>`, because there is nothing to guard but
/// the ordering.
static APPLYING: Mutex<()> = Mutex::new(());

/// Push the stored preferences onto the live windows.
///
/// Called at startup, on every change, each time Settings is opened, and whenever
/// the set of monitors changes, so there is exactly one place that knows how a
/// preference maps onto window state.
///
/// `display::apply` runs **first** and is the only step that can change how many
/// windows there are — it builds a mirror for a screen that has just been plugged
/// in and destroys the one for a screen that has gone. Everything after it walks
/// the windows, so a mirror built on this pass is in the topmost band before the
/// call returns rather than a preference behind until the next one.
///
/// **Never call this from a synchronous command handler.** See `apply_detached`,
/// which is what commands use and why.
pub fn apply(app: &AppHandle, settings: &Settings) {
    let _lock = APPLYING.lock().unwrap_or_else(|e| e.into_inner());

    display::apply(app, settings);
    let _ = apply_topmost(app, settings.always_on_top);
    let _ = apply_banners(settings);
    // Ignored here and reported in `set_hotkey`. A shortcut another app has taken
    // is not a reason to fail an apply that has already moved windows — and this
    // runs at startup, where the app whose shortcut clashes may not even be
    // running yet. The next apply picks it up; until then the notch simply has no
    // shortcut, which is what it looks like from the outside anyway.
    let _ = hotkey::apply(app, settings.hotkey.as_deref());
}

/// `apply`, on a thread of its own.
///
/// This is not a performance choice, it is the only way the mirroring preference
/// can work at all. `WebviewWindowBuilder::build()` **deadlocks on Windows when it
/// is called from a synchronous command handler** — a documented WebView2 problem
/// (wry#583), and Tauri's own guidance is to build windows from async commands or
/// separate threads. `display::apply` builds a window whenever a screen has just
/// gained a notch, so every command that can reach it has to get off the main
/// thread first.
///
/// The symptom when it did not was total, and worth recording because nothing
/// about it points here: turning "show the notch on every display" on froze the
/// whole app mid-command, so the preference was never written and came back off at
/// the next launch, looking for all the world like a switch that simply did not
/// save.
///
/// One caller is deliberately **not** routed through this: the monitor watcher,
/// which is already a thread. `init` is, and pairs it with a synchronous
/// `display::place_all` — the placement has to land before the first frame, and it
/// is the half that never builds anything.
pub fn apply_detached(app: &AppHandle, settings: &Settings) {
    let app = app.clone();
    let settings = settings.clone();
    std::thread::spawn(move || apply(&app, &settings));
}

/// Re-apply what is already stored, for a caller that changed nothing.
///
/// The monitor watcher is the only one: unplugging a screen changes what the same
/// preferences *mean* without changing them. Reads through `Current` rather than
/// the file, because it runs every few seconds for the life of the process. Calls
/// `apply` directly and not `apply_detached`, being a thread already.
pub fn reapply(app: &AppHandle) {
    let settings = current(app);
    apply(app, &settings);
}

/// The stored preferences, for the modules that need them outside a command.
///
/// Goes through `Current` — which loads the file if nothing has yet — rather than
/// `load`, so this cannot be the reader that hands out a default the app has
/// already moved on from. See `Current::get`.
pub fn current(app: &AppHandle) -> Settings {
    match app.try_state::<Current>() {
        Some(state) => state.get(app),
        None => load(app),
    }
}

/// Read the file, seed the in-memory copy, and apply it. Startup only.
///
/// Seeded **before** `apply`, not after. `apply` reaches WinRT and sweeps the
/// registry, and both pump the message loop on this thread — which is enough for
/// WebView2 to dispatch the notch's first `read_settings` in the middle of it. It
/// used to be answered from an unseeded `Current`, i.e. from defaults, and the
/// notch reads the preferences exactly once: a preference the user had turned off
/// came back on for the whole session. `Current::get` covers a reader that beats
/// even this line; the order is what stops the common case from needing it.
pub fn init(app: &AppHandle) {
    let mut stored = load(app);

    // Before the in-memory copy is seeded, because the migration may write the
    // flag and everything downstream should see the settled value.
    if crate::autostart::migrate(app, stored.autostart_configured) && !stored.autostart_configured {
        stored.autostart_configured = true;
        let _ = save(app, &stored);
    }

    if let Some(current) = app.try_state::<Current>() {
        current.set(stored.clone());
    }

    // Two halves, and the split is the whole point. The window that already exists
    // is positioned **synchronously**, because it has to be where the preference
    // says before the first frame — otherwise the notch paints at whatever origin
    // the OS picked and visibly slides over. Everything else, including building a
    // mirror on a second screen, goes to a thread: `setup` is a main-thread context
    // and `apply` builds windows there. See `apply_detached`.
    display::place_all(app, &stored);
    apply_detached(app, &stored);
}

/// Record that the user has made a choice about starting with Windows.
///
/// Called by the tray toggle. Without it, turning startup *off* would be undone
/// by `migrate` on the next launch, which cannot otherwise tell "off on purpose"
/// from "never set up".
pub fn mark_autostart_configured(app: &AppHandle) {
    let Some(current) = app.try_state::<Current>() else {
        return;
    };
    let mut settings = current.get(app);
    if settings.autostart_configured {
        return;
    }
    settings.autostart_configured = true;
    current.set(settings.clone());
    let _ = save(app, &settings);
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
pub fn read_settings(app: AppHandle, current: State<'_, Current>) -> Settings {
    current.get(&app)
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
///
/// Takes the **calling** window rather than looking one up by label, which is what
/// keeps mirroring honest: each screen's notch owns its own z-order, so reaching
/// for the one on the laptop panel does not shove the one on the second monitor in
/// front of whatever is playing there.
#[tauri::command]
pub fn notch_raise(app: AppHandle, window: tauri::WebviewWindow) {
    if !display::is_notch(window.label()) {
        return;
    }
    let _ = set_topmost(&app, &window, true);
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
pub fn notch_settle(app: AppHandle, window: tauri::WebviewWindow, current: State<'_, Current>) {
    if !display::is_notch(window.label()) {
        return;
    }
    let _ = set_topmost(&app, &window, current.get(&app).always_on_top);
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
    let mut settings = current.get(&app);
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
    let mut settings = current.get(&app);
    settings.notifications = enabled;
    apply_banners(&settings)?;
    current.set(settings.clone());
    save(&app, &settings)?;

    // The notch is what polls for notifications, and the switch lives in another
    // window; without this it would keep polling (or keep quiet) until relaunch.
    let _ = app.emit("settings-changed", settings.clone());

    Ok(enabled)
}

/// Whether the notch reports charger, Bluetooth, Wi-Fi and system-load changes.
///
/// Nothing to apply — the notch owns both polls and decides from the broadcast
/// what they are allowed to announce. Unlike the notification one this has
/// no Windows permission behind it and nothing to refuse: the three reads are of
/// state the shell already draws in the tray.
#[tauri::command]
pub fn set_system_alerts(
    app: AppHandle,
    current: State<'_, Current>,
    enabled: bool,
) -> Result<bool, String> {
    let mut settings = current.get(&app);
    settings.system_alerts = enabled;
    current.set(settings.clone());
    save(&app, &settings)?;

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
    let mut settings = current.get(&app);

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

    let mut settings = current.get(&app);
    settings.background_opacity = percent;
    current.set(settings.clone());
    save(&app, &settings)?;

    // This is the whole mechanism: the notch and the tray popup are separate
    // windows that never rebuild, and the slider lives in neither of them.
    let _ = app.emit("settings-changed", settings.clone());

    Ok(percent)
}

/// Which palette every surface in the app is drawn from.
///
/// **Sets the accent too**, and that is the point of the command rather than an
/// extra it happens to do. A theme is a palette drawn around one accent — Mono
/// means nothing with a violet scrub bar in it — and the accent is written inline
/// onto `:root`, where it beats the theme's own stylesheet value. Doing both here
/// makes it one write and one broadcast, so no window can catch the pair
/// half-applied and paint a frame of the new surface under the old accent.
///
/// The accent stays independently settable afterwards. Someone who picks Ember
/// and then a different orange has said two things, and the second one is later.
///
/// Nothing to apply: every window paints its own `:root` from the broadcast,
/// which is the whole mechanism — the notch and the tray popup never rebuild, and
/// the picker lives in neither of them.
#[tauri::command]
pub fn set_theme(app: AppHandle, current: State<'_, Current>, theme: Theme) -> Result<Theme, String> {
    let mut settings = current.get(&app);
    settings.theme = theme;
    settings.accent_color = theme.accent().to_string();
    current.set(settings.clone());
    save(&app, &settings)?;

    let _ = app.emit("settings-changed", settings.clone());

    Ok(theme)
}

/// The accent every active state in the app is drawn in.
///
/// Refuses rather than clamps, unlike the opacity slider, because the two
/// controls behind it are a swatch and a text field: a swatch can only send
/// something valid, and a half-typed hex from the field is a value the user has
/// not finished choosing. Coercing `#7c3` into some nearby colour would paint the
/// app a shade nobody asked for while they were still typing.
///
/// Returns the *normalised* value, which is what puts `7c3aed` pasted out of a
/// design tool and `#7C3AED` on the same footing — the caller adopts what comes
/// back, so the field tidies itself up.
#[tauri::command]
pub fn set_accent_color(
    app: AppHandle,
    current: State<'_, Current>,
    hex: String,
) -> Result<String, String> {
    let hex = normalise_accent(&hex)
        .ok_or_else(|| "That isn't a colour. Use a hex value like #7C3AED.".to_string())?;

    let mut settings = current.get(&app);
    settings.accent_color = hex.clone();
    current.set(settings.clone());
    save(&app, &settings)?;

    // Nothing to apply — every window paints its own `:root` from this broadcast.
    // Which is also the whole mechanism: the notch and the tray popup never
    // rebuild, and the picker lives in neither of them.
    let _ = app.emit("settings-changed", settings.clone());

    Ok(hex)
}

/// Which cards the notch offers, and in what order.
///
/// Stores and broadcasts, and that is all — there is nothing to apply, and
/// nothing to validate that this side could validate correctly (see `Panel`).
/// The broadcast is the whole mechanism, as with every frontend-only preference:
/// the notch and the tray popup are separate windows that never rebuild, and the
/// picker lives in neither of them.
#[tauri::command]
pub fn set_panels(
    app: AppHandle,
    current: State<'_, Current>,
    panels: Vec<Panel>,
) -> Result<Vec<Panel>, String> {
    let mut settings = current.get(&app);
    settings.panels = panels.clone();
    current.set(settings.clone());
    save(&app, &settings)?;

    let _ = app.emit("settings-changed", settings.clone());

    Ok(panels)
}

/// Where the weather module looks, or `None` to forget it.
///
/// Takes the whole resolved place rather than a search string: the caller has
/// just picked one row out of the geocoder's answers, and that row already
/// carries the coordinates and the zone. Re-resolving a name here would throw
/// away the disambiguation the user just performed.
#[tauri::command]
pub fn set_weather_place(
    app: AppHandle,
    current: State<'_, Current>,
    place: Option<WeatherPlace>,
) -> Result<Option<WeatherPlace>, String> {
    let mut settings = current.get(&app);
    settings.weather_place = place.clone();
    current.set(settings.clone());
    save(&app, &settings)?;

    let _ = app.emit("settings-changed", settings.clone());

    Ok(place)
}

/// Move the notch along the top edge, and remember where.
///
/// The window is moved before the file is written, for the same reason as
/// always-on-top: the visible change is what the user asked for, and a disk error
/// should cost them the preference at next launch rather than the move.
///
/// Through `display::apply` rather than a mover of its own, because "the top edge"
/// is now however many screens are carrying a notch and they all move together —
/// the position is which *end* of an edge, not which screen. And through
/// `apply_detached`, because that call can build a window and this is a synchronous
/// command handler; see `apply_detached`.
///
/// Which is also why the move no longer happens before the write. It cannot: the
/// apply is on another thread now, so there is nothing to sequence against. The
/// preference is stored first and the window follows a moment later, which is the
/// same shape every purely-broadcast preference here already has.
#[tauri::command]
pub fn set_notch_position(
    app: AppHandle,
    current: State<'_, Current>,
    position: NotchPosition,
) -> Result<NotchPosition, String> {
    let mut settings = current.get(&app);
    settings.notch_position = position;
    current.set(settings.clone());
    save(&app, &settings)?;
    apply_detached(&app, &settings);

    // The notch itself does not read this — Rust moved the window — but its
    // cursor poll caches the window origin, and the broadcast is what tells it to
    // re-read rather than hit-testing against the old position for up to 2s.
    let _ = app.emit("settings-changed", settings.clone());

    Ok(position)
}

/// Move the notch to a different screen, or back to following the primary.
///
/// `None` is a real value and not "unset": it means *whichever screen Windows
/// calls the main one*, which is what a laptop that changes docks wants. An id is
/// the user pinning it to one panel.
///
/// Goes through the whole of `apply` rather than `display::apply` alone, because
/// the notch may be arriving on a screen it has never been on before — and with
/// mirroring on, this can build a window, which then needs the topmost band the
/// preference selects before anyone looks at it. Detached for the reason every
/// apply reached from a command is: see `apply_detached`.
///
/// Nothing here checks that the id names a connected screen. That is deliberate and
/// it is the same rule the file has: `display::targets` falls back to the primary
/// for an id it cannot find, so a monitor picked and then unplugged costs the user
/// nothing, and a monitor that comes back is still theirs.
#[tauri::command]
pub fn set_notch_display(
    app: AppHandle,
    current: State<'_, Current>,
    display: Option<String>,
) -> Result<Option<String>, String> {
    let mut settings = current.get(&app);
    settings.notch_display = display.clone();
    current.set(settings.clone());
    save(&app, &settings)?;
    apply_detached(&app, &settings);

    // The notch does not read this either — Rust moved the window — but the cursor
    // poll caches the window origin, and a move to another monitor changes the
    // scale factor with it. Same broadcast, same invalidation. See `useHotzone`.
    let _ = app.emit("settings-changed", settings.clone());

    Ok(display)
}

/// Whether every connected screen gets its own notch.
///
/// The one preference in this file that builds and destroys windows. Turning it on
/// opens a notch on each of the other screens; turning it off destroys them, and
/// leaves `notch-widget` — the window from the config — wherever `notch_display`
/// says. Both are `display::apply`'s job; this stores the answer and asks.
///
/// **`apply_detached`, and this is the command that proves why.** Building a
/// webview from inside a synchronous command handler deadlocks on Windows, so the
/// first version of this froze the app the instant the switch was thrown — before
/// the write below, which is why the preference was back off at the next launch and
/// the switch looked like it simply did not save.
#[tauri::command]
pub fn set_notch_all_displays(
    app: AppHandle,
    current: State<'_, Current>,
    enabled: bool,
) -> Result<bool, String> {
    let mut settings = current.get(&app);
    settings.notch_all_displays = enabled;
    current.set(settings.clone());
    save(&app, &settings)?;
    apply_detached(&app, &settings);

    let _ = app.emit("settings-changed", settings.clone());

    Ok(enabled)
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
    let mut settings = current.get(&app);
    settings.hotzone_hint = enabled;
    current.set(settings.clone());
    save(&app, &settings)?;

    let _ = app.emit("settings-changed", settings.clone());

    Ok(enabled)
}

/// The four purely-geometric preferences, and the one timing one.
///
/// One macro rather than five near-identical functions, because they are five
/// instances of exactly the same three lines — clamp, store, broadcast — and
/// written out they would be a hundred lines in which the interesting part is the
/// pair of bounds. Everything with a decision in it (the accent's refusal, the
/// banner mute's two guards, the hotkey's registration, anything that touches a
/// window) is still written by hand below and above.
///
/// Clamped rather than refused, for the reason `set_background_opacity` gives:
/// every caller is a slider, and a slider takes the returned value back as its own
/// position.
macro_rules! scalar_setting {
    ($command:ident, $field:ident, $ty:ty, $min:expr, $max:expr) => {
        #[tauri::command]
        pub fn $command(
            app: AppHandle,
            current: State<'_, Current>,
            value: $ty,
        ) -> Result<$ty, String> {
            let value = value.clamp($min, $max);

            let mut settings = current.get(&app);
            settings.$field = value;
            current.set(settings.clone());
            save(&app, &settings)?;

            // The broadcast is the whole mechanism, as with every frontend-only
            // preference: the notch and the tray popup are separate windows that
            // never rebuild, and the slider lives in neither of them.
            let _ = app.emit("settings-changed", settings.clone());

            Ok(value)
        }
    };
}

scalar_setting!(
    set_notch_width,
    notch_width,
    u16,
    NOTCH_WIDTH_MIN,
    NOTCH_WIDTH_MAX
);
scalar_setting!(
    set_notch_height,
    notch_height,
    u16,
    NOTCH_HEIGHT_MIN,
    NOTCH_HEIGHT_MAX
);
scalar_setting!(set_corner_radius, corner_radius, u8, 0, CORNER_RADIUS_MAX);
scalar_setting!(
    set_animation_speed,
    animation_speed,
    u8,
    ANIMATION_MIN,
    ANIMATION_MAX
);
scalar_setting!(
    set_panel_scale,
    panel_scale,
    u8,
    PANEL_SCALE_MIN,
    PANEL_SCALE_MAX
);
scalar_setting!(
    set_collapse_delay,
    collapse_delay,
    u16,
    COLLAPSE_DELAY_MIN,
    COLLAPSE_DELAY_MAX
);

/// Whether the notch keeps recent screenshots to hand.
///
/// Nothing to apply — the notch owns the poll and decides from the broadcast
/// whether to run it, exactly as it does for `system_alerts`. Unlike the
/// notification switch there is no Windows permission behind this and nothing to
/// refuse: the folders it reads are the user's own.
#[tauri::command]
pub fn set_screenshots(
    app: AppHandle,
    current: State<'_, Current>,
    enabled: bool,
) -> Result<bool, String> {
    let mut settings = current.get(&app);
    settings.screenshots = enabled;
    current.set(settings.clone());
    save(&app, &settings)?;

    let _ = app.emit("settings-changed", settings.clone());

    Ok(enabled)
}

/// Whether a finished countdown plays a chime.
///
/// Nothing to apply, as with `set_screenshots`: the tone is synthesised in the
/// webview and the notch decides from the broadcast whether to play it. The only
/// reason this is a stored preference at all rather than a frontend flag is that
/// the switch lives in one window and the oscillator in another.
#[tauri::command]
pub fn set_timer_sound(
    app: AppHandle,
    current: State<'_, Current>,
    enabled: bool,
) -> Result<bool, String> {
    let mut settings = current.get(&app);
    settings.timer_sound = enabled;
    current.set(settings.clone());
    save(&app, &settings)?;

    let _ = app.emit("settings-changed", settings.clone());

    Ok(enabled)
}

/// Bind, rebind or clear the shortcut that summons the notch.
///
/// **Registered before it is stored**, which is the opposite order to every other
/// preference in this file and the same order `set_mute_windows_banners` uses, for
/// the same reason: this one can be refused by something outside the app. Windows
/// gives a global shortcut to exactly one process, so the combination the user
/// just pressed may belong to their screen recorder — and storing it anyway would
/// leave a settings row showing a shortcut that does nothing, with the real reason
/// discarded.
///
/// The failure path puts the *old* shortcut back rather than leaving the app with
/// none. `hotkey::apply` clears the whole registration before it tries the new
/// one, so a refused rebind would otherwise cost the user the working shortcut
/// they already had, as the price of having tried a different one.
#[tauri::command]
pub fn set_hotkey(
    app: AppHandle,
    current: State<'_, Current>,
    accelerator: Option<String>,
) -> Result<Option<String>, String> {
    let mut settings = current.get(&app);

    if let Err(reason) = hotkey::apply(&app, accelerator.as_deref()) {
        let _ = hotkey::apply(&app, settings.hotkey.as_deref());
        return Err(reason);
    }

    settings.hotkey = accelerator.clone();
    current.set(settings.clone());
    save(&app, &settings)?;

    // The notch is what acts on the shortcut — Rust only emits `hotkey-toggle` —
    // but it reads this preference to draw nothing at all, so the broadcast is
    // here for consistency and for the settings window's own copy.
    let _ = app.emit("settings-changed", settings.clone());

    Ok(accelerator)
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
    //
    // Detached like every other apply reached from a command. It cannot normally
    // build a window — everything the preferences ask for already exists by the
    // time anyone opens Settings — but "cannot normally" is exactly the assumption
    // that turns into a frozen app the one time it is wrong, and detaching also
    // puts the z-order write *after* the `set_focus` above rather than racing it.
    let settings = current.get(&app);
    apply_detached(&app, &settings);

    // The window is hidden and reshown, never rebuilt, so React does not remount.
    // This is what tells it to re-read preferences that may have changed
    // elsewhere — autostart-style external edits, or the tray's own rows.
    let _ = win.emit("settings-opened", ());

    // And the same values to every *other* window, on the channel they already
    // reconcile on. Nothing has changed here, so this is not a broadcast of a
    // change — it is the one moment the app knows a user is looking at the
    // preferences, spent making sure the windows agree with them. The notch reads
    // them exactly once, at mount, and has no other way back if that read was ever
    // wrong; `apply` above already re-asserts the half Rust owns.
    let _ = app.emit("settings-changed", settings);

    Ok(())
}

#[tauri::command]
pub fn settings_close(app: AppHandle) {
    if let Some(win) = app.get_webview_window(SETTINGS_LABEL) {
        let _ = win.hide();
    }
}
