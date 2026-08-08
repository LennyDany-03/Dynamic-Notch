//! Windows' notification centre, read and — optionally — silenced.
//!
//! Two halves that only make sense together. `UserNotificationListener` is how
//! the notch learns what arrived, and the registry half is how the user stops
//! Windows drawing its own banner in the corner for the same thing. Muting the
//! shell while the listener is denied would mean no notification anywhere, so
//! `settings.rs` refuses that combination and this module gives it the access
//! check to refuse it with.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Manager};
use windows::UI::Notifications::Management::{
    UserNotificationListener, UserNotificationListenerAccessStatus,
};
use windows::UI::Notifications::NotificationKinds;
use winreg::enums::HKEY_CURRENT_USER;
use winreg::RegKey;

/// Where the shell keeps the notification switches that Settings > System >
/// Notifications draws. Each app that has ever raised a toast has a subkey here,
/// named by its AUMID.
const NOTIFICATION_SETTINGS_KEY: &str =
    r"SOFTWARE\Microsoft\Windows\CurrentVersion\Notifications\Settings";

/// The global "show banners" value.
///
/// Written for the builds that honour it and no more than that: Windows 11
/// 26200 leaves it at `0` and keeps drawing banners regardless, which is why the
/// per-app value below is the one doing the work. Kept because it costs one
/// write and covers apps that register after a sweep on the builds where it does
/// take effect.
const GLOBAL_BANNERS_VALUE: &str = "NOC_GLOBAL_SETTING_TOASTS_ENABLED";

/// Per-app "Show notification banners" — the checkbox under Settings > System >
/// Notifications > *app*. This is the one the shell reads for each notification
/// as it arrives, so it takes effect immediately and without a sign-out.
///
/// Deliberately not `Enabled`, the per-app master, and not
/// `PushNotifications\ToastEnabled`, the global one: both stop delivery
/// altogether, so the notification would never reach the notification centre and
/// the notch would have nothing to show either. `ShowBanner` suppresses only the
/// corner pop-up and leaves the notification itself intact, which is the whole
/// trade the user is making — the same notification, drawn somewhere else.
const APP_BANNER_VALUE: &str = "ShowBanner";

/// Milliseconds between the FILETIME epoch (1601-01-01) that WinRT's `DateTime`
/// counts from and the Unix epoch that `Date` in the webview does.
const FILETIME_TO_UNIX_MS: i64 = 11_644_473_600_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WinNotification {
    pub id: String,
    pub app: String,
    /// AUMID of the raising app — the same string as its subkey under
    /// `NOTIFICATION_SETTINGS_KEY`, which is how a banner gets silenced for an
    /// app that only showed up after the last sweep.
    pub app_id: String,
    pub message: String,
    /// When Windows recorded it, in Unix milliseconds; `0` when it will not say.
    ///
    /// This was the string `"now"` for every entry, which was true of the only
    /// caller at the time — a banner announcing an arrival. The notifications
    /// module lists what is already in the centre, where an hour-old message
    /// labelled "now" is worse than no label, and it is the only ordering
    /// available: `GetNotificationsAsync` does not specify one.
    pub timestamp: i64,
    pub unread: bool,
}

/// What the shell's banner settings were before Crest touched them, so turning
/// the preference off puts every one of them back exactly as it was.
///
/// Its own file rather than a field in `settings.json`: this is a record of
/// changes made outside the app, it is the size of the user's installed
/// software, and nothing in the settings window has any business reading it.
#[derive(Default, Serialize, Deserialize, Clone)]
struct BannerMemo {
    /// The global value, if we were the ones to change it.
    global: Option<u32>,
    /// AUMID → its `ShowBanner` before we wrote `0`. `None` means the value was
    /// absent, and restoring means deleting it again rather than writing `1`.
    apps: HashMap<String, Option<u32>>,
}

static MEMO_PATH: OnceLock<PathBuf> = OnceLock::new();
static MEMO: OnceLock<Mutex<BannerMemo>> = OnceLock::new();

/// Whether banners are currently being suppressed, read on the notification poll
/// so an app that registers later can be caught the moment it first notifies.
static MUTED: AtomicBool = AtomicBool::new(false);

