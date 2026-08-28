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

/// The `TaskId` of the `windows.startupTask` extension in the MSIX manifest.
///
/// **Must match `extensions.startupTask.taskId` in
/// `src-tauri/gen/windows/bundle.config.json`.** It is the only handle the
/// package gives us onto that entry — `StartupTask::GetAsync` takes this string
/// and fails for any other — so the two are one value in two files and there is
/// nothing at compile time that would notice them drifting apart.
#[cfg(windows)]
const MSIX_TASK_ID: &str = "CrestStartupTask";

/// Whether this process is running from an MSIX package.
///
/// The Store build and the NSIS build are the same binary compiled the same way,
/// so this is asked at runtime rather than behind a Cargo feature. That is
/// deliberate and it is the safer half of the choice: a feature flag decides at
/// *build* time which mechanism is compiled in, and a release built with the
/// wrong flag is a Crest that either never starts with Windows or writes a
/// scheduled task from inside a package — both of which look fine until a user
/// logs in. Asking Windows what we are cannot be got wrong by a build script.
///
/// `GetCurrentPackageFullName` is the documented test: it answers
/// `APPMODEL_ERROR_NO_PACKAGE` for an unpackaged process and a length for a
/// packaged one. Cached because the answer cannot change while the process lives
/// and every caller is on a path that runs more than once.
#[cfg(windows)]
pub fn is_packaged() -> bool {
    use std::sync::OnceLock;
    use windows::core::PWSTR;
    use windows::Win32::Foundation::ERROR_INSUFFICIENT_BUFFER;
    use windows::Win32::Storage::Packaging::Appx::GetCurrentPackageFullName;

    static PACKAGED: OnceLock<bool> = OnceLock::new();
    *PACKAGED.get_or_init(|| {
        let mut len: u32 = 0;
        // Length-query form: with a null buffer a packaged process answers
        // ERROR_INSUFFICIENT_BUFFER and sets `len`, so there is no allocation to
        // do and no name to parse — the error code *is* the answer.
        let result = unsafe { GetCurrentPackageFullName(&mut len, PWSTR::null()) };
        result == ERROR_INSUFFICIENT_BUFFER
    })
}

#[cfg(not(windows))]
pub fn is_packaged() -> bool {
    false
}

/// Read the package's startup task, if there is one.
///
/// Returns `None` for anything that is not a plain readable state — an
/// unpackaged process, a manifest without the extension, a call that never
/// completes. Every caller treats that as "startup is off", which is the safe
/// side: reporting it on when it is not puts a switch on screen that lies.
#[cfg(windows)]
fn msix_task() -> Option<windows::ApplicationModel::StartupTask> {
    use std::time::Duration;
    use windows::core::HSTRING;
    use windows::ApplicationModel::StartupTask;

    let op = StartupTask::GetAsync(&HSTRING::from(MSIX_TASK_ID)).ok()?;
    crate::system::await_op(op, Duration::from_secs(2))
}

/// Whether the package's startup task is on.
///
/// `EnabledByPolicy` counts as on: an administrator has forced it, the app
/// cannot turn it off, and a switch reading "off" next to an app that starts
/// anyway is the worse of the two lies.
#[cfg(windows)]
fn msix_is_enabled() -> bool {
    use windows::ApplicationModel::StartupTaskState;

    matches!(
        msix_task().and_then(|task| task.State().ok()),
        Some(StartupTaskState::Enabled) | Some(StartupTaskState::EnabledByPolicy)
    )
}

/// Turn the package's startup task on or off, and report the state reached.
///
/// **`DisabledByUser` cannot be undone from here, and that is Windows' rule, not
/// a gap in this code.** Once someone switches Crest off in Task Manager's
/// Startup tab, `RequestEnableAsync` returns that same state and changes
/// nothing — the setting is deliberately out of the app's reach so an app cannot
/// re-enable itself behind the user's back. Returning the real state is what
/// makes the tray switch snap back instead of showing an on that never took,
/// which is the contract `set_enabled` already has for the scheduled-task path.
#[cfg(windows)]
fn msix_set_enabled(enabled: bool) -> bool {
    use std::time::Duration;
    use windows::ApplicationModel::StartupTaskState;

    let Some(task) = msix_task() else {
        return false;
    };

    if !enabled {
        let _ = task.Disable();
        return msix_is_enabled();
    }

    let Ok(op) = task.RequestEnableAsync() else {
        return false;
    };
    matches!(
        crate::system::await_op(op, Duration::from_secs(5)),
        Some(StartupTaskState::Enabled) | Some(StartupTaskState::EnabledByPolicy)
    )
}

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

