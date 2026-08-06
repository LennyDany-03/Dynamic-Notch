use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Start a real Windows shell drag for a shelf item. Browser drag events cannot
/// give Explorer or other desktop programs a filesystem object.
#[cfg(windows)]
#[tauri::command]
pub fn start_file_drag(path: String) -> Result<(), String> {
    // Tauri commands normally execute on a worker thread that can be MTA. OLE
    // drag/drop requires its own STA, otherwise Windows quietly rejects the
    // drag when it leaves the WebView. A dedicated thread gives it that STA.
    std::thread::spawn(move || start_file_drag_on_sta(path))
        .join()
        .map_err(|_| "The file drag thread stopped unexpectedly.".to_string())?
}

#[cfg(windows)]
fn start_file_drag_on_sta(path: String) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, IDataObject, COINIT_APARTMENTTHREADED};
    use windows::Win32::System::Ole::DROPEFFECT_COPY;
    use windows::Win32::UI::Shell::{ILCreateFromPathW, ILFree, SHCreateDataObject, SHDoDragDrop};

    if !PathBuf::from(&path).exists() {
        return Err("The shelved item no longer exists.".to_string());
    }

    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED)
            .ok()
            .map_err(|e| format!("Could not initialize Windows drag-and-drop: {e}"))?;
        let drag_result = (|| -> Result<(), String> {
        let wide: Vec<u16> = path.encode_utf16().chain(Some(0)).collect();
        let pidl = ILCreateFromPathW(PCWSTR(wide.as_ptr()));
        if pidl.is_null() {
            return Err(format!("Could not prepare {path} for dragging."));
        }

        let pidls = [pidl as *const _];
        let result: windows::core::Result<IDataObject> = SHCreateDataObject(None, Some(&pidls), None);
        ILFree(Some(pidl));
        let data = result.map_err(|e| format!("Could not create file drag data: {e}"))?;
        // SHDoDragDrop supplies the shell's default drop source when `None` is
        // passed, including the standard escape/right-button cancellation rules.
        SHDoDragDrop(None, &data, None, DROPEFFECT_COPY)
            .map_err(|e| format!("File drag failed: {e}"))?;
        Ok(())
        })();
        CoUninitialize();
        drag_result
    }
}

#[cfg(not(windows))]
#[tauri::command]
pub fn start_file_drag(_path: String) -> Result<(), String> {
    Err("Dragging files out of the shelf is available on Windows only.".to_string())
}

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
