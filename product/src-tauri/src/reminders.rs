//! Reminders behind the calendar module.
//!
//! Same shape as `notes.rs` and for the same reasons: a flat JSON file in the
//! app-data dir, written whole, read whole. There is nothing to query and nothing
//! to join — the calendar draws a month at a time and the whole file is a few
//! kilobytes of "6pm, groceries".
//!
//! **Time is stored as Unix milliseconds and nothing else.** No timezone, no
//! wall-clock string. The frontend builds the instant from a local date and time
//! the user typed and reads it back the same way, so a reminder set for 6pm is at
//! 6pm on the machine that set it; storing "18:00" instead would mean deciding
//! what a reminder does when the machine's zone changes, which is a question a
//! sticky note does not have an answer to either.
//!
//! `fired_at` is persisted rather than kept in memory, which is the one thing
//! here that is not obvious. The notch is a long-running process that is also
//! frequently restarted during development and after updates, and an in-memory
//! "already announced" set would replay every overdue reminder on every launch.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Reminder {
    pub id: String,
    pub title: String,
    /// Unix millis. See the note above about why this is an instant.
    pub due_at: i64,
    /// When the notch announced it, or `None` if it has not yet.
    #[serde(default)]
    pub fired_at: Option<i64>,
    /// Ticked off by hand. Kept rather than deleted so the day still shows what
    /// was on it — a calendar that erases what you did is a poor record of the
    /// day, and this is the one module whose job is to be a record.
    #[serde(default)]
    pub done: bool,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RemindersFile {
    pub reminders: Vec<Reminder>,
}

fn reminders_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("could not create {dir:?}: {e}"))?;
    Ok(dir.join("reminders.json"))
}

#[tauri::command]
pub fn read_reminders(app: AppHandle) -> Result<RemindersFile, String> {
    let path = reminders_path(&app)?;
    if !path.exists() {
        return Ok(RemindersFile::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("could not read {path:?}: {e}"))?;
    if raw.trim().is_empty() {
        return Ok(RemindersFile::default());
    }
    // A corrupt file must not wedge the feature, as in `notes.rs`. The bad file is
    // left on disk rather than overwritten, so it can still be recovered by hand.
    Ok(serde_json::from_str(raw.trim_start_matches('\u{feff}')).unwrap_or_default())
}

#[tauri::command]
pub fn write_reminders(app: AppHandle, reminders: Vec<Reminder>) -> Result<(), String> {
    let path = reminders_path(&app)?;
    let payload =
        serde_json::to_string_pretty(&RemindersFile { reminders }).map_err(|e| e.to_string())?;

    // Write-then-rename, as in `notes.rs`: this runs on every edit, and a partial
    // write would cost the user the whole file.
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, payload).map_err(|e| format!("could not write {tmp:?}: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("could not replace {path:?}: {e}"))?;
    Ok(())
}
