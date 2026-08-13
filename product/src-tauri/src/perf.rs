//! CPU, memory, GPU, disk and temperature — the machine's *load*, as one
//! snapshot, plus the three ways to stop it.
//!
//! Sibling of `system.rs` and deliberately not part of it. That module answers
//! "what is attached" (a charger, a headset, a network) and every field in it is
//! a *state* that changes when the user does something with their hands. This one
//! answers "how hard is it working", which is a set of rates that move on their
//! own, all the time, and which nothing but arithmetic can turn into an event.
//! One command each keeps the cheap snapshot cheap: the badge on the pill polls
//! `system.rs` for the life of the process and has no use for a PDH round trip.
//!
//! Same division of labour as its sibling, though. This is a pure read with no
//! memory beyond what the counters themselves require; what counts as *overload*
//! is decided in `usePerformance`, next to the thing that knows whether the notch
//! is free to show a banner.
//!
//! **Almost everything here comes from PDH rather than from a Win32 call**, which
//! is worth saying because two of the five have an obvious-looking alternative:
//!
//!  - CPU could be `GetSystemTimes` diffed by hand. PDH's
//!    `% Processor Utility` is what Task Manager's "CPU" reads, and it is not the
//!    same number — it is scaled by the frequency the cores actually ran at, so a
//!    throttled machine reports the load it is *delivering* rather than the share
//!    of wall-clock it spent not idle. A user comparing the notch against Task
//!    Manager has to see Task Manager's number or the notch is simply wrong.
//!  - Temperature could be WMI's `MSAcpi_ThermalZoneTemperature`, which is the
//!    answer every search gives. It needs a COM apartment, a proxy blanket and an
//!    elevation the notch does not have. `\Thermal Zone Information(*)`
//!    is the same ACPI reading through a handle this file already owns.
//!
//! The counters are opened once and live for the process, because three of the
//! four are *rates*: PDH computes a rate between two collections, so a query that
//! was opened, collected and closed per call would return the same "no data yet"
//! forever. That is also why the first snapshot reports `None` for CPU, GPU and
//! disk — but not for the thermal zone, which is an instantaneous reading and is
//! right the first time it is asked, nor for memory, which is not a counter.

use serde::Serialize;
use std::sync::{Mutex, OnceLock};

use windows::core::{w, PCWSTR};
use windows::Win32::System::Performance::{
    PdhAddEnglishCounterW, PdhCollectQueryData, PdhGetFormattedCounterArrayW,
    PdhGetFormattedCounterValue, PdhOpenQueryW, PDH_FMT_COUNTERVALUE, PDH_FMT_COUNTERVALUE_ITEM_W,
    PDH_FMT_DOUBLE,
};

/// PDH's query and counter handles. Both are bare `isize` in the bindings — the
/// metadata carries no distinct handle type for them — so they are named here
/// rather than left as an integer that could be swapped for the other by mistake.
type Query = isize;
type Counter = isize;

/// `PDH_MORE_DATA`, the "your buffer is too small, here is the size" answer from
/// the array reads. Spelled out because it is the one non-zero status that means
/// success, and the crate types it as a plain `u32` alongside the failures.
const PDH_MORE_DATA: u32 = 0x8000_07D2;

/// A thermal reading outside this band is not a temperature.
///
/// `Thermal Zone Information` is filled in by firmware, and firmware gets it
/// wrong in two directions: a zone that is not wired up reports 0 K, and some
/// vendors report the value already in Celsius, which lands here as a machine
/// running at minus two hundred degrees. Neither is worth drawing, and the second
/// would silently *under*-report a hot machine, so both become "no reading".
const TEMP_MIN_C: f32 = 5.0;
const TEMP_MAX_C: f32 = 130.0;

#[derive(Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub struct Performance {
    /// Processor utility, 0–100. `None` on the first snapshot and only then —
    /// see the note above about rates.
    pub cpu: Option<f32>,
    /// Committed physical memory, 0–100. Never `None`: it is a level, not a rate,
    /// so the very first snapshot has it.
    pub memory: f32,
    pub memory_used_bytes: u64,
    pub memory_total_bytes: u64,
    /// The busiest GPU engine *class*, 0–100. `None` on a machine whose driver
    /// registers no GPU engine counters, which is most virtual machines.
    pub gpu: Option<f32>,
    /// Disk active time, 0–100, across every physical disk.
    pub disk: Option<f32>,
    /// The hottest ACPI thermal zone, in °C. `None` on the very many machines
    /// whose firmware exposes none — see `TEMP_MIN_C`.
    pub temperature_c: Option<f32>,
}

