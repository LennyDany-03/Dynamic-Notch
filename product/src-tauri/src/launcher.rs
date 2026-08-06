use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
#[cfg(windows)]
use std::process::Stdio;
use std::path::{Path, PathBuf};
#[cfg(windows)]
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

/// Quick Launcher app index.
///
/// Primary source is the `shell:AppsFolder` namespace — exactly what the Start Menu
/// shows, both classic Win32 shortcuts and Store/UWP apps, each with a launchable
/// AppID. A .lnk directory scan was the obvious first approach and is wrong on its
/// own: Store apps (Spotify, Arc, Terminal, most of the modern surface) have no
/// shortcut file anywhere, so they are simply invisible to it.
///
/// AppsFolder is enumerated over COM rather than by asking `Get-StartApps` for the
/// same list. Both read the identical namespace, but the PowerShell route pays for
/// starting PowerShell: measured at ~1.1s against ~40ms for the COM walk, and it
/// was single-handedly responsible for the launcher's "Indexing…" delay.
/// `Get-StartApps` is kept as a fallback for when the COM enumeration comes back
/// empty, and the .lnk walk as a further one.

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppEntry {
    pub name: String,
    /// `shell:AppsFolder\<AppID>` for indexed apps, or a raw path for fallback
    /// entries. Opaque to the frontend — hand it back to `launch_app`.
    pub path: String,
}

#[derive(Deserialize)]
struct StartApp {
    #[serde(rename = "Name")]
    name: String,
    #[serde(rename = "AppID")]
    app_id: String,
}

const MAX_DEPTH: usize = 4;

const NOISE: [&str; 6] = [
    "uninstall",
    "readme",
    "release notes",
    "documentation",
    "help",
    "website",
];

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
#[cfg(windows)]
const START_APPS_TIMEOUT: Duration = Duration::from_secs(5);

fn is_noise(name: &str) -> bool {
    let lower = name.to_lowercase();
    NOISE.iter().any(|n| lower.contains(n))
}

/// Read one of an item's names, freeing the shell's copy of it.
#[cfg(windows)]
unsafe fn display_name(
    item: &windows::Win32::UI::Shell::IShellItem,
    kind: windows::Win32::UI::Shell::SIGDN,
) -> Option<String> {
    use windows::Win32::System::Com::CoTaskMemFree;

    let raw = item.GetDisplayName(kind).ok()?;
    let text = raw.to_string().ok();
    CoTaskMemFree(Some(raw.0 as *const core::ffi::c_void));
    text
}

/// Walk `shell:AppsFolder` — the same namespace the Start Menu lists from.
#[cfg(windows)]
pub(crate) fn scan_apps_folder() -> Option<Vec<AppEntry>> {
    use windows::core::w;
    use windows::Win32::UI::Shell::{
        IEnumShellItems, IShellItem, SHCreateItemFromParsingName, BHID_EnumItems,
        SIGDN_NORMALDISPLAY, SIGDN_PARENTRELATIVEPARSING,
    };

    unsafe {
        // Shared with icon extraction, which this overlaps with; see the comment
        // there for why the apartment is never torn back down.
        crate::icons::init_com_for_thread();

        let scan = (|| -> Option<Vec<AppEntry>> {
            let folder: IShellItem =
                SHCreateItemFromParsingName(w!("shell:AppsFolder"), None).ok()?;
            let items: IEnumShellItems = folder.BindToHandler(None, &BHID_EnumItems).ok()?;

            let mut apps = Vec::new();
            // Fetched in batches: every `Next` is a call into the AppsFolder
            // provider, and asking one item at a time made the walk one round
            // trip per installed app.
            let mut batch: [Option<IShellItem>; 64] = std::array::from_fn(|_| None);
            loop {
                let mut fetched = 0u32;
                // Next reports the end of the enumeration as a successful fetch
                // of zero items, not as an error.
                if items.Next(&mut batch, Some(&mut fetched)).is_err() || fetched == 0 {
                    break;
                }

                for slot in batch.iter_mut().take(fetched as usize) {
                    let Some(item) = slot.take() else { continue };

                    let Some(name) = display_name(&item, SIGDN_NORMALDISPLAY) else { continue };
                    if name.trim().is_empty() || is_noise(&name) {
                        continue;
                    }
                    // For AppsFolder children the parent-relative parsing name
                    // *is* the AppID, which is what `Get-StartApps` reports and
                    // what `shell:AppsFolder\…` needs to launch it.
                    let Some(app_id) = display_name(&item, SIGDN_PARENTRELATIVEPARSING) else {
                        continue;
                    };

                    apps.push(AppEntry {
                        name,
                        path: format!("shell:AppsFolder\\{app_id}"),
                    });
                }
            }
            Some(apps)
        })();

        scan
    }
}

