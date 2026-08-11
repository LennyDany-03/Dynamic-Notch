//! Battery, Wi-Fi and Bluetooth — the state of the machine itself, as one
//! snapshot.
//!
//! Everything this feeds is a *change* rather than a page: a charger going in, a
//! headset connecting, the Wi-Fi dropping. So this side is a pure read with no
//! memory of its own — the frontend polls it the way it polls the notification
//! centre, diffs one snapshot against the last, and decides what is worth a
//! banner. Keeping the diff there means there is exactly one place that knows
//! what counts as an event, and it is the place that also knows whether the notch
//! is free to show one.
//!
//! Three subsystems, one command, because they are read together: a poll per
//! subsystem would be three timers and three bridge round trips to answer what
//! one call already answers, and the frontend would have to reconcile snapshots
//! taken at three different moments.
//!
//! Every WinRT await here goes through `await_op` rather than `.get()`. The
//! notification module's logo attempt is the cautionary tale — an operation that
//! is simply never signalled makes `.get()` block its thread for the life of the
//! process. This runs on a poll, so a single hang would eat a worker every few
//! seconds; a bounded wait costs a missed field instead.

use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use windows::core::RuntimeType;
use windows::Devices::Bluetooth::{
    BluetoothConnectionStatus, BluetoothDevice as WinBluetoothDevice, BluetoothLEDevice,
    BluetoothMajorClass,
};
use windows::Devices::Enumeration::DeviceInformation;
use windows::Foundation::{AsyncStatus, IAsyncOperation};
use windows::Networking::Connectivity::{NetworkConnectivityLevel, NetworkInformation};

/// `BatteryFlag` bits from `GetSystemPowerStatus`. The API predates the enums it
/// would have used today, so these are the two bits that matter, named.
const BATTERY_FLAG_CHARGING: u8 = 8;
const BATTERY_FLAG_NO_BATTERY: u8 = 128;

/// What `GetSystemPowerStatus` writes into a field it cannot answer.
const POWER_UNKNOWN: u8 = 255;

/// How long any single WinRT await may take before the snapshot gives up on that
/// field. Generous next to the calls themselves (single-digit milliseconds when
/// the radio is idle) and far short of the poll interval, so a stalled call can
/// never queue polls up behind it.
const AWAIT_TIMEOUT: Duration = Duration::from_millis(700);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BatteryStatus {
    /// Charge remaining, 0–100. `None` when Windows will not say.
    pub percent: Option<u8>,
    /// Whether a charger is attached.
    ///
    /// This, and not `charging`, is what the plug banner keys on: a battery
    /// sitting at 100% on mains is not charging, and plugging in is still the
    /// thing the user just did with their hands.
    pub ac_power: bool,
    /// Whether the battery is actually taking charge.
    pub charging: bool,
    /// Runtime left on battery, in seconds, when Windows has an estimate — it
    /// has none for the first minutes after a discharge starts.
    pub seconds_remaining: Option<u32>,
}

#[derive(Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NetworkKind {
    Wifi,
    /// Anything connected that is not Wi-Fi — ethernet, tethering, a dock.
    Wired,
    None,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NetworkStatus {
    pub kind: NetworkKind,
    /// The SSID for Wi-Fi, the adapter's profile name otherwise.
    pub name: Option<String>,
    /// Signal strength, 0–5, Wi-Fi only. Reported for the banner to draw; never
    /// part of what counts as a change, since it moves on its own all day.
    pub signal_bars: Option<u8>,
}