/// The PDH query and its counters, opened once.
///
/// Handles rather than paths, because the counters are the query's state: PDH
/// holds the previous sample of each rate inside the handle, and that is exactly
/// the thing that must survive between commands.
///
/// Every field past the query is optional. A counter set that is not installed
/// fails at `PdhAddEnglishCounterW` and is simply never asked for again — the GPU
/// one is absent on a machine with no WDDM driver and the thermal one on most
/// desktops, and neither is a reason for the other four to fail.
struct Counters {
    query: Query,
    cpu: Option<Counter>,
    /// `% Idle Time`, not `% Disk Time`: see `disk_percent`.
    disk_idle: Option<Counter>,
    /// Wildcard over every GPU engine instance.
    gpu: Option<Counter>,
    /// Wildcard over every thermal zone.
    thermal: Option<Counter>,
}

/// One query for the process, behind a mutex.
///
/// PDH is safe to call from any thread but a single query is not safe to use from
/// two at once, and these commands run on whatever Tauri worker is free. The lock
/// is held across the collection and the reads, which is the whole of a snapshot.
static COUNTERS: OnceLock<Mutex<Option<Counters>>> = OnceLock::new();

/// Add one counter to the query, or report that this machine does not have it.
///
/// `PdhAddEnglishCounterW` rather than `PdhAddCounterW`: counter paths are
/// *localised*, so the German build of Windows has no `\Processor Information`
/// and the notch would report nothing at all on it. The English variant takes the
/// invariant name and does the lookup itself.
fn add(query: Query, path: PCWSTR) -> Option<Counter> {
    let mut counter: Counter = 0;
    let status = unsafe { PdhAddEnglishCounterW(query, path, 0, &mut counter) };
    (status == 0).then_some(counter)
}

impl Counters {
    fn open() -> Option<Self> {
        let mut query: Query = 0;
        // Null data source: the live counters on this machine, rather than a log.
        if unsafe { PdhOpenQueryW(PCWSTR::null(), 0, &mut query) } != 0 {
            return None;
        }

        // `% Processor Utility` is Task Manager's CPU column. Where it is missing
        // — it arrived in Windows 8 and a few server SKUs still lack the counter
        // set — `% Processor Time` is the older, un-scaled answer, which is worth
        // more than an empty meter.
        let cpu = add(query, w!("\\Processor Information(_Total)\\% Processor Utility"))
            .or_else(|| add(query, w!("\\Processor Information(_Total)\\% Processor Time")))
            .or_else(|| add(query, w!("\\Processor(_Total)\\% Processor Time")));

        Some(Self {
            cpu,
            disk_idle: add(query, w!("\\PhysicalDisk(_Total)\\% Idle Time")),
            gpu: add(query, w!("\\GPU Engine(*)\\Utilization Percentage")),
            thermal: add(query, w!("\\Thermal Zone Information(*)\\Temperature")),
            query,
        })
    }
}

/// One counter's current value, or `None` if PDH has nothing to give yet.
///
/// The `CStatus` check is not defensive noise: a rate counter answers
/// `PDH_CSTATUS_INVALID_DATA` in the window between the first and second
/// collection, and the value sitting next to that status is uninitialised.
fn read(counter: Counter) -> Option<f64> {
    let mut value = PDH_FMT_COUNTERVALUE::default();
    let status = unsafe { PdhGetFormattedCounterValue(counter, PDH_FMT_DOUBLE, None, &mut value) };
    if status != 0 || value.CStatus != 0 {
        return None;
    }
    Some(unsafe { value.Anonymous.doubleValue })
}