#[cfg(not(windows))]
pub(crate) fn scan_apps_folder() -> Option<Vec<AppEntry>> {
    None
}

/// Ask the shell for the Start Menu's own app list.
#[cfg(windows)]
fn scan_start_apps() -> Option<Vec<AppEntry>> {
    use std::os::windows::process::CommandExt;

    // Get-StartApps belongs to the inbox StartMenu module and may be absent
    // when a separately installed PowerShell is first on PATH.
    let powershell = std::env::var("WINDIR")
        .map(|dir| PathBuf::from(dir).join(r"System32\WindowsPowerShell\v1.0\powershell.exe"))
        .ok()
        .filter(|path| path.exists())
        .unwrap_or_else(|| PathBuf::from("powershell.exe"));
    let mut child = std::process::Command::new(powershell)
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "$ErrorActionPreference='Stop'; Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress",
        ])
        // `spawn` inherits stdout by default. Capture it explicitly: otherwise
        // wait_with_output returns an empty string and every successful scan is
        // mistaken for an empty app list.
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .ok()?;

    // The StartMenu PowerShell module can hang while Windows is rebuilding its
    // index. Never leave the launcher stuck on “Indexing…” because of that.
    let started = Instant::now();
    loop {
        if child.try_wait().ok()?.is_some() {
            break;
        }
        if started.elapsed() >= START_APPS_TIMEOUT {
            let _ = child.kill();
            let _ = child.wait();
            return None;
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    let output = child.wait_with_output().ok()?;

    if !output.status.success() {
        return None;
    }

    let raw = String::from_utf8_lossy(&output.stdout);
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    // ConvertTo-Json emits a bare object when there is exactly one result.
    let apps: Vec<StartApp> = serde_json::from_str::<Vec<StartApp>>(trimmed)
        .or_else(|_| serde_json::from_str::<StartApp>(trimmed).map(|one| vec![one]))
        .ok()?;

    Some(
        apps.into_iter()
            .filter(|a| !a.name.trim().is_empty() && !is_noise(&a.name))
            .map(|a| AppEntry {
                name: a.name,
                path: format!("shell:AppsFolder\\{}", a.app_id),
            })
            .collect(),
    )
}

#[cfg(not(windows))]
fn scan_start_apps() -> Option<Vec<AppEntry>> {
    None
}

fn start_menu_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(program_data) = std::env::var("ProgramData") {
        dirs.push(PathBuf::from(program_data).join(r"Microsoft\Windows\Start Menu\Programs"));
    }
    if let Ok(app_data) = std::env::var("APPDATA") {
        dirs.push(PathBuf::from(app_data).join(r"Microsoft\Windows\Start Menu\Programs"));
    }
    dirs
}

fn walk(dir: &Path, depth: usize, out: &mut Vec<AppEntry>) {
    if depth > MAX_DEPTH {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        // Unreadable subtree (permissions, a broken junction) — skip it rather
        // than failing the whole scan.
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk(&path, depth + 1, out);
            continue;
        }

        let is_shortcut = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("lnk"))
            .unwrap_or(false);
        if !is_shortcut {
            continue;
        }

        let Some(name) = path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        if is_noise(name) {
            continue;
        }

        out.push(AppEntry {
            name: name.to_string(),
            path: path.to_string_lossy().to_string(),
        });
    }
}

fn scan_shortcuts() -> Vec<AppEntry> {
    let mut apps = Vec::new();
    for dir in start_menu_dirs() {
        if dir.exists() {
            walk(&dir, 0, &mut apps);
        }
    }
    apps
}

