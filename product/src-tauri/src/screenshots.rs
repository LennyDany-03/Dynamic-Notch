//! Recent screenshots, as a rolling window over the folders Windows saves them in.
//!
//! **Nothing here is persisted and nothing is copied.** That is the same rule
//! `shelf.rs` follows and it is worth the sentence: a screenshot the user took is
//! already a file they own, in a folder they know, and a notch that duplicated it
//! into its own cache would double the disk cost of every capture and then have to
//! answer for what happens when the two copies disagree. The list is a *view* —
//! scan the folders, sort by when they were written, keep the newest handful — so
//! it is right by construction, needs no reconciliation with anything, and holds
//! whatever the user's own screenshot folder holds.
//!
//! Which is also what makes it "temporary" in the sense the feature is for: the
//! window rolls. A capture arrives at the front and the twenty-fifth falls off the
//! back, without anything being deleted.
//!
//! The two things the notch can do with one — open it, or drag it into another app
//! — are both things that already existed. Opening is `launcher::launch_app`, the
//! same shell verb the file shelf opens with; dragging is `shelf::start_file_drag`,
//! the real OLE drag, because a browser drag event cannot hand Explorer or Photoshop
//! a filesystem object. This module adds the *finding*, and a thumbnail.

use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

/// How many are kept in the window.
///
/// Two rows of four in the card and a scroll for the rest. Past about this many
/// the answer to "where is that screenshot" stops being the notch and starts being
/// Explorer, which is a better tool for it — this is for the one you took a minute
/// ago.
const MAX_SHOTS: usize = 24;

/// What counts as a screenshot. Extension only, deliberately: the folders below
/// are already the ones Windows saves captures to, so anything in them with a
/// picture extension is one, and sniffing file contents to second-guess that would
/// be work in aid of nothing.
const EXTENSIONS: [&str; 6] = ["png", "jpg", "jpeg", "bmp", "webp", "gif"];

/// Rendered size for a tile's thumbnail.
///
/// Tiles draw at 93×68; asking for 256 keeps them crisp on a 200% display and on
/// the banner, which draws the same cached image larger.
const THUMB_PX: i32 = 256;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Shot {
    /// Absolute path — the id, and what both actions take.
    pub path: String,
    pub name: String,
    /// Unix millis, from the file's modified time.
    ///
    /// Modified rather than created, because a capture is written once and the two
    /// are the same moment for it — and because a file *copied* into the folder
    /// keeps its old creation time, which would file it under last March and hide
    /// it at the bottom of a list sorted newest-first.
    pub captured_at: u64,
}

/// Where Windows puts captures.
///
/// Resolved through Tauri's path resolver rather than by pasting `%USERPROFILE%`
/// together, because Pictures is a *redirectable* known folder: it is the first
/// thing OneDrive moves, and a machine with backup switched on saves every
/// screenshot somewhere `USERPROFILE` does not reach. The resolver asks Windows,
/// which is the only party that actually knows.
///
/// Four sources, and each is a real one:
///  - `Pictures\Screenshots` — Win+PrtScn, and the Snipping Tool's auto-save,
///    which is on by default on Windows 11.
///  - `Videos\Captures` — Game Bar's Win+Alt+PrtScn.
///  - the two OneDrive layouts, for the case where redirection is *partial* — the
///    known folder still points at the local path while OneDrive writes to its
///    own tree. Env vars are the only handle on those, and a missing one simply
///    yields nothing.
///
/// Missing directories are not an error and are not reported: a desktop with no
/// Game Bar has no `Captures`, and that is the ordinary case rather than a fault.
fn sources(app: &AppHandle) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();

    if let Ok(pictures) = app.path().picture_dir() {
        dirs.push(pictures.join("Screenshots"));
    }
    if let Ok(videos) = app.path().video_dir() {
        dirs.push(videos.join("Captures"));
    }

    for key in ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"] {
        if let Ok(root) = std::env::var(key) {
            if !root.is_empty() {
                dirs.push(PathBuf::from(root).join("Pictures").join("Screenshots"));
            }
        }
    }

    // The OneDrive variables often name the same tree twice, and a redirected
    // Pictures folder can already *be* the OneDrive one — so the same directory
    // would otherwise be walked three times and every screenshot in it would
    // appear three times in the card.
    dirs.sort();
    dirs.dedup();
    dirs.retain(|dir| dir.is_dir());
    dirs
}

fn modified_ms(entry: &std::fs::DirEntry) -> Option<u64> {
    let modified = entry.metadata().ok()?.modified().ok()?;
    Some(modified.duration_since(UNIX_EPOCH).ok()?.as_millis() as u64)
}