/// Every instance of a wildcard counter, as (instance name, value).
///
/// Two calls by design: the first is asked for a buffer size, which is the only
/// way to learn how many instances there are — `\GPU Engine(*)` has one per
/// process per engine and that number changes between polls.
fn read_all(counter: Counter) -> Vec<(String, f64)> {
    let mut bytes: u32 = 0;
    let mut count: u32 = 0;

    let status =
        unsafe { PdhGetFormattedCounterArrayW(counter, PDH_FMT_DOUBLE, &mut bytes, &mut count, None) };
    if status != PDH_MORE_DATA || bytes == 0 {
        return Vec::new();
    }

    // The instance count can move between the two calls — GPU engine instances
    // come and go with processes — in which case the second call answers
    // `PDH_MORE_DATA` again and this poll reports nothing for that counter. The
    // next one, two seconds later, sizes itself against the new count.

    // PDH writes the item array at the front of the buffer and the instance name
    // strings after it, so the allocation has to be `bytes` long *and* aligned for
    // the item type. A `Vec` of the items themselves gives both; the trailing
    // slack is where the names land.
    let stride = std::mem::size_of::<PDH_FMT_COUNTERVALUE_ITEM_W>();
    let slots = (bytes as usize).div_ceil(stride).max(1);
    let mut buffer: Vec<PDH_FMT_COUNTERVALUE_ITEM_W> = vec![PDH_FMT_COUNTERVALUE_ITEM_W::default(); slots];

    let status = unsafe {
        PdhGetFormattedCounterArrayW(
            counter,
            PDH_FMT_DOUBLE,
            &mut bytes,
            &mut count,
            Some(buffer.as_mut_ptr()),
        )
    };
    if status != 0 {
        return Vec::new();
    }

    let mut items = Vec::with_capacity(count as usize);
    for item in buffer.iter().take(count as usize) {
        if item.FmtValue.CStatus != 0 {
            continue;
        }
        let name = unsafe { item.szName.to_string() }.unwrap_or_default();
        items.push((name, unsafe { item.FmtValue.Anonymous.doubleValue }));
    }
    items
}

fn clamp_percent(value: f64) -> f32 {
    // `% Processor Utility` genuinely exceeds 100 on a boosting machine — it is a
    // ratio against base frequency, not against wall-clock — and a summed GPU
    // engine class can too. Both are meters, and a meter past its end is noise.
    value.clamp(0.0, 100.0) as f32
}

/// Disk activity the way Task Manager reads it.
///
/// `% Disk Time` looks like the obvious counter and is unusable: it is the sum of
/// per-request service times over the interval, so a queue depth of eight reports
/// 800%. Idle time is the only reading on a modern queued controller that means
/// what "active" implies, and Task Manager's own "Active time" column is exactly
/// this subtraction.
fn disk_percent(idle: f64) -> f32 {
    clamp_percent(100.0 - idle)
}

/// The busiest *class* of GPU engine.
///
/// `\GPU Engine(*)` has an instance per process per engine, named
/// `pid_9312_luid_…_eng_0_engtype_3D`. Summing the lot would report 300% for
/// three processes each doing a third of the work on different engines; taking a
/// single instance would miss a load spread across processes. Summing within an
/// engine type and taking the busiest type is what Task Manager's "GPU" column
/// does, and it is the number a user is going to compare this against.
fn gpu_percent(instances: &[(String, f64)]) -> Option<f32> {
    if instances.is_empty() {
        return None;
    }

    let mut totals: Vec<(&str, f64)> = Vec::new();
    for (name, value) in instances {
        // Anything without an engine type is not an engine instance.
        let Some(engine) = name.rsplit_once("engtype_").map(|(_, kind)| kind) else {
            continue;
        };
        match totals.iter_mut().find(|(kind, _)| *kind == engine) {
            Some((_, total)) => *total += value,
            None => totals.push((engine, *value)),
        }
    }

    totals
        .into_iter()
        .map(|(_, total)| total)
        .fold(None::<f64>, |best, total| Some(best.map_or(total, |b: f64| b.max(total))))
        .map(clamp_percent)
}

/// The hottest zone, in Celsius. PDH reports thermal zones in Kelvin.
fn temperature_c(instances: &[(String, f64)]) -> Option<f32> {
    instances
        .iter()
        .map(|(_, kelvin)| (kelvin - 273.15) as f32)
        .filter(|c| (TEMP_MIN_C..=TEMP_MAX_C).contains(c))
        .fold(None::<f32>, |best, c| Some(best.map_or(c, |b| b.max(c))))
}

/// Committed physical memory. The one reading here that is not a counter — it is
/// a level rather than a rate, so a single call answers it exactly.
fn memory() -> (f32, u64, u64) {
    use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};

    let mut status = MEMORYSTATUSEX {
        dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32,
        ..Default::default()
    };
    if unsafe { GlobalMemoryStatusEx(&mut status) }.is_err() {
        return (0.0, 0, 0);
    }

    let total = status.ullTotalPhys;
    let used = total.saturating_sub(status.ullAvailPhys);
    // `dwMemoryLoad` is the same figure Windows itself quotes, but only to the
    // nearest whole percent; the meter is smoother computed from the bytes it is
    // already reporting underneath.
    let percent = if total == 0 {
        0.0
    } else {
        (used as f64 / total as f64 * 100.0) as f32
    };

    (percent, used, total)
}

