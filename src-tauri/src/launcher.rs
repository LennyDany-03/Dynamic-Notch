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
#[cfg(windows)]
const START_APPS_TIMEOUT: Duration = Duration::from_secs(5);

fn is_noise(name: &str) -> bool {
    let lower = name.to_lowercase();
    NOISE.iter().any(|n| lower.contains(n))
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

#[tauri::command]
pub fn list_installed_apps() -> Result<Vec<AppEntry>, String> {
    // Get-StartApps can be incomplete; merging shortcuts keeps both packaged
    // and classic desktop apps visible.
    let mut apps = scan_start_apps().unwrap_or_default();
    apps.extend(scan_shortcuts());
    apps.extend(scan_registered_apps());
    apps.extend(scan_known_apps());

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
