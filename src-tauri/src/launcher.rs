use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// Quick Launcher app index.
///
/// Primary source is `Get-StartApps`, which returns exactly what the Start Menu
/// shows — both classic Win32 shortcuts and Store/UWP apps — each with a launchable
/// AppID. A .lnk directory scan was the obvious first approach and is wrong on its
/// own: Store apps (Spotify, Arc, Terminal, most of the modern surface) have no
/// shortcut file anywhere, so they are simply invisible to it.
///
/// The .lnk walk is kept as a fallback for when PowerShell cannot be run.

#[derive(Serialize, Clone)]
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

fn is_noise(name: &str) -> bool {
    let lower = name.to_lowercase();
    NOISE.iter().any(|n| lower.contains(n))
}

/// Ask the shell for the Start Menu's own app list.
#[cfg(windows)]
fn scan_start_apps() -> Option<Vec<AppEntry>> {
    use std::os::windows::process::CommandExt;

    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;

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

#[tauri::command]
pub fn list_installed_apps() -> Result<Vec<AppEntry>, String> {
    let mut apps = scan_start_apps().unwrap_or_else(scan_shortcuts);

    let mut seen = HashSet::new();
    apps.retain(|app| seen.insert(app.name.to_lowercase()));
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
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