/// One snapshot of how hard the machine is working.
///
/// Cheap enough for the couple-of-seconds poll behind it: PDH keeps the counters
/// warm, so a collection is a memcpy out of shared memory for four of the five
/// readings. The one that is not free is the GPU wildcard, which enumerates an
/// instance per process — still under a millisecond, and the reason this is a
/// separate command from `get_system_status` rather than another field on it.
#[tauri::command]
pub async fn get_performance() -> Performance {
    let (memory_percent, memory_used_bytes, memory_total_bytes) = memory();

    let mut guard = COUNTERS
        .get_or_init(|| Mutex::new(None))
        .lock()
        .unwrap_or_else(|e| e.into_inner());

    // Left as `None` if the query will not open, rather than cached as a set of
    // dead handles: the poll runs for the life of the process, and a PDH that was
    // momentarily unavailable at startup would otherwise mean empty meters
    // forever. Memory is answered either way — it is not a counter.
    if guard.is_none() {
        *guard = Counters::open();
    }
    let Some(counters) = guard.as_mut() else {
        return Performance {
            cpu: None,
            memory: memory_percent,
            memory_used_bytes,
            memory_total_bytes,
            gpu: None,
            disk: None,
            temperature_c: None,
        };
    };

    // There is deliberately no "have we collected once yet" flag here. The first
    // collection only anchors the rates, and each of them says so itself: `read`
    // and `read_all` check `CStatus`, which is `PDH_CSTATUS_INVALID_DATA` until a
    // rate has two samples. Tracking it separately would also suppress the one
    // counter that is *not* a rate — the thermal zone is an instantaneous reading
    // and is right the first time it is asked.
    let live = unsafe { PdhCollectQueryData(counters.query) } == 0;

    Performance {
        cpu: live.then(|| counters.cpu.and_then(read).map(clamp_percent)).flatten(),
        memory: memory_percent,
        memory_used_bytes,
        memory_total_bytes,
        gpu: live
            .then(|| counters.gpu.map(|c| gpu_percent(&read_all(c))))
            .flatten()
            .flatten(),
        disk: live
            .then(|| counters.disk_idle.and_then(read).map(disk_percent))
            .flatten(),
        temperature_c: live
            .then(|| counters.thermal.map(|c| temperature_c(&read_all(c))))
            .flatten()
            .flatten(),
    }
}

/// What the power row can do. Deliberately only these three: they are the ones a
/// Windows user reaches the Start menu's power button for, and every one of them
/// is reversible by turning the machine back on.
///
/// Signing out and locking are not here on purpose — locking has a keyboard
/// shortcut everybody already knows, and signing out is the one entry on that
/// menu that can lose work without a prompt from anything.
#[derive(serde::Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PowerAction {
    Sleep,
    Restart,
    Shutdown,
}

/// Give this process `SeShutdownPrivilege`.
///
/// Every account has the privilege and no account has it *enabled*: a token
/// carries it switched off until something asks, which is why `ExitWindowsEx`
/// answers `ERROR_ACCESS_DENIED` to code that looks correct. This is not an
/// elevation — an unprivileged user can shut their own machine down, and this
/// asks for nothing they could not do from the Start menu.
#[cfg(windows)]
fn enable_shutdown_privilege() -> Result<(), String> {
    use windows::Win32::Foundation::{CloseHandle, HANDLE, LUID};
    use windows::Win32::Security::{
        AdjustTokenPrivileges, LookupPrivilegeValueW, LUID_AND_ATTRIBUTES, SE_PRIVILEGE_ENABLED,
        TOKEN_ADJUST_PRIVILEGES, TOKEN_PRIVILEGES, TOKEN_QUERY,
    };
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    unsafe {
        let mut token = HANDLE::default();
        OpenProcessToken(
            GetCurrentProcess(),
            TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY,
            &mut token,
        )
        .map_err(|e| e.message())?;

        let mut luid = LUID::default();
        let lookup = LookupPrivilegeValueW(None, w!("SeShutdownPrivilege"), &mut luid);

        let result = lookup.and_then(|()| {
            let privileges = TOKEN_PRIVILEGES {
                PrivilegeCount: 1,
                Privileges: [LUID_AND_ATTRIBUTES {
                    Luid: luid,
                    Attributes: SE_PRIVILEGE_ENABLED,
                }],
            };
            // `AdjustTokenPrivileges` succeeds even when it changed nothing, so
            // the real answer is `GetLastError` — but the only failure it can
            // report here is the privilege being absent from the token, which no
            // interactive account is, and `ExitWindowsEx` gives a better error
            // for that case anyway.
            AdjustTokenPrivileges(token, false, Some(&privileges), 0, None, None)
        });

        let _ = CloseHandle(token);
        result.map_err(|e| e.message())
    }
}

