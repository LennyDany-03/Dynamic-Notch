use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// Quick Launcher app index.
///
/// Start Menu shortcuts are the practical source: every installed app that wants
/// to be launchable puts a .lnk there, the entries already carry human-facing
/// names, and reading them needs no elevation. The registry uninstall keys are a
/// worse index — they list uninstallers and redistributables, not launch targets.

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppEntry {
    pub name: String,
    pub path: String,
}

/// Deepest we walk into a Start Menu tree. Vendors nest a folder or two at most;
/// anything deeper is almost always docs and uninstallers.
const MAX_DEPTH: usize = 4;

/// Entries that are shortcuts to something other than an app.
const NOISE: [&str; 6] = [
    "uninstall",
    "readme",
    "release notes",
    "documentation",
    "help",
    "website",
];

fn start_menu_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    // All-users and per-user Start Menus. Both are ordinary readable directories.
    if let Ok(program_data) = std::env::var("ProgramData") {
        dirs.push(PathBuf::from(program_data).join(r"Microsoft\Windows\Start Menu\Programs"));
    }
    if let Ok(app_data) = std::env::var("APPDATA") {
        dirs.push(PathBuf::from(app_data).join(r"Microsoft\Windows\Start Menu\Programs"));
    }
    dirs
}

fn is_noise(name: &str) -> bool {
    let lower = name.to_lowercase();
    NOISE.iter().any(|n| lower.contains(n))
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

#[tauri::command]
pub fn list_installed_apps() -> Result<Vec<AppEntry>, String> {
    let mut apps = Vec::new();
    for dir in start_menu_dirs() {
        if dir.exists() {
            walk(&dir, 0, &mut apps);
        }
    }

    // The same app usually appears in both Start Menus; keep one per name.
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

/// Pinned favourites are stored as an array of shortcut paths, matching the
/// launcher index's key.
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
    // Resolving a .lnk properly means COM (IShellLink); handing it to the shell
    // does the same job and also covers .exe and .url targets.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;

        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
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