/// What sort of thing a connected Bluetooth device is, so the banner can draw it
/// as what it is rather than as a generic radio.
///
/// Windows' class-of-device has a dozen major classes; these are the ones that
/// map to a distinguishable picture. Everything else is `Other`, which draws the
/// Bluetooth rune — correct, if unspecific.
#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum BluetoothKind {
    Audio,
    Phone,
    Computer,
    /// Mice, keyboards, controllers.
    Peripheral,
    Wearable,
    Other,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BluetoothDevice {
    /// Windows' device id. Opaque, stable while the device stays paired, and the
    /// key the frontend diffs one poll against the next on.
    pub id: String,
    pub name: String,
    pub kind: BluetoothKind,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SystemStatus {
    /// `None` on a machine with no battery, which is a desktop: there is no
    /// charger to plug in, so there is nothing to report rather than a battery
    /// at an unknown percentage.
    pub battery: Option<BatteryStatus>,
    pub network: NetworkStatus,
    /// Connected devices only. Paired-but-away devices are not a state anyone
    /// asked to see, and they are most of the list.
    pub bluetooth: Vec<BluetoothDevice>,
}

/// Device id → what kind of thing it is.
///
/// A second WinRT call per device, and a device's class does not change while it
/// is paired to the same machine. Without the cache a headset that stays
/// connected all day would cost that call on every poll; with it, one. A lookup
/// that fails or times out caches `Other` deliberately — retrying a device that
/// will not answer, every few seconds, forever, is the failure mode this is
/// avoiding in the first place.
static KINDS: OnceLock<Mutex<HashMap<String, BluetoothKind>>> = OnceLock::new();

fn kinds() -> &'static Mutex<HashMap<String, BluetoothKind>> {
    KINDS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Wait for a WinRT operation, but never indefinitely.
///
/// Polls `Status` rather than blocking in `get()`. These commands run on a Tauri
/// worker thread with no message pump, so an operation that is never signalled —
/// which is not hypothetical here, see `notifications::notification_logo` — would
/// otherwise take the thread with it. The sleep is what keeps the poll from
/// spinning a core while it waits.
fn await_op<T>(operation: IAsyncOperation<T>, timeout: Duration) -> Option<T>
where
    T: RuntimeType + 'static,
{
    let deadline = Instant::now() + timeout;
    loop {
        match operation.Status() {
            Ok(AsyncStatus::Completed) => return operation.GetResults().ok(),
            // Started is the only status worth waiting on; Error and Canceled are
            // both final, and an unreadable status is not going to become one.
            Ok(AsyncStatus::Started) => {}
            _ => return None,
        }

        if Instant::now() >= deadline {
            return None;
        }
        std::thread::sleep(Duration::from_millis(10));
    }
}

/// The charger and the charge, from the Win32 call rather than WinRT.
///
/// `Windows.System.Power` reports the same thing, but only in coarse buckets and
/// only for the aggregate battery; this gives the percentage and the runtime
/// estimate the banner actually says out loud, in one non-blocking call.
fn battery() -> Option<BatteryStatus> {
    use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};

    let mut status = SYSTEM_POWER_STATUS::default();
    unsafe { GetSystemPowerStatus(&mut status) }.ok()?;

    // A desktop. Nothing to plug in, so nothing to report — as distinct from a
    // laptop whose charge is momentarily unknown, which is a battery at `None`.
    if status.BatteryFlag & BATTERY_FLAG_NO_BATTERY != 0 {
        return None;
    }

    let percent = (status.BatteryLifePercent != POWER_UNKNOWN).then_some(status.BatteryLifePercent);

    // Documented as -1 for "unknown", which arrives here as u32::MAX. Windows
    // also reports it as unknown for the first couple of minutes on battery,
    // while it works out a rate.
    let seconds_remaining = (status.BatteryLifeTime != u32::MAX).then_some(status.BatteryLifeTime);

    Some(BatteryStatus {
        percent,
        ac_power: status.ACLineStatus == 1,
        charging: status.BatteryFlag & BATTERY_FLAG_CHARGING != 0,
        seconds_remaining,
    })
}

const DISCONNECTED: NetworkStatus = NetworkStatus {
    kind: NetworkKind::None,
    name: None,
    signal_bars: None,
};

/// What the machine is on the internet through, if anything.
///
/// `GetInternetConnectionProfile` is the profile Windows itself would route
/// through, which is the one the user means by "my Wi-Fi" — enumerating adapters
/// instead would have to pick between a connected VPN, a virtual switch and the
/// radio, and would pick wrong on any machine running Docker or WSL.
fn network() -> NetworkStatus {
    let Ok(profile) = NetworkInformation::GetInternetConnectionProfile() else {
        return DISCONNECTED;
    };

    // An adapter can hold a profile while having no connectivity at all — a
    // radio associated to an access point that never handed out a lease. That is
    // "not connected" to everyone except the API.
    let level = profile
        .GetNetworkConnectivityLevel()
        .unwrap_or(NetworkConnectivityLevel::None);
    if level == NetworkConnectivityLevel::None {
        return DISCONNECTED;
    }

    if !profile.IsWlanConnectionProfile().unwrap_or(false) {
        return NetworkStatus {
            kind: NetworkKind::Wired,
            name: profile.ProfileName().ok().map(|name| name.to_string()),
            signal_bars: None,
        };
    }

    // The SSID is the name the user knows the network by; `ProfileName` is the
    // same string on most machines and the adapter's name on some, so the SSID
    // is asked for first and the profile name is the fallback.
    let ssid = profile
        .WlanConnectionProfileDetails()
        .and_then(|details| details.GetConnectedSsid())
        .map(|ssid| ssid.to_string())
        .ok()
        .filter(|ssid| !ssid.is_empty())
        .or_else(|| profile.ProfileName().ok().map(|name| name.to_string()));

    NetworkStatus {
        kind: NetworkKind::Wifi,
        name: ssid,
        signal_bars: profile
            .GetSignalBars()
            .and_then(|bars| bars.Value())
            .ok(),
    }
}

fn major_class(class: BluetoothMajorClass) -> BluetoothKind {
    match class {
        BluetoothMajorClass::AudioVideo => BluetoothKind::Audio,
        BluetoothMajorClass::Phone => BluetoothKind::Phone,
        BluetoothMajorClass::Computer => BluetoothKind::Computer,
        BluetoothMajorClass::Peripheral => BluetoothKind::Peripheral,
        BluetoothMajorClass::Wearable => BluetoothKind::Wearable,
        _ => BluetoothKind::Other,
    }
}