fn memo() -> &'static Mutex<BannerMemo> {
    MEMO.get_or_init(|| Mutex::new(BannerMemo::default()))
}

fn save_memo(current: &BannerMemo) {
    let Some(path) = MEMO_PATH.get() else { return };
    let Ok(payload) = serde_json::to_string_pretty(current) else {
        return;
    };
    // Write-then-rename, as everywhere else here: a half-written memo is a set of
    // settings that can never be given back.
    let tmp = path.with_extension("json.tmp");
    if fs::write(&tmp, payload).is_ok() {
        let _ = fs::rename(&tmp, path);
    }
}

/// Seed the memo from disk. Startup only, before any preference is applied.
pub fn init(app: &AppHandle) {
    if let Ok(dir) = app.path().app_data_dir() {
        let _ = fs::create_dir_all(&dir);
        let _ = MEMO_PATH.set(dir.join("notification-banners.json"));
    }

    let stored = MEMO_PATH
        .get()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str(raw.trim_start_matches('\u{feff}')).ok())
        .unwrap_or_default();
    let _ = MEMO.set(Mutex::new(stored));
}

fn settings_key() -> Option<RegKey> {
    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(NOTIFICATION_SETTINGS_KEY)
        .ok()
}

/// Every app that has registered for notifications, by AUMID.
fn known_apps() -> Vec<String> {
    settings_key()
        .map(|key| key.enum_keys().flatten().collect())
        .unwrap_or_default()
}

fn app_banner(aumid: &str) -> Option<u32> {
    settings_key()?
        .open_subkey(aumid)
        .ok()?
        .get_value::<u32, _>(APP_BANNER_VALUE)
        .ok()
}

/// Write, or with `None` delete, one app's banner value. Deleting is how a value
/// that was absent before Crest ran gets put back the way the shell expects it.
fn set_app_banner(aumid: &str, value: Option<u32>) -> Result<(), String> {
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey(format!("{NOTIFICATION_SETTINGS_KEY}\\{aumid}"))
        .map_err(|e| format!("could not open the notification key for {aumid}: {e}"))?;

    match value {
        Some(value) => key
            .set_value(APP_BANNER_VALUE, &value)
            .map_err(|e| format!("could not write the banner setting for {aumid}: {e}")),
        None => {
            let _ = key.delete_value(APP_BANNER_VALUE);
            Ok(())
        }
    }
}

fn global_banners() -> Option<u32> {
    settings_key()?
        .get_value::<u32, _>(GLOBAL_BANNERS_VALUE)
        .ok()
}

fn set_global_banners(value: u32) -> Result<(), String> {
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey(NOTIFICATION_SETTINGS_KEY)
        .map_err(|e| format!("could not open the notification settings key: {e}"))?;
    key.set_value(GLOBAL_BANNERS_VALUE, &value)
        .map_err(|e| format!("could not write the notification banner setting: {e}"))
}

/// Silence one app's banner, remembering what it was first.
///
/// An app already set to `0` is left out of the memo entirely: the user turned
/// that one off themselves, and giving it back later would be handing them a
/// setting they never had.
fn mute_app(memo: &mut BannerMemo, aumid: &str) -> bool {
    if memo.apps.contains_key(aumid) {
        return false;
    }
    let previous = app_banner(aumid);
    if previous == Some(0) {
        return false;
    }
    if set_app_banner(aumid, Some(0)).is_err() {
        return false;
    }
    memo.apps.insert(aumid.to_string(), previous);
    true
}

pub fn is_muted() -> bool {
    MUTED.load(Ordering::Relaxed)
}

/// Suppress — or give back — Windows' own notification banners.
///
/// Muting is a sweep over every app the shell knows about, because there is no
/// working global switch on current builds. Unmuting is the memo played back, so
/// a user who had already turned some app's banner off keeps it off.
pub fn set_muted(muted: bool) -> Result<(), String> {
    let mut memo = memo().lock().unwrap_or_else(|e| e.into_inner());

    if muted {
        if memo.global.is_none() {
            let global = global_banners().unwrap_or(1);
            if global != 0 {
                memo.global = Some(global);
                let _ = set_global_banners(0);
            }
        }
        for aumid in known_apps() {
            mute_app(&mut memo, &aumid);
        }
    } else {
        if let Some(global) = memo.global.take() {
            let _ = set_global_banners(global);
        }
        for (aumid, previous) in std::mem::take(&mut memo.apps) {
            let _ = set_app_banner(&aumid, previous);
        }
    }

    save_memo(&memo);
    MUTED.store(muted, Ordering::Relaxed);
    Ok(())
}

