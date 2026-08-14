//! Starting with Windows, promptly.
//!
//! `tauri-plugin-autostart` writes `HKCU\…\CurrentVersion\Run`, which works and
//! is the obvious mechanism — and on a real machine it made Crest appear about
//! five minutes after login. Nothing about Crest is slow. The Run key is a
//! *queue*: Explorer applies a startup delay (10s by default, and there is no
//! `StartupDelayInMSec` override on most machines) and then walks the entries
//! with a stagger between each. On the machine this was diagnosed on, Crest was
//! tenth in that queue, behind Docker Desktop, Steam, the Epic launcher, the Riot
//! client and Google Drive — all of which are doing heavy disk I/O at exactly
//! that moment. Nothing an app can do to itself will move it up that list.
//!
//! A **logon-triggered scheduled task** is not in that list at all. Task Scheduler
//! starts it independently of Explorer's serialised startup walk, so it runs
//! alongside the queue rather than at the end of it.
//!
//! Three settings in the task XML are load-bearing, and the defaults for all
//! three are wrong for this:
//!
//!  - `DisallowStartIfOnBatteries` defaults to **true**. On a laptop — which is
//!    the machine a notch is for — that means the app silently never starts
//!    unless it is plugged in. This is the single most common way a scheduled
//!    task "does not work".
//!  - `Delay` on the logon trigger, set to zero. Task Scheduler has no default
//!    delay, but being explicit is what stops a future edit from adding one.
//!  - `Priority` defaults to **7**, which is `BELOW_NORMAL_PRIORITY_CLASS`. At 5
//!    the process starts at normal priority and is not competing at a handicap
//!    with everything else waking up.
//!
//! The task runs `LeastPrivilege` / `InteractiveToken`, so there is no elevation
//! and no UAC prompt — creating it needs no admin rights either, which is the
//! whole reason this is viable (verified: `schtasks /Create` succeeds unelevated
//! for a task scoped to the current user).
//!
//! `schtasks.exe` rather than the Task Scheduler COM API: this is four calls
//! against a documented, stable CLI, versus a COM apartment and a dozen
//! interfaces to do the same thing. The Run key stays as the fallback for the
//! case where `schtasks` is unavailable or refuses.

use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

/// The task's name in the scheduler. Bare rather than in a folder — a folder
/// would need creating first, and one task does not need a namespace.
const TASK_NAME: &str = "Crest";

/// Do not flash a console window. Every `schtasks` call here is silent, and
/// without this each one blinks a black rectangle onto the desktop.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(windows)]
fn schtasks(args: &[&str]) -> Result<std::process::Output, String> {
    use std::os::windows::process::CommandExt;

    Command::new("schtasks.exe")
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("couldn't run schtasks: {e}"))
}

#[cfg(not(windows))]
fn schtasks(_args: &[&str]) -> Result<std::process::Output, String> {
    Err("scheduled tasks are Windows-only".into())
}

/// `DOMAIN\user`, which is what both the trigger and the principal want.
///
/// From the environment rather than `GetUserNameExW`: these two variables are set
/// by the shell for every interactive logon, which is the only situation this
/// code runs in, and the alternative is a WinAPI call plus a buffer dance to
/// learn something already sitting in the process block.
fn current_user() -> String {
    let user = std::env::var("USERNAME").unwrap_or_default();
    match std::env::var("USERDOMAIN") {
        Ok(domain) if !domain.is_empty() => format!("{domain}\\{user}"),
        _ => user,
    }
}

/// XML text escaping. Paths with `&` in them are rare and not impossible.
fn escape(raw: &str) -> String {
    raw.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn task_xml(exe: &Path) -> String {
    let user = escape(&current_user());
    let command = escape(&exe.to_string_lossy());

    // `StartWhenAvailable` covers a logon the scheduler missed — a machine
    // resuming from hibernation into a session, most often. `IgnoreNew` because
    // the app already enforces a single instance with a named mutex; without it
    // a second logon trigger would spawn a process that immediately exits.
    format!(
        r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Starts Crest when you sign in.</Description>
    <URI>\{TASK_NAME}</URI>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>{user}</UserId>
      <Delay>PT0S</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>{user}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>5</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{command}</Command>
    </Exec>
  </Actions>
</Task>
"#
    )
}

/// Write the XML where `schtasks /XML` can read it.
///
/// **UTF-16LE with a BOM.** `schtasks` rejects UTF-8 without one and produces a
/// singularly unhelpful "The task XML is malformed" for the trouble.
fn write_xml(xml: &str) -> Result<PathBuf, String> {
    let path = std::env::temp_dir().join("crest-autostart.xml");

    let mut bytes = vec![0xFF, 0xFE];
    for unit in xml.encode_utf16() {
        bytes.extend_from_slice(&unit.to_le_bytes());
    }

    std::fs::write(&path, bytes).map_err(|e| format!("couldn't stage the task: {e}"))?;
    Ok(path)
}

/// Whether the scheduled task is registered.
pub fn task_exists() -> bool {
    schtasks(&["/Query", "/TN", TASK_NAME])
        .map(|out| out.status.success())
        .unwrap_or(false)
}

fn create_task() -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| format!("couldn't find the app: {e}"))?;
    let path = write_xml(&task_xml(&exe))?;

    let result = schtasks(&["/Create", "/TN", TASK_NAME, "/XML", &path.to_string_lossy(), "/F"])
        .and_then(|out| {
            if out.status.success() {
                Ok(())
            } else {
                // `schtasks` writes its reason to stdout, not stderr.
                let reason = String::from_utf8_lossy(&out.stdout);
                Err(format!("schtasks refused: {}", reason.trim()))
            }
        });

    // Best effort — the file is in the temp dir and holds nothing sensitive, but
    // leaving litter behind for every toggle is untidy.
    let _ = std::fs::remove_file(&path);
    result
}

