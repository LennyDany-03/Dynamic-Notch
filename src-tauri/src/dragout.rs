/// Native OLE drag source for the File Shelf.
///
/// The webview cannot start a drag that another application will accept — Tauri
/// intercepts HTML5 drag-and-drop, and even without that, dropping onto a foreign
/// window requires a real OLE data object carrying `CF_HDROP`.
///
/// Rather than implementing `IDataObject` and `IDropSource` by hand, this asks the
/// shell for both: `SHCreateShellItemArrayFromIDLists` builds an item array from
/// parsed paths, binding it to `BHID_DataObject` yields a fully-formed shell data
/// object, and `SHDoDragDrop` supplies a default drop source with the correct
/// cursors and feedback.
///
/// `SHDoDragDrop` blocks until the drag finishes, so it runs on its own
/// OLE-initialised thread. Blocking Tauri's main thread here would freeze the
/// webview for the duration of every drag.
#[cfg(windows)]
#[tauri::command]
pub fn start_drag_out(paths: Vec<String>) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::Com::IDataObject;
    use windows::Win32::System::Ole::{OleInitialize, OleUninitialize};
    use windows::Win32::UI::Shell::Common::ITEMIDLIST;
    use windows::Win32::UI::Shell::{
        SHCreateShellItemArrayFromIDLists, SHDoDragDrop, SHParseDisplayName, BHID_DataObject,
        IShellItemArray,
    };
    use windows::Win32::System::Ole::{DROPEFFECT_COPY, DROPEFFECT_LINK};

    if paths.is_empty() {
        return Ok(());
    }

    let handle = std::thread::spawn(move || -> Result<(), String> {
        unsafe {
            OleInitialize(None).map_err(|e| format!("OleInitialize failed: {e}"))?;

            let mut pidls: Vec<*const ITEMIDLIST> = Vec::with_capacity(paths.len());

            let result = (|| -> Result<(), String> {
                for path in &paths {
                    let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
                    let mut pidl: *mut ITEMIDLIST = std::ptr::null_mut();
                    SHParseDisplayName(PCWSTR(wide.as_ptr()), None, &mut pidl, 0, None)
                        .map_err(|e| format!("could not resolve {path}: {e}"))?;
                    pidls.push(pidl as *const ITEMIDLIST);
                }

                let items: IShellItemArray = SHCreateShellItemArrayFromIDLists(&pidls)
                    .map_err(|e| format!("could not build item array: {e}"))?;

                let data_object: IDataObject = items
                    .BindToHandler(None, &BHID_DataObject)
                    .map_err(|e| format!("could not bind data object: {e}"))?;

                // Ignores its own result: a cancelled drag reports failure, which is
                // an ordinary outcome rather than an error worth surfacing.
                let _ = SHDoDragDrop(
                    HWND(std::ptr::null_mut()),
                    &data_object,
                    None,
                    DROPEFFECT_COPY | DROPEFFECT_LINK,
                );
                Ok(())
            })();

            for pidl in pidls {
                windows::Win32::System::Com::CoTaskMemFree(Some(pidl as *const core::ffi::c_void));
            }
            OleUninitialize();
            result
        }
    });

    handle
        .join()
        .map_err(|_| "drag thread panicked".to_string())?
}

#[cfg(not(windows))]
#[tauri::command]
pub fn start_drag_out(paths: Vec<String>) -> Result<(), String> {
    let _ = paths;
    Ok(())
}
