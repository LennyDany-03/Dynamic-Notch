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

/// Download progress, emitted while the installer downloads.
///
/// Broadcast rather than sent to the tray popup alone: the notch draws its own
/// loader now (`UpdateAnnounce`), and the popup may not even be open — the update
/// usually starts by itself a few seconds after launch.
const PROGRESS_EVENT: &str = "updater-progress";

/// How far along the download is.
///
/// Carries the byte counts as well as the percentage because the loader says
/// "4.2 of 12.8 MB" — a bare percentage on a bar that has not moved for three
/// seconds is indistinguishable from a stalled download, and the megabytes are
/// what tell the user it is a big update rather than a stuck one.
#[derive(Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub downloaded: u64,
    /// `None` when the server sent no content-length, which makes the bar
    /// indeterminate rather than wrong.
    pub total: Option<u64>,
    pub percent: Option<u8>,
}

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
///
/// `installMode` is `"quiet"` in `tauri.conf.json`, so NSIS runs with `/S` and
/// draws nothing at all — no setup window, no progress dialog, no "Crest has been
/// installed" page. The only thing on screen is the notch's own loader, which is
/// the point: an app that updates itself should not hand the user somebody else's
/// installer UI. Quiet mode is only viable because the bundle is a per-user
/// install and needs no elevation; a per-machine build would silently fail here
/// where `"passive"` would at least have shown a UAC prompt.
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
                let total = total.filter(|t| *t > 0);
                // No content-length means no meaningful percentage; the loader
                // shows an indeterminate bar until `Some` arrives.
                let percent = total.map(|t| (downloaded * 100 / t).min(100) as u8);

                // Broadcast: the notch's loader and the tray popup both listen,
                // and neither is guaranteed to be open.
                let _ = progress_app.emit(
                    PROGRESS_EVENT,
                    Progress {
                        downloaded,
                        total,
                        percent,
                    },
                );
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