fn delete_task() -> Result<(), String> {
    let out = schtasks(&["/Delete", "/TN", TASK_NAME, "/F"])?;
    // A task that was not there is the state we wanted, not a failure.
    if out.status.success() || !task_exists() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stdout).trim().to_string())
    }
}

/// Whether Crest starts with Windows, by either mechanism.
///
/// The Run key is still consulted so that an install which fell back to it — or
/// one that has not been migrated yet — reports honestly.
pub fn is_enabled(app: &AppHandle) -> bool {
    task_exists() || app.autolaunch().is_enabled().unwrap_or(false)
}

/// Turn startup on or off, and report the state actually reached.
///
/// Falls back to the Run key if the task cannot be created, because a slow start
/// is worth more than no start. Turning it *off* always clears both, so a machine
/// that once fell back does not keep launching from the leftover.
pub fn set_enabled(app: &AppHandle, enabled: bool) -> bool {
    if !enabled {
        let _ = delete_task();
        let _ = app.autolaunch().disable();
        return is_enabled(app);
    }

    match create_task() {
        Ok(()) => {
            // Both would launch the app twice. The named mutex in `lib.rs` means
            // the second one exits immediately rather than doing damage, but it
            // is still a process spawn during the busiest minute of the boot.
            let _ = app.autolaunch().disable();
            true
        }
        Err(_) => app.autolaunch().enable().is_ok(),
    }
}

/// Move an existing install onto the scheduled task, once.
///
/// Called at startup. Three cases, and the third is the one that needs the flag:
///
///  - **The task already exists.** Nothing to do.
///  - **A Run-key entry exists.** That is either a previous version of Crest or a
///    fallback; migrate it and delete the key.
///  - **Neither.** Ambiguous, and guessing wrong is bad in both directions: on a
///    fresh install startup should be on (it always has been), but for a user who
///    deliberately turned it off, enabling it here would undo that on every
///    launch — which is exactly the bug the old `setup` had, where
///    `autolaunch().enable()` ran unconditionally and quietly reversed the tray
///    toggle every time. `configured` tells the two apart.
///
/// Returns whether the caller should record that startup has now been configured.
pub fn migrate(app: &AppHandle, configured: bool) -> bool {
    if task_exists() {
        // A leftover Run entry alongside the task would spawn a doomed second
        // process every login.
        let _ = app.autolaunch().disable();
        return true;
    }

    let had_run_key = app.autolaunch().is_enabled().unwrap_or(false);
    if had_run_key || !configured {
        set_enabled(app, true);
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Register the real XML this module generates, then take it away again.
    ///
    /// The XML is a string built by `format!`, so nothing about it is checked at
    /// compile time — a stray tag or a schema field in the wrong order is a
    /// runtime "The task XML is malformed" that would only show up on a user's
    /// machine, at the one moment they cannot see it. This is the cheapest place
    /// to find that out.
    ///
    /// Uses a throwaway task name so a developer's real startup entry is never
    /// touched, and asserts the three settings that are wrong by default —
    /// batteries above all, which is how a scheduled task silently never runs on
    /// a laptop.
    #[test]
    fn generates_xml_the_scheduler_accepts() {
        const PROBE: &str = "CrestAutostartTest";

        let xml = task_xml(Path::new(r"C:\Windows\System32\cmd.exe"));
        assert!(xml.contains("<DisallowStartIfOnBatteries>false<"));
        assert!(xml.contains("<Delay>PT0S</Delay>"));
        assert!(xml.contains("<Priority>5</Priority>"));

        let staged = write_xml(&xml).expect("stage the xml");
        // UTF-16LE BOM. `schtasks` rejects the file outright without it.
        let bytes = std::fs::read(&staged).expect("read back");
        assert_eq!(&bytes[..2], &[0xFF, 0xFE]);

        let created = schtasks(&[
            "/Create",
            "/TN",
            PROBE,
            "/XML",
            &staged.to_string_lossy(),
            "/F",
        ])
        .expect("run schtasks");

        let stdout = String::from_utf8_lossy(&created.stdout).trim().to_string();
        println!("create: {stdout}");

        let _ = std::fs::remove_file(&staged);
        let _ = schtasks(&["/Delete", "/TN", PROBE, "/F"]);

        assert!(created.status.success(), "schtasks rejected the XML: {stdout}");
    }

    #[test]
    fn escapes_paths_that_would_break_the_xml() {
        let xml = task_xml(Path::new(r"C:\Tools\A & B\app.exe"));
        assert!(xml.contains(r"C:\Tools\A &amp; B\app.exe"));
    }
}
