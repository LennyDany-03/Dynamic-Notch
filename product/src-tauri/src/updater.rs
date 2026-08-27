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

use crate::tray::MENU_LABEL;

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

/// Whether this build may update *itself, without being asked*.
///
/// Only an installed Crest may, which is `autostart`'s rule reused rather than
/// restated — see `autostart::running_installed_build`. There it stops a source-tree
/// binary from enrolling itself in startup; here it stops one from enrolling itself
/// in silent replacement, and the second is the worse of the two by some distance.
///
/// The failure it exists to prevent is not hypothetical and it does not look like a
/// bug. `installMode` is `"quiet"`, so NSIS draws nothing at all: a `npm run tauri dev`
/// session whose version is behind the published release checks 25s after launch,
/// downloads that release, installs it over the top and restarts — into the *installed*
/// build. The dev process is gone with no dialog, no error and exit code 0, and the
/// feature being worked on has vanished with it, because the binary now running is
/// whatever shipped last. Every `tauri dev` afterwards then exits instantly, since the
/// relaunched release holds the single-instance mutex from `lib.rs`. The whole thing
/// reads as "the app crashes when I run it", which is the one description that points
/// nowhere near an updater.
///
/// This gates the **automatic** path only. `updater_check` and `updater_install` stay
/// callable, because the tray row is someone explicitly asking and reports the version
/// before spending it — the objection is to a build replacing itself unprompted, not
/// to the update mechanism being reachable while developing it.
/// A packaged (Store) build is excluded outright, and unlike the source-tree case
/// the exclusion covers the manual path too — see `store_managed` below.
#[tauri::command]
pub fn updater_auto_allowed() -> bool {
    crate::autostart::running_installed_build() && !crate::autostart::is_packaged()
}

/// The refusal both update commands share when Crest is running from an MSIX.
///
/// The Store owns the version of a packaged app: it installs updates itself, and
/// the package is signed by Microsoft's own certificate after certification. The
/// payload behind `updater_check` is an **NSIS installer**, which cannot service
/// an MSIX at all — at best it writes a second, unpackaged Crest into
/// `%LOCALAPPDATA%` beside the packaged one, leaving two installs whose single-
/// instance mutex means whichever wins the boot silently suppresses the other,
/// and leaving the Store still reporting the package as up to date.
///
/// So this is not the source-tree rule with a wider net. That one lets
/// `updater_check` and `updater_install` stay callable because a developer asking
/// explicitly is a legitimate ask; here there is no version of the ask that ends
/// well, and the tray's update row is hidden by `updater_auto_allowed` anyway.
/// The `Err` is what a hand-rolled `invoke` from a devtools console gets.
fn store_managed() -> Option<String> {
    crate::autostart::is_packaged().then(|| {
        "Crest was installed from the Microsoft Store, which keeps it up to date."
            .to_string()
    })
}

/// Ask the endpoint what the latest release is.
///
/// `Ok(None)` means this build is current. The signature is verified against the
/// baked-in public key during *download*, not here, so a hostile manifest can at
/// worst make the popup claim a version that then fails to install.
#[tauri::command]
pub async fn updater_check(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    if let Some(refusal) = store_managed() {
        return Err(refusal);
    }

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
    if let Some(refusal) = store_managed() {
        return Err(refusal);
    }

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
                // Handing off to the installer. These windows are always-on-top,
                // so leaving them up would park a frozen notch over the setup UI.
                // Every notch, not just the original — with mirroring on there is
                // one per screen and they are all in the topmost band.
                if let Some(win) = app.get_webview_window(MENU_LABEL) {
                    let _ = win.hide();
                }
                for win in crate::display::notch_windows(&app) {
                    let _ = win.hide();
                }
            },
        )
        .await
        .map_err(|e| e.to_string())
}