/// Catch an app that registered after the last sweep, at the first notification
/// it raises. Its first banner is already on screen by then — there is nothing
/// to be done about that one — but it is the only one.
fn mute_app_on_sight(aumid: &str) {
    if aumid.is_empty() || !is_muted() {
        return;
    }
    let mut memo = memo().lock().unwrap_or_else(|e| e.into_inner());
    if memo.apps.contains_key(aumid) {
        return;
    }
    if mute_app(&mut memo, aumid) {
        save_memo(&memo);
    }
}

fn listener() -> Result<UserNotificationListener, String> {
    UserNotificationListener::Current().map_err(|e| format!("no notification listener: {e}"))
}

/// Whether Windows will let this app read the notification centre.
///
/// Gated by "Let apps access your notifications" in Privacy settings, which the
/// user can revoke at any time — so this is checked where it matters rather than
/// cached at startup.
pub fn access_allowed() -> bool {
    listener()
        .and_then(|l| l.GetAccessStatus().map_err(|e| e.to_string()))
        .map(|status| status == UserNotificationListenerAccessStatus::Allowed)
        .unwrap_or(false)
}

/// Ask for access once, at startup.
///
/// Separated from reading because the read runs on a poll: a request per poll
/// would be a WinRT round trip every couple of seconds for a permission that
/// only the user can change, and only ever from outside this app.
pub fn request_access() {
    let Ok(listener) = listener() else { return };
    let Ok(status) = listener.GetAccessStatus() else {
        return;
    };
    if status == UserNotificationListenerAccessStatus::Allowed {
        return;
    }
    if let Ok(request) = listener.RequestAccessAsync() {
        let _ = request.get();
    }
}

#[tauri::command]
pub async fn notifications_available() -> bool {
    access_allowed()
}

/// Logo of the app that raised a notification, as a complete
/// `data:image/png;base64,…` URI — the form `icons` returns and an `<img>`
/// renders as-is. Not bare base64: prefixing it a second time is a broken image.
///
/// Routed through the launcher's icon extraction, which asks the shell for the
/// icon of `shell:AppsFolder\<AUMID>` — the same picture Explorer draws in the
/// Start menu, and the same code path that already puts icons on launcher tiles.
///
/// The obvious WinRT route, `AppInfo.DisplayInfo.GetLogo`, is a trap.
/// `OpenReadAsync().get()` on the stream it hands back never completes on a
/// worker thread: the operation is created and simply never signalled, whatever
/// apartment the thread is initialised into, so every icon cost a three-second
/// timeout and arrived as `None`. It also cannot see unpackaged apps at all —
/// `GetFromAppUserModelId` returns "element not found" for anything installed
/// the ordinary way, which is most of what notifies you. The shell route has
/// neither problem and answers in about 200ms, cached thereafter.
///
/// Asked for per announced notification rather than returned with the poll: the
/// list is re-read every couple of seconds, and carrying an icon for every entry
/// in the notification centre would put tens of kilobytes of base64 across the
/// bridge each time, to draw one of them.
///
/// What no route reaches is the picture *inside* the toast — the contact photo
/// on a message. `NotificationBinding` exposes text elements and nothing else,
/// so the raising app's own logo is the identifying mark available to us.
#[tauri::command]
pub async fn notification_logo(app_id: String) -> Result<Option<String>, String> {
    if app_id.is_empty() {
        return Ok(None);
    }
    crate::icons::app_icon(format!("shell:AppsFolder\\{app_id}")).await
}

