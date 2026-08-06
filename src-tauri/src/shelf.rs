use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// File Shelf persistence.
///
/// The shelf stores *references*, not copies — dropping a file onto the notch
/// must not duplicate it or move it out from under the app that owns it.

fn shelf_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("could not create {dir:?}: {e}"))?;
    Ok(dir.join("shelf.json"))
}

#[tauri::command]
pub fn read_shelf(app: AppHandle) -> Result<Vec<String>, String> {
    let path = shelf_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let stored: Vec<String> = serde_json::from_str(&raw).unwrap_or_default();
    // Files get moved, renamed and deleted outside the app. Drop anything that no
    // longer resolves rather than showing a shelf full of dead tiles.
    Ok(stored
        .into_iter()
        .filter(|p| PathBuf::from(p).exists())
        .collect())
}

#[tauri::command]
pub fn write_shelf(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
    let path = shelf_path(&app)?;
    let payload = serde_json::to_string_pretty(&paths).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, payload).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}
