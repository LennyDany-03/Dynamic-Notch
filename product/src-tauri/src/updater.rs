//! In-app updates.
//!
//! The plugin also ships a JS API, but every other tray row already goes through
//! a Rust command, so the check lives here too — that keeps the popup's capability
//! free of `updater:*` permissions and keeps the download off the webview.
//!
//! Two steps rather than one. `updater_check` reports what is available and parks
//! the [`Update`] in state; `updater_install` spends it. Nobody's app should
//! restart itself because they clicked a menu row to read a version number.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::tray::{MENU_LABEL, NOTCH_LABEL};

/// Percent complete, emitted to the popup while the installer downloads.
const PROGRESS_EVENT: &str = "updater-progress";

/// The update found by the last `updater_check`, held so that `updater_install`
/// does not have to hit the network again — and so the bytes we install are the
/// ones the user was shown a version number for.
#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<Update>>);

impl PendingUpdate {
    /// A poisoned lock here means a previous check panicked mid-write. The value
    /// is a plain `Option<Update>` with no invariant to uphold, so recovering is
    /// strictly better than taking the whole app down over a menu row.
    fn lock(&self) -> std::sync::MutexGuard<'_, Option<Update>> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub notes: Option<String>,
}

/// Ask the endpoint what the latest release is.
///
/// `Ok(None)` means this build is current. The signature is verified against the
/// baked-in public key during *download*, not here, so a hostile manifest can at
/// worst make the popup claim a version that then fails to install.
#[tauri::command]
pub async fn updater_check(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;

    let info = update.as_ref().map(|found| UpdateInfo {
        version: found.version.clone(),
        notes: found.body.clone(),
    });

    *app.state::<PendingUpdate>().lock() = update;

    Ok(info)
}

/// Download the parked update and hand it to the NSIS installer.
///
/// On Windows the plugin calls `std::process::exit(0)` once the installer is
/// spawned and the `/R` flag relaunches us, so on success this never returns.
#[tauri::command]
pub async fn updater_install(app: AppHandle) -> Result<(), String> {
    // Taken, not cloned: a failed install should send the user back through
    // `updater_check` rather than silently retrying stale release metadata.
    let update = app
        .state::<PendingUpdate>()
        .lock()
        .take()
        .ok_or_else(|| "No update is pending — check for updates first.".to_string())?;

    let progress_app = app.clone();
    let mut downloaded: u64 = 0;

    update
        .download_and_install(
            move |chunk, total| {
                downloaded += chunk as u64;
                // No content-length means no meaningful percentage; the popup
                // shows an indeterminate label until `Some` arrives.
                if let Some(total) = total.filter(|t| *t > 0) {
                    let percent = (downloaded * 100 / total).min(100) as u8;
                    let _ = progress_app.emit_to(MENU_LABEL, PROGRESS_EVENT, percent);
                }
            },
            move || {
                // Handing off to the installer. Both windows are always-on-top,
                // so leaving them up would park a frozen notch over the setup UI.
                for label in [MENU_LABEL, NOTCH_LABEL] {
                    if let Some(win) = app.get_webview_window(label) {
                        let _ = win.hide();
                    }
                }
            },
        )
        .await
        .map_err(|e| e.to_string())
}
