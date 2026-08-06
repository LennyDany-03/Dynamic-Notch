use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Quick Notes persistence.
///
/// A flat JSON file in the app-data dir rather than SQLite: a note is a short
/// text blob, there is nothing to query or join, and no schema to migrate. Adding
/// a SQL plugin to save a string would cost a dependency, a migration story and an
/// async setup path for no benefit.

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub body: String,
    /// Unix millis. Written by the frontend so ordering matches what the user saw.
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NotesFile {
    pub notes: Vec<Note>,
}

fn notes_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("could not create {dir:?}: {e}"))?;
    Ok(dir.join("notes.json"))
}

#[tauri::command]
pub fn read_notes(app: AppHandle) -> Result<NotesFile, String> {
    let path = notes_path(&app)?;
    if !path.exists() {
        return Ok(NotesFile::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("could not read {path:?}: {e}"))?;
    if raw.trim().is_empty() {
        return Ok(NotesFile::default());
    }
    // A corrupt file must not wedge the feature — fall back to empty rather than
    // erroring forever. The bad file is left on disk for inspection.
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

#[tauri::command]
pub fn write_notes(app: AppHandle, notes: Vec<Note>) -> Result<(), String> {
    let path = notes_path(&app)?;
    let payload = serde_json::to_string_pretty(&NotesFile { notes }).map_err(|e| e.to_string())?;

    // Write-then-rename so an interrupted save cannot truncate the existing file.
    // This runs on every autosave debounce, so a partial write is a real risk.
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, payload).map_err(|e| format!("could not write {tmp:?}: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("could not replace {path:?}: {e}"))?;
    Ok(())
}
