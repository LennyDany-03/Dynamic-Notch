//! The countdown timer's store.
//!
//! Same shape as `reminders.rs` and `notes.rs`: a flat JSON file in the app-data
//! dir, read whole and written whole, write-then-rename so a partial write cannot
//! cost the user the file, and `unwrap_or_default()` on a corrupt one so a bad
//! file never wedges the feature. The bad file is left on disk rather than
//! overwritten, so it can still be recovered by hand.
//!
//! **Time is stored as an instant and nothing else** — `ends_at` is Unix millis,
//! exactly as `Reminder::due_at` is. A stored "remaining" would need something
//! ticking to keep it honest, and after a relaunch there was nothing ticking; an
//! instant read against the wall clock is right by construction however long the
//! app was closed. Which is the whole reason this is on disk at all: Crest
//! installs its own updates silently and restarts itself, and a twenty-five
//! minute timer that died because the app updated halfway through would be the
//! app quietly losing something the user was relying on.
//!
//! **One thing here is not in `reminders.rs`, and it is the reason this file
//! exists rather than another `localStorage` key: `write_timer` broadcasts.**
//! Reminders are mounted by one window. The timer is mounted by *every* notch
//! window, and with `notchAllDisplays` on there are as many of those as there are
//! screens — so without an emit, starting a timer on one monitor would leave the
//! other monitors' pills showing nothing, or worse, showing a stale one. The
//! `timer-changed` event is the same mechanism `settings-changed` already uses
//! for exactly the same problem.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct TimerState {
    /// What the timer was last started for, in ms. `0` when nothing is set.
    ///
    /// Kept after a timer finishes rather than cleared: it is the denominator the
    /// ring is drawn from, and it is what lets the card come back to rest showing
    /// the duration that just ran.
    #[serde(default)]
    pub duration_ms: i64,

    /// The instant it lands on. `None` while paused or idle.
    #[serde(default)]
    pub ends_at: Option<i64>,

    /// What was left when it was paused. `None` unless paused.
    ///
    /// The one duration in this file, and deliberately so: a paused timer has no
    /// instant, because the instant it lands on is not decided until it resumes.
    #[serde(default)]
    pub paused_remaining_ms: Option<i64>,
}

fn timer_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("could not create {dir:?}: {e}"))?;
    Ok(dir.join("timer.json"))
}

#[tauri::command]
pub fn read_timer(app: AppHandle) -> Result<TimerState, String> {
    let path = timer_path(&app)?;
    if !path.exists() {
        return Ok(TimerState::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("could not read {path:?}: {e}"))?;
    if raw.trim().is_empty() {
        return Ok(TimerState::default());
    }
    Ok(serde_json::from_str(raw.trim_start_matches('\u{feff}')).unwrap_or_default())
}

#[tauri::command]
pub fn write_timer(app: AppHandle, timer: TimerState) -> Result<(), String> {
    let path = timer_path(&app)?;
    let payload = serde_json::to_string_pretty(&timer).map_err(|e| e.to_string())?;

    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, payload).map_err(|e| format!("could not write {tmp:?}: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("could not replace {path:?}: {e}"))?;

    // Every notch window mounts the timer. This is what keeps a mirrored set of
    // them showing one timer rather than one each. Emitted after the write, so a
    // window that reacts by reading the file cannot read the old one.
    let _ = app.emit("timer-changed", timer);

    Ok(())
}