/// The class of a classic Bluetooth device, cached for the life of the process.
///
/// Only classic devices carry a class of device; Bluetooth LE has an appearance
/// value instead, which is optional, frequently unset, and unreliable on exactly
/// the devices it would help with. LE therefore draws the generic rune.
fn device_kind(id: &str, low_energy: bool) -> BluetoothKind {
    if low_energy {
        return BluetoothKind::Other;
    }

    if let Some(kind) = kinds().lock().unwrap_or_else(|e| e.into_inner()).get(id) {
        return *kind;
    }

    let kind = WinBluetoothDevice::FromIdAsync(&id.into())
        .ok()
        .and_then(|operation| await_op(operation, AWAIT_TIMEOUT))
        .and_then(|device| device.ClassOfDevice().ok())
        .and_then(|class| class.MajorClass().ok())
        .map(major_class)
        .unwrap_or(BluetoothKind::Other);

    kinds()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .insert(id.to_string(), kind);
    kind
}

/// Everything currently connected over Bluetooth, classic and LE.
///
/// Two queries because they are two device models: a pair of headphones is a
/// classic device and a watch is usually an LE one, and neither selector sees the
/// other's devices. A dual-mode device answers both with different ids, which is
/// why the merge below drops repeats by *name* as well — one headset is one
/// event, whatever the radio calls it.
fn connected_devices() -> Vec<BluetoothDevice> {
    let selectors = [
        (
            WinBluetoothDevice::GetDeviceSelectorFromConnectionStatus(
                BluetoothConnectionStatus::Connected,
            ),
            false,
        ),
        (
            BluetoothLEDevice::GetDeviceSelectorFromConnectionStatus(
                BluetoothConnectionStatus::Connected,
            ),
            true,
        ),
    ];

    let mut devices: Vec<BluetoothDevice> = Vec::new();

    for (selector, low_energy) in selectors {
        let Ok(selector) = selector else { continue };
        let Some(found) = DeviceInformation::FindAllAsyncAqsFilter(&selector)
            .ok()
            .and_then(|operation| await_op(operation, AWAIT_TIMEOUT))
        else {
            continue;
        };

        for info in found {
            let Ok(id) = info.Id().map(|id| id.to_string()) else {
                continue;
            };
            let name = info
                .Name()
                .map(|name| name.to_string())
                .unwrap_or_default();

            // A device with no name is one the notch has nothing to say about:
            // "Connected" over a blank line is worse than staying quiet.
            if name.is_empty() {
                continue;
            }
            if devices
                .iter()
                .any(|existing| existing.id == id || existing.name == name)
            {
                continue;
            }

            let kind = device_kind(&id, low_energy);
            devices.push(BluetoothDevice { id, name, kind });
        }
    }

    devices
}

/// One snapshot of the machine.
///
/// `bluetooth` is asked for rather than assumed because the two callers want
/// different things from the same poll: the banner needs the device list, and the
/// battery badge on the pill needs only the charge. Enumerating devices is most of
/// the cost here (~50ms against a handful of microseconds for the other two), and
/// the notch polls this every couple of seconds for as long as it runs — so a
/// user who has turned the banners off should not be paying for a list nothing
/// will read.
#[tauri::command]
pub async fn get_system_status(bluetooth: bool) -> SystemStatus {
    SystemStatus {
        battery: battery(),
        network: network(),
        bluetooth: if bluetooth {
            connected_devices()
        } else {
            Vec::new()
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Prints the snapshot the notch diffs, three times over.
    ///
    /// Exercises all three reads together, which is the point: any one of them
    /// hanging would hang the poll. Repeated because the *steady-state* cost is
    /// what a poll every couple of seconds pays — the first snapshot carries the
    /// WinRT activation and the class-of-device lookups, both of which are once
    /// per process.
    #[tokio::test]
    async fn reads_a_snapshot() {
        let mut status = get_system_status(true).await;
        let mut elapsed = Duration::ZERO;

        for _ in 0..2 {
            let started = Instant::now();
            status = get_system_status(true).await;
            elapsed = started.elapsed();
            println!("snapshot in {elapsed:?}");
        }

        match &status.battery {
            Some(battery) => println!(
                "battery: {:?}% ac={} charging={} left={:?}s",
                battery.percent, battery.ac_power, battery.charging, battery.seconds_remaining
            ),
            None => println!("battery: none (desktop)"),
        }
        println!(
            "network: {:?} bars={:?}",
            status.network.name, status.network.signal_bars
        );
        for device in &status.bluetooth {
            println!("bluetooth: {} ({:?})", device.name, device.kind);
        }

        // Three bounded awaits, so the worst case is bounded too — and it has to
        // stay well inside `POLL_MS` in `useSystemStatus`, or polls queue up
        // behind each other. A snapshot slower than this is one of them blocking
        // rather than waiting.
        assert!(elapsed < Duration::from_secs(1), "snapshot took {elapsed:?}");
    }
}
