use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Emitted once the shell drag finishes, so the frontend can stop treating the
/// window as mid-drag. The command itself returns as soon as the drag *starts*.
#[cfg(windows)]
pub const DRAG_ENDED_EVENT: &str = "file-drag-ended";

/// Start a real Windows shell drag for a shelf item. Browser drag events cannot
/// give Explorer or other desktop programs a filesystem object.
///
/// `async` matters: it keeps the command off the main thread, so posting the drag
/// back to the main thread below cannot deadlock against its own reply.
#[cfg(windows)]
#[tauri::command]
pub async fn start_file_drag(
    app: AppHandle,
    window: tauri::WebviewWindow,
    path: String,
) -> Result<(), String> {
    if !PathBuf::from(&path).exists() {
        return Err("The shelved item no longer exists.".to_string());
    }

    // HWND holds a raw pointer and is not `Send`; carry it across as an integer.
    let hwnd = window
        .hwnd()
        .map_err(|e| format!("no window handle: {e}"))?
        .0 as isize;
    let done = app.clone();

    // SHDoDragDrop runs a modal loop that takes over the mouse, and OLE only
    // tracks a drag on the thread owning the source window. Running it on a
    // spawned thread — as this did — starts a drag no drop target ever sees.
    app.run_on_main_thread(move || {
        if let Err(err) = drag_on_main_thread(hwnd, &path) {
            eprintln!("shelf: {err}");
        }
        let _ = tauri::Emitter::emit(&done, DRAG_ENDED_EVENT, ());
    })
    .map_err(|e| format!("Could not reach the main thread: {e}"))
}

/// The drag itself. Runs on Tauri's main thread and blocks it until the user
/// drops or cancels; SHDoDragDrop pumps messages meanwhile, so the window stays
/// responsive the same way a modal menu does.
#[cfg(windows)]
fn drag_on_main_thread(hwnd: isize, path: &str) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::Com::{CoTaskMemFree, IDataObject};
    use windows::Win32::System::Ole::{
        OleInitialize, OleUninitialize, DROPEFFECT_COPY, DROPEFFECT_LINK,
    };
    use windows::Win32::UI::Shell::Common::ITEMIDLIST;
    use windows::Win32::UI::Shell::{
        BHID_DataObject, IShellItemArray, SHCreateShellItemArrayFromIDLists, SHDoDragDrop,
        SHParseDisplayName,
    };
    use windows::Win32::UI::WindowsAndMessaging::SetForegroundWindow;

    let hwnd = HWND(hwnd as *mut core::ffi::c_void);

    unsafe {
        // DoDragDrop needs OLE's drag-and-drop machinery, which CoInitializeEx
        // does not set up. Tao already initialised this thread, so this only
        // takes a reference; the matching uninitialise below gives it back.
        OleInitialize(None)
            .map_err(|e| format!("Could not initialize Windows drag-and-drop: {e}"))?;

        let result = (|| -> Result<(), String> {
            // OLE only tracks the drag for the foreground window, and the notch
            // deliberately never takes focus; this gesture is the exception.
            let _ = SetForegroundWindow(hwnd);

            let wide: Vec<u16> = path.encode_utf16().chain(Some(0)).collect();
            let mut pidl: *mut ITEMIDLIST = std::ptr::null_mut();
            SHParseDisplayName(PCWSTR(wide.as_ptr()), None, &mut pidl, 0, None)
                .map_err(|e| format!("Could not resolve {path}: {e}"))?;

            // These are absolute PIDLs. SHCreateDataObject — used here before —
            // wants child PIDLs plus their parent folder, so handing it absolute
            // ones built a data object that carried no usable CF_HDROP and that
            // every drop target silently refused.
            let built = SHCreateShellItemArrayFromIDLists(&[pidl as *const ITEMIDLIST]);
            CoTaskMemFree(Some(pidl as *const core::ffi::c_void));
            let items: IShellItemArray =
                built.map_err(|e| format!("Could not build item array: {e}"))?;

            let data: IDataObject = items
                .BindToHandler(None, &BHID_DataObject)
                .map_err(|e| format!("Could not create file drag data: {e}"))?;

            // Passing `None` for the drop source asks the shell for its default,
            // with the standard cursors and escape/right-button cancellation.
            // A cancelled drag reports the same failure a real one does, and
            // cancelling is an ordinary outcome rather than an error.
            let _ = SHDoDragDrop(hwnd, &data, None, DROPEFFECT_COPY | DROPEFFECT_LINK);
            Ok(())
        })();

        OleUninitialize();
        result
    }
}

#[cfg(not(windows))]
#[tauri::command]
pub async fn start_file_drag(_path: String) -> Result<(), String> {
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