/// The last answer, and the state of the folders it was computed from.
///
/// This is what makes a two-second poll affordable. Without it every tick walks
/// every source folder and stats every file in it — and a Screenshots folder is
/// somewhere people accumulate things, so "every file" is routinely a few thousand
/// and can be sitting behind OneDrive. Windows bumps a *directory's* own modified
/// time whenever an entry is added, removed or renamed within it, so comparing
/// those (one stat per folder, two or three in total) answers "has anything
/// happened" without touching the contents.
///
/// The cache is keyed on the whole set of `(directory, modified)` pairs rather
/// than on a count or a newest-timestamp, which is what makes it correct for the
/// three cases a simpler key gets wrong: a folder appearing (a monitor's worth of
/// OneDrive syncing in), a folder disappearing, and a delete that leaves the newest
/// capture exactly where it was.
///
/// A file *modified in place* would be missed, which is the one trade — and a
/// screenshot is written once and never touched again, so there is nothing to miss.
static CACHE: Mutex<Option<(Vec<(PathBuf, SystemTime)>, Vec<Shot>)>> = Mutex::new(None);

/// Each source folder's own modified time, in a stable order.
fn folder_state(dirs: &[PathBuf]) -> Vec<(PathBuf, SystemTime)> {
    dirs.iter()
        .filter_map(|dir| {
            let modified = std::fs::metadata(dir).ok()?.modified().ok()?;
            Some((dir.clone(), modified))
        })
        .collect()
}

/// The newest captures, newest first.
///
/// Called on a poll, so it stays a directory listing and nothing more: no copying,
/// no index to keep in step, no writes at all. A folder of a few hundred entries
/// is a couple of stat calls' worth of work, and the sort is over at most that.
///
/// `now` bounds the future half. A file whose clock says tomorrow — which happens
/// with a wrongly-set timezone, or a file restored from a backup — would otherwise
/// pin itself to the top of the list forever and push every real capture out of
/// the window it is supposed to be rolling through.
#[tauri::command]
pub fn list_screenshots(app: AppHandle) -> Vec<Shot> {
    let dirs = sources(&app);
    let state = folder_state(&dirs);

    // A poisoned lock means a previous holder panicked mid-update. What is behind
    // it is a cached answer that will simply be recomputed, so recovering beats
    // propagating a panic into a poll that runs every two seconds.
    let mut cache = CACHE.lock().unwrap_or_else(|e| e.into_inner());
    if let Some((cached_state, cached_shots)) = cache.as_ref() {
        if *cached_state == state {
            return cached_shots.clone();
        }
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|since| since.as_millis() as u64)
        .unwrap_or(u64::MAX);

    let mut shots: Vec<Shot> = Vec::new();

    for dir in &dirs {
        let Ok(entries) = std::fs::read_dir(dir) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let is_picture = path
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()))
                .unwrap_or(false);
            if !is_picture {
                continue;
            }

            let Some(captured_at) = modified_ms(&entry) else {
                continue;
            };
            if captured_at > now {
                continue;
            }

            let (Some(path_str), Some(name)) = (
                path.to_str().map(str::to_string),
                path.file_name().and_then(|n| n.to_str()).map(str::to_string),
            ) else {
                continue;
            };

            shots.push(Shot {
                path: path_str,
                name,
                captured_at,
            });
        }
    }

    shots.sort_by(|a, b| b.captured_at.cmp(&a.captured_at));
    shots.truncate(MAX_SHOTS);

    *cache = Some((state, shots.clone()));
    shots
}

/// A tile's picture, as a PNG data URI.
///
/// Its own command rather than a field on `Shot` for the reason the notification
/// logo is its own call: the list is polled every couple of seconds and a
/// thumbnail is tens of milliseconds of shell work, so folding them together would
/// make every poll pay for pictures that have not changed since the last one. The
/// frontend caches by path.
///
/// `async` plus `spawn_blocking`, exactly as `icons::app_icon`: this reads the
/// disk, and doing that on the async runtime's thread would stall every other
/// command behind a 4K PNG being decoded.
#[tauri::command]
pub async fn screenshot_thumbnail(path: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || crate::icons::thumbnail(&path, THUMB_PX))
        .await
        .map_err(|e| format!("thumbnail failed: {e}"))
}

/// Open Explorer with the file selected.
///
/// The third thing to do with a capture, after opening it and dragging it: find
/// out *where* it went. Windows 11 saves screenshots in three different places
/// depending on which shortcut was pressed, and "which folder is this one in" is
/// not a question the notch can answer in a tile 93px wide.
///
/// `explorer.exe /select,` rather than the opener plugin, because it is the same
/// verb Explorer's own "Show in folder" uses and needs nothing declared in a
/// capability file — see the Downloads button `notifications` had to withdraw.
#[tauri::command]
pub fn reveal_screenshot(path: String) -> Result<(), String> {
    if !PathBuf::from(&path).exists() {
        return Err("That screenshot is no longer there.".into());
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;

        // No space after the comma, and one argument: `/select,C:\…\shot.png` is
        // a single token to Explorer, and splitting it opens the user's Documents
        // folder instead.
        std::process::Command::new("explorer.exe")
            .raw_arg(format!("/select,\"{path}\""))
            .spawn()
            .map_err(|e| format!("could not open Explorer: {e}"))?;
    }

    Ok(())
}