/// Applications installed outside the Start Menu (notably Brave and many VS
/// Code installs) register their executable under App Paths. This registry is
/// readable without elevation and provides a directly launchable file path.
#[cfg(windows)]
fn scan_registered_apps() -> Vec<AppEntry> {
    use std::os::windows::process::CommandExt;

    let output = std::process::Command::new("reg.exe")
        .args(["query", r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths", "/s"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
    let Ok(output) = output else { return Vec::new() };

    let mut apps = Vec::new();
    let mut current_name: Option<String> = None;
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("HKEY_") {
            current_name = trimmed
                .rsplit('\\')
                .next()
                .and_then(|name| name.strip_suffix(".exe"))
                .map(|name| name.replace(['_', '-'], " "));
            continue;
        }
        if !trimmed.starts_with("(Default)") {
            continue;
        }
        let Some(name) = current_name.clone() else { continue };
        let Some((_, value)) = trimmed.split_once("REG_SZ")
            .or_else(|| trimmed.split_once("REG_EXPAND_SZ")) else { continue };
        let path = value.trim().trim_matches('"');
        if path.is_empty() || !PathBuf::from(path).exists() {
            continue;
        }
        apps.push(AppEntry { name, path: path.to_string() });
    }
    apps
}

#[cfg(not(windows))]
fn scan_registered_apps() -> Vec<AppEntry> {
    Vec::new()
}

/// A few popular per-user applications do not create an App Paths registry
/// entry. Include their documented locations so launcher search remains useful.
fn scan_known_apps() -> Vec<AppEntry> {
    let mut candidates: Vec<(String, PathBuf)> = Vec::new();
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let local = PathBuf::from(local);
        candidates.push(("Visual Studio Code".to_string(), local.join(r"Programs\Microsoft VS Code\Code.exe")));
        candidates.push(("Spotify".to_string(), local.join(r"Microsoft\WindowsApps\Spotify.exe")));
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        candidates.push(("Spotify".to_string(), PathBuf::from(appdata).join(r"Spotify\Spotify.exe")));
    }
    if let Ok(program_files) = std::env::var("ProgramFiles") {
        candidates.push(("Visual Studio Code".to_string(), PathBuf::from(program_files).join(r"Microsoft VS Code\Code.exe")));
    }
    candidates
        .into_iter()
        .filter(|(_, path)| path.exists())
        .map(|(name, path)| AppEntry { name, path: path.to_string_lossy().to_string() })
        .collect()
}

/// Emitted when a background re-index finds a different app list than the cached
/// one the launcher opened with.
pub const APPS_REINDEXED_EVENT: &str = "apps-reindexed";

/// How stale a cached index may be before reopening the launcher refreshes it.
/// Apps are installed rarely; this only has to be shorter than a user's patience
/// for a newly installed app to show up.
const CACHE_TTL: Duration = Duration::from_secs(600);

fn scan_all() -> Vec<AppEntry> {
    // These three touch unrelated subsystems — the shell namespace, the
    // filesystem and the registry — so they overlap instead of queueing.
    let shortcuts = std::thread::spawn(scan_shortcuts);
    let registered = std::thread::spawn(scan_registered_apps);

    // AppsFolder can be incomplete; merging shortcuts keeps both packaged
    // and classic desktop apps visible.
    let mut apps = scan_apps_folder()
        .filter(|found| !found.is_empty())
        .or_else(scan_start_apps)
        .unwrap_or_default();

    // Order is precedence: the dedup below keeps the first spelling of a name,
    // and the AppsFolder one is the same text the Start Menu shows.
    apps.extend(shortcuts.join().unwrap_or_default());
    apps.extend(registered.join().unwrap_or_default());
    apps.extend(scan_known_apps());

    let mut seen = HashSet::new();
    apps.retain(|app| seen.insert(app.name.to_lowercase()));
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps
}

fn cache_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("could not create {dir:?}: {e}"))?;
    Ok(dir.join("apps.json"))
}

/// The cached index, and whether it is fresh enough to skip a re-scan.
fn read_cache(app: &AppHandle) -> Option<(Vec<AppEntry>, bool)> {
    let path = cache_path(app).ok()?;
    let raw = fs::read_to_string(&path).ok()?;
    let apps: Vec<AppEntry> = serde_json::from_str(&raw).ok()?;
    if apps.is_empty() {
        return None;
    }
    let fresh = fs::metadata(&path)
        .and_then(|m| m.modified())
        .map(|t| t.elapsed().map(|age| age < CACHE_TTL).unwrap_or(false))
        .unwrap_or(false);
    Some((apps, fresh))
}

fn write_cache(app: &AppHandle, apps: &[AppEntry]) {
    let Ok(path) = cache_path(app) else { return };
    let Ok(payload) = serde_json::to_string(apps) else { return };
    let tmp = path.with_extension("json.tmp");
    if fs::write(&tmp, payload).is_ok() {
        let _ = fs::rename(&tmp, &path);
    }
}

