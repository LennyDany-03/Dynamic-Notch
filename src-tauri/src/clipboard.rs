use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Clipboard history.
///
/// # Privacy
///
/// Capture is skipped entirely while a known password manager owns the foreground
/// window. That is the whole filter, and it is deliberate: the alternative —
/// pattern-matching clipboard *content* for things that "look like" credentials —
/// cannot work. A high-entropy string is indistinguishable from an API key, a
/// license key, or a git SHA that the user genuinely wants back, so it both leaks
/// real secrets and eats legitimate copies.
///
/// History is memory-only and dies with the process. Nothing is written to disk.
///
/// To exclude another app, add its executable name to `EXCLUDED_APPS`.

const POLL_INTERVAL: Duration = Duration::from_millis(700);
const MAX_ENTRIES: usize = 15;

/// Matched as a substring against the foreground process's executable name.
const EXCLUDED_APPS: [&str; 11] = [
    "keepass",
    "1password",
    "bitwarden",
    "lastpass",
    "dashlane",
    "keeper",
    "nordpass",
    "enpass",
    "protonpass",
    "roboform",
    "passwordsafe",
];

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardEntry {
    pub id: String,
    pub text: String,
    /// "link" or "text" — drives which glyph the row shows.
    pub kind: String,
    pub copied_at: u64,
}

static HISTORY: LazyLock<Mutex<Vec<ClipboardEntry>>> = LazyLock::new(|| Mutex::new(Vec::new()));
static NEXT_ID: AtomicU64 = AtomicU64::new(0);

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn classify(text: &str) -> &'static str {
    let trimmed = text.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        "link"
    } else {
        "text"
    }
}

/// Executable name of whatever currently owns the foreground window.
#[cfg(windows)]
fn foreground_process() -> Option<String> {
    use windows::Win32::Foundation::{CloseHandle, MAX_PATH};
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return None;
        }

        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;

        let mut buffer = [0u16; MAX_PATH as usize];
        let mut size = buffer.len() as u32;
        let ok = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            windows::core::PWSTR(buffer.as_mut_ptr()),
            &mut size,
        )
        .is_ok();
        let _ = CloseHandle(handle);

        if !ok {
            return None;
        }
        Some(String::from_utf16_lossy(&buffer[..size as usize]).to_lowercase())
    }
}

#[cfg(not(windows))]
fn foreground_process() -> Option<String> {
    None
}

fn foreground_is_excluded() -> bool {
    match foreground_process() {
        // Fail closed: if the owner cannot be identified, do not capture.
        None => true,
        Some(path) => EXCLUDED_APPS.iter().any(|app| path.contains(app)),
    }
}

fn record(text: String) {
    let Ok(mut history) = HISTORY.lock() else {
        return;
    };

    // Re-copying something already held promotes it instead of duplicating it.
    if let Some(index) = history.iter().position(|e| e.text == text) {
        let mut existing = history.remove(index);
        existing.copied_at = now_ms();
        history.insert(0, existing);
        return;
    }

    let entry = ClipboardEntry {
        // A timestamp alone collides when two copies land in the same millisecond,
        // and list position is not stable enough to key a React list on.
        id: format!("clip-{}", NEXT_ID.fetch_add(1, Ordering::Relaxed)),
        kind: classify(&text).to_string(),
        text,
        copied_at: now_ms(),
    };
    history.insert(0, entry);
    history.truncate(MAX_ENTRIES);
}

/// Polls rather than using `AddClipboardFormatListener`, which needs an HWND and a
/// message pump of its own. At this interval the cost is negligible and it avoids
/// threading a native window into Tauri's event loop.
pub fn start_listener() {
    std::thread::spawn(|| {
        let mut last = String::new();
        loop {
            std::thread::sleep(POLL_INTERVAL);

            let Ok(mut clipboard) = arboard::Clipboard::new() else {
                continue;
            };
            let Ok(text) = clipboard.get_text() else {
                continue;
            };

            if text.is_empty() || text == last {
                continue;
            }

            // Update the marker either way, so content copied out of an excluded
            // app is not captured later when focus moves elsewhere.
            last = text.clone();

            if foreground_is_excluded() {
                continue;
            }
            record(text);
        }
    });
}

#[tauri::command]
pub fn get_clipboard_history() -> Vec<ClipboardEntry> {
    HISTORY.lock().map(|h| h.clone()).unwrap_or_default()
}

#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_clipboard_history() {
    if let Ok(mut history) = HISTORY.lock() {
        history.clear();
    }
}