#[tauri::command]
pub async fn get_windows_notifications() -> Result<Vec<WinNotification>, String> {
    let listener = listener()?;

    // Fail fast rather than re-requesting: this is called on a poll, and access
    // is a system-wide privacy setting that nothing here can talk the user into.
    if !access_allowed() {
        return Err("Permission denied for Windows notifications".to_string());
    }

    let notifications = listener
        .GetNotificationsAsync(NotificationKinds::Toast)
        .map_err(|e| format!("Failed to get notifications: {}", e))?
        .get()
        .map_err(|e| format!("Failed to await notifications: {}", e))?;

    let mut result = Vec::new();
    for notification in notifications {
        let id = notification
            .Id()
            .map(|id| id.to_string())
            .unwrap_or_default();

        let app = notification
            .AppInfo()
            .and_then(|info| info.DisplayInfo())
            .and_then(|display| display.DisplayName())
            .map(|name| name.to_string())
            .unwrap_or_else(|_| "Unknown".to_string());

        let app_id = notification
            .AppInfo()
            .and_then(|info| info.AppUserModelId())
            .map(|id| id.to_string())
            .unwrap_or_default();

        // An app that was installed after the last sweep silences itself here,
        // one banner late, rather than at the next restart.
        mute_app_on_sight(&app_id);

        let mut message = String::new();
        if let Ok(toast_binding) = notification
            .Notification()
            .and_then(|n| n.Visual())
            .and_then(|v| {
                v.GetBinding(
                    &windows::UI::Notifications::KnownNotificationBindings::ToastGeneric()?,
                )
            })
        {
            if let Ok(text_elements) = toast_binding.GetTextElements() {
                let mut texts = Vec::new();
                for text in text_elements {
                    if let Ok(t) = text.Text() {
                        texts.push(t.to_string());
                    }
                }
                if texts.len() > 1 {
                    message = format!("{}: {}", texts[0], texts[1..].join(" "));
                } else if !texts.is_empty() {
                    message = texts[0].clone();
                }
            }
        }

        if message.is_empty() {
            continue;
        }

        // `UniversalTime` is 100-nanosecond intervals since 1601. A notification
        // whose time cannot be read still belongs in the list, so this falls back
        // to 0 and lets the frontend leave the timestamp off that one row.
        let timestamp = notification
            .CreationTime()
            .map(|time| time.UniversalTime / 10_000 - FILETIME_TO_UNIX_MS)
            .unwrap_or(0);

        result.push(WinNotification {
            id,
            app,
            app_id,
            message,
            timestamp,
            unread: true,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn dismiss_notification(id: u32) -> Result<(), String> {
    let listener = UserNotificationListener::Current()
        .map_err(|e| format!("Failed to get listener: {}", e))?;

    listener
        .RemoveNotification(id)
        .map_err(|e| format!("Failed to remove notification {}: {}", id, e))?;

    Ok(())
}

#[tauri::command]
pub async fn clear_all_notifications() -> Result<(), String> {
    let listener = UserNotificationListener::Current()
        .map_err(|e| format!("Failed to get listener: {}", e))?;

    let notifications = listener
        .GetNotificationsAsync(NotificationKinds::Toast)
        .map_err(|e| format!("Failed to get notifications: {}", e))?
        .get()
        .map_err(|e| format!("Failed to await notifications: {}", e))?;

    for notification in notifications {
        if let Ok(id) = notification.Id() {
            let _ = listener.RemoveNotification(id);
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Every notification in the centre must resolve to an icon, or the banner
    /// falls back to a bell and the feature looks broken. Guards the shell route
    /// specifically: the WinRT one this replaced returned nothing for unpackaged
    /// apps and hung for the rest.
    #[tokio::test]
    async fn every_notifying_app_has_a_logo() {
        let Ok(notifications) = get_windows_notifications().await else {
            println!("no notification access; nothing to check");
            return;
        };

        for notification in notifications.iter().take(6) {
            let started = std::time::Instant::now();
            let logo = notification_logo(notification.app_id.clone()).await;
            println!(
                "{} ({}) -> {:?} chars in {:?}",
                notification.app,
                notification.app_id,
                logo.as_ref().ok().and_then(|l| l.as_ref().map(|s| s.len())),
                started.elapsed(),
            );
            assert!(
                matches!(logo, Ok(Some(_))),
                "no logo for {}",
                notification.app_id
            );
        }
    }

    #[tokio::test]
    async fn test_get_notifications() {
        match get_windows_notifications().await {
            Ok(notifs) => {
                println!("SUCCESS: found {} notifications", notifs.len());
            }
            Err(e) => {
                println!("ERROR: {}", e);
            }
        }
    }
}