/// Whether this binary is one that should be allowed to enrol itself in startup.
///
/// A build run out of the source tree must not, and the reason is a bug that
/// took a login to notice. `create_task` records `current_exe()`, and under
/// `npm run tauri dev` that is `target\debug\…exe` — a binary that loads Vite's
/// dev server instead of the bundled frontend and, since `windows_subsystem`
/// applies only to release, opens a console window. Registered once it outlives
/// the dev session entirely: `task_exists()` is true from then on, so `migrate`
/// never repoints it and installing the real app changes nothing. Every login
/// afterwards brought up a console and a webview reading "localhost refused to
/// connect". Running `tauri dev` is not a request to start with Windows.
///
/// `tauri build` leaves a *release* binary in that same tree, and running it to
/// try it out is no more a request than the other, so the path is checked too.
fn is_installed_build(exe: &Path) -> bool {
    if cfg!(debug_assertions) {
        return false;
    }
    let path = exe.to_string_lossy().to_lowercase();
    !(path.contains(r"\target\debug\") || path.contains(r"\target\release\"))
}

/// The same question about the binary currently running.
///
/// Lives here rather than in the one other module that asks it, because the rule
/// is one rule: what counts as an *installed* Crest is a property of this file's
/// argument, and a second copy of the path test somewhere else is a second answer
/// that can drift. The updater is the other caller — see `updater::auto_update_allowed`
/// for why enrolling a source-tree build in silent updates is the same mistake as
/// enrolling one in startup, only louder.
///
/// A `current_exe()` that cannot be read answers *not* installed: every use of this
/// gates something that reaches outside the app, and the safe side of an unknown
/// path is to leave the machine alone.
pub fn running_installed_build() -> bool {
    std::env::current_exe()
        .map(|exe| is_installed_build(&exe))
        .unwrap_or(false)
}

/// Decode `schtasks` output, which is UTF-16 on some machines and the console
/// codepage on others.
///
/// The BOM is the reliable half; the NUL in the second byte covers output that
/// arrives without one, since every character this command emits before the
/// first newline is ASCII.
fn decode(bytes: &[u8]) -> String {
    let utf16 = bytes.len() >= 2 && (bytes[..2] == [0xFF, 0xFE] || bytes[1] == 0);
    if utf16 {
        let units: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect();
        // The BOM decodes to a zero-width space rather than vanishing, and a
        // stray one at the front of the haystack is a trap for the next reader.
        String::from_utf16_lossy(&units)
            .trim_start_matches('\u{FEFF}')
            .to_owned()
    } else {
        String::from_utf8_lossy(bytes).into_owned()
    }
}

/// Whether the registered task launches `exe`.
///
/// A substring test rather than an XML parse: the only question ever asked is
/// "does the task point at me?", and the answer does not need the document.
fn task_targets(exe: &Path) -> bool {
    let Ok(out) = schtasks(&["/Query", "/TN", TASK_NAME, "/XML"]) else {
        return false;
    };
    if !out.status.success() {
        return false;
    }
    // Windows paths are case-insensitive, and the scheduler echoes back whatever
    // case it was given.
    decode(&out.stdout)
        .to_lowercase()
        .contains(&exe.to_string_lossy().to_lowercase())
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
    // A packaged build has neither of the other two and must not be asked about
    // them: `schtasks /Query` from inside a package answers about the *machine's*
    // task store, so a leftover "Crest" task from a previous NSIS install on the
    // same machine would report the Store build as starting with Windows when it
    // is the uninstalled one that would start.
    #[cfg(windows)]
    if is_packaged() {
        return msix_is_enabled();
    }

    task_exists() || app.autolaunch().is_enabled().unwrap_or(false)
}

/// Turn startup on or off, and report the state actually reached.
///
/// Falls back to the Run key if the task cannot be created, because a slow start
/// is worth more than no start. Turning it *off* always clears both, so a machine
/// that once fell back does not keep launching from the leftover.
///
/// Turning it *on* is refused outright for a build run out of the source tree —
/// see `is_installed_build`. The refusal is here rather than inside `create_task`
/// because the fallback would otherwise write that same dev path to the Run key,
/// which is the identical bug by the slower mechanism. The caller is told the
/// state actually reached, so the tray switch snaps back rather than lying.
pub fn set_enabled(app: &AppHandle, enabled: bool) -> bool {
    // The package's own extension, and nothing else. Writing a scheduled task or
    // a Run key from inside an MSIX would survive the app being uninstalled —
    // the package goes, the task stays, and every login afterwards tries to
    // launch a path that no longer exists. Clean uninstall is the whole reason
    // the manifest carries a startup task in the first place.
    #[cfg(windows)]
    if is_packaged() {
        return msix_set_enabled(enabled);
    }

    if !enabled {
        let _ = delete_task();
        let _ = app.autolaunch().disable();
        return is_enabled(app);
    }

    let installed = std::env::current_exe()
        .map(|exe| is_installed_build(&exe))
        .unwrap_or(false);
    if !installed {
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
/// A fourth case sits inside the first: the task exists but launches something
/// else. That is an install that has moved, or — the way it actually happened —
/// a task left pointing at a `tauri dev` binary, which no amount of installing
/// the real app would have corrected on its own. An installed build repoints the
/// task at itself, which is also what makes that state self-healing on the next
/// launch rather than something a user has to know about.
///
/// Returns whether the caller should record that startup has now been configured.
pub fn migrate(app: &AppHandle, configured: bool) -> bool {
    // Nothing to migrate *from* and no ambiguity to resolve. The manifest ships
    // the startup task `Enabled="true"`, so Windows has already made the choice
    // this function exists to make, and it is recorded as configured so the
    // three-case guess below never runs against a package.
    //
    // Deliberately not calling `set_enabled` here: on a build the user has
    // switched off in Task Manager that call is refused anyway, and on every
    // other one it would re-assert a state Windows already holds.
    #[cfg(windows)]
    if is_packaged() {
        return true;
    }

    let exe = std::env::current_exe().ok();
    let installed = exe.as_deref().map(is_installed_build).unwrap_or(false);

    if task_exists() {
        // A leftover Run entry alongside the task would spawn a doomed second
        // process every login.
        let _ = app.autolaunch().disable();
        if let Some(exe) = exe.filter(|_| installed) {
            if !task_targets(&exe) {
                let _ = create_task();
            }
        }
        return true;
    }

    // Nothing is registered and this build must not register anything, so there
    // is also no choice to record: `configured` has to stay false, or the first
    // installed launch would read it as "off on purpose" and never start up.
    if !installed {
        return false;
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

    /// The build tree is never a startup candidate.
    ///
    /// Asserted on the path half, which is what still applies to a release
    /// binary run out of `target\release`; under `cargo test` the
    /// `debug_assertions` half already refuses everything, installed path
    /// included, which is the behaviour the second case pins down.
    #[test]
    fn refuses_to_enrol_a_build_tree_binary() {
        let dev = Path::new(
            r"C:\Users\me\Code\dynamic-notch\product\src-tauri\target\debug\windows_dynamic_noich.exe",
        );
        let built = Path::new(
            r"C:\Users\me\Code\dynamic-notch\product\src-tauri\target\release\windows_dynamic_noich.exe",
        );
        let installed = Path::new(r"C:\Users\me\AppData\Local\Crest\windows_dynamic_noich.exe");

        assert!(!is_installed_build(dev));
        assert!(!is_installed_build(built));
        assert_eq!(is_installed_build(installed), !cfg!(debug_assertions));
    }

    /// `schtasks` output is decoded whichever way it arrives.
    ///
    /// The UTF-16 case is the one that matters: read as UTF-8 the NULs survive
    /// as interior bytes, the path never matches, and `migrate` would rewrite
    /// the task on every single launch.
    #[test]
    fn decodes_schtasks_output_in_either_encoding() {
        let text = "<Command>C:\\Crest\\app.exe</Command>";

        let mut utf16 = vec![0xFF, 0xFE];
        for unit in text.encode_utf16() {
            utf16.extend_from_slice(&unit.to_le_bytes());
        }

        assert_eq!(decode(text.as_bytes()), text);
        assert_eq!(decode(&utf16), text);
    }

    #[test]
    fn escapes_paths_that_would_break_the_xml() {
        let xml = task_xml(Path::new(r"C:\Tools\A & B\app.exe"));
        assert!(xml.contains(r"C:\Tools\A &amp; B\app.exe"));
    }
}