/// Sleep, restart or shut the machine down.
///
/// Confirmed in the UI, never here: the notch expands on hover, so a card with a
/// live "Shut down" button one stray click away from a user's unsaved work would
/// be indefensible. `SystemModule` arms the button first and spends the arming on
/// a second click, and this command is only ever reached by that second click.
///
/// Restoring Windows' notification banners *before* handing over, because the
/// shell does not reliably give a hidden always-on-top overlay a clean exit on
/// the way down, and a machine that reboots into a silenced notification centre
/// with nothing running to make up for it is the worst thing this app can leave
/// behind. If the shutdown is then vetoed by another app, the banners are simply
/// un-muted until the next `settings::apply`, which is the safe direction to fail.
#[tauri::command]
pub fn power_action(app: tauri::AppHandle, action: PowerAction) -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows::Win32::System::Power::SetSuspendState;
        use windows::Win32::System::Shutdown::{
            ExitWindowsEx, EWX_FORCEIFHUNG, EWX_REBOOT, EWX_SHUTDOWN, SHTDN_REASON_FLAG_PLANNED,
            SHTDN_REASON_MAJOR_OTHER, SHTDN_REASON_MINOR_OTHER,
        };

        if action == PowerAction::Sleep {
            // `bHibernate: false` — sleep, not hibernate, whatever the machine's
            // own power button is configured to do. `bForce: false` so an app
            // with a real reason to refuse still can.
            let ok = unsafe { SetSuspendState(false, false, false) };
            return ok.as_bool().then_some(()).ok_or_else(|| "Windows wouldn't sleep.".into());
        }

        crate::settings::shutdown(&app);
        enable_shutdown_privilege()?;

        // `EWX_FORCEIFHUNG` and not `EWX_FORCE`: an app that is still answering
        // gets its say and can put its "save your work?" dialog up, and only one
        // that has stopped responding is closed out from under itself.
        let flags = if action == PowerAction::Restart {
            EWX_REBOOT
        } else {
            EWX_SHUTDOWN
        } | EWX_FORCEIFHUNG;

        unsafe {
            ExitWindowsEx(
                flags,
                SHTDN_REASON_MAJOR_OTHER | SHTDN_REASON_MINOR_OTHER | SHTDN_REASON_FLAG_PLANNED,
            )
        }
        .map_err(|e| e.message())
    }

    #[cfg(not(windows))]
    {
        let _ = (app, action);
        Err("Power actions are Windows-only.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    /// Prints the snapshot the notch meters, three times over.
    ///
    /// Three because the first is the anchor every rate is measured from and
    /// reports `None` by design — a run that shows numbers on the second and
    /// third is the whole contract of this module. The sleep is the interval PDH
    /// computes the rate over; without it the second collection is the same
    /// instant as the first and the rates come back as zero rather than as data.
    #[tokio::test]
    async fn reads_a_snapshot() {
        let mut elapsed = Duration::ZERO;

        for round in 0..3 {
            let started = Instant::now();
            let perf = get_performance().await;
            elapsed = started.elapsed();

            println!(
                "#{round} in {elapsed:?} — cpu={:?} mem={:.1}% ({:.1}/{:.1} GB) gpu={:?} disk={:?} temp={:?}",
                perf.cpu,
                perf.memory,
                perf.memory_used_bytes as f64 / 1e9,
                perf.memory_total_bytes as f64 / 1e9,
                perf.gpu,
                perf.disk,
                perf.temperature_c,
            );

            assert!(perf.memory_total_bytes > 0, "no memory reading");
            std::thread::sleep(Duration::from_millis(500));
        }

        // Has to stay well inside `POLL_MS` in `usePerformance`, or polls queue up
        // behind each other. The GPU wildcard is the only part that scales with
        // anything (one instance per process), so this is the reading that would
        // notice a machine under real load.
        assert!(elapsed < Duration::from_millis(250), "snapshot took {elapsed:?}");
    }
}