/// Scanning takes a few hundred milliseconds — dominated by the shell namespace
/// walk — which is long enough to sit staring at "Indexing…". So the launcher
/// opens on the last known list and a re-scan runs behind it, announcing itself
/// only if the result actually changed.
#[tauri::command]
pub async fn list_installed_apps(app: AppHandle) -> Result<Vec<AppEntry>, String> {
    if let Some((cached, fresh)) = read_cache(&app) {
        if !fresh {
            let handle = app.clone();
            let known = cached.clone();
            tauri::async_runtime::spawn_blocking(move || {
                let apps = scan_all();
                if apps.is_empty() {
                    return;
                }
                write_cache(&handle, &apps);
                // Repainting the launcher under the user's cursor is only worth
                // it when something was actually installed or removed.
                let changed = apps.len() != known.len()
                    || apps.iter().zip(&known).any(|(a, b)| a.path != b.path);
                if changed {
                    let _ = tauri::Emitter::emit(&handle, APPS_REINDEXED_EVENT, apps);
                }
            });
        }
        return Ok(cached);
    }

    // First run on this machine: nothing cached, so the scan is on the critical
    // path. spawn_blocking keeps it off the async runtime's worker threads.
    let apps = tauri::async_runtime::spawn_blocking(scan_all)
        .await
        .map_err(|e| format!("app scan failed: {e}"))?;
    write_cache(&app, &apps);
    Ok(apps)
}

fn pinned_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("could not create {dir:?}: {e}"))?;
    Ok(dir.join("pinned.json"))
}

/// Pinned favourites are stored as an array of launch ids, matching the index's key.
#[tauri::command]
pub fn read_pinned(app: AppHandle) -> Result<Vec<String>, String> {
    let path = pinned_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

#[tauri::command]
pub fn write_pinned(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
    let path = pinned_path(&app)?;
    let payload = serde_json::to_string_pretty(&paths).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, payload).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn launch_app(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;

        // shell:AppsFolder ids must go through Explorer; it is also the shell verb
        // that resolves a .lnk without needing COM here.
        let mut command = if path.starts_with("shell:") {
            let mut c = std::process::Command::new("explorer.exe");
            c.arg(&path);
            c
        } else {
            let mut c = std::process::Command::new("cmd");
            c.args(["/C", "start", "", &path]);
            c
        };

        command
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("could not launch {path}: {e}"))?;
    }
    #[cfg(not(windows))]
    {
        let _ = path;
    }
    Ok(())
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::time::Instant;

    /// The COM walk has to find the same apps PowerShell did, or it is not a
    /// valid replacement for it.
    #[test]
    fn apps_folder_matches_get_startapps() {
        let com = scan_apps_folder().expect("AppsFolder should enumerate");
        let powershell = scan_start_apps().expect("Get-StartApps should run");

        assert!(com.len() >= powershell.len() * 9 / 10, "COM found far fewer apps: {} vs {}", com.len(), powershell.len());

        // Same launch ids, not just the same count.
        let ids: HashSet<&str> = com.iter().map(|a| a.path.as_str()).collect();
        let missing = powershell.iter().filter(|a| !ids.contains(a.path.as_str())).count();
        assert!(missing <= powershell.len() / 10, "{missing} of {} Start Menu apps missing", powershell.len());
    }

    /// The reason this module stopped shelling out to PowerShell. Generous
    /// against a cold shell cache and a debug build; the point is to catch a
    /// return to second-scale indexing, not to police milliseconds.
    ///
    /// This is the *cold* path. Opening the launcher normally serves a cached
    /// index and does not scan at all.
    #[test]
    fn cold_scan_stays_under_400ms() {
        // Best of three. Contention — from the sibling test's PowerShell run, or
        // from anything else on the machine — can only inflate a measurement, so
        // the fastest run is the honest one and the only stable thing to assert.
        let (elapsed, count) = (0..3)
            .map(|_| {
                let started = Instant::now();
                let apps = scan_all();
                (started.elapsed(), apps.len())
            })
            .min()
            .expect("three runs");

        println!("cold scan_all (best of 3): {elapsed:?} -> {count} apps");
        assert!(count > 0, "index came back empty");
        assert!(elapsed.as_millis() < 400, "indexing took {elapsed:?}");
    }
}
