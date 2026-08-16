//! The two Windows audio endpoint lists behind Quick Access.
//!
//! The webview's `enumerateDevices()` API is intentionally not used here: Chromium
//! can omit output endpoints until a permission has been granted, which is exactly
//! the moment a small system control needs to be reliable. Core Audio owns the
//! real active render (speakers) and capture (microphone) endpoints instead.

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    /// Opaque Core Audio endpoint id. Never parse it; pass it back unchanged.
    pub id: String,
    pub name: String,
    pub device_type: &'static str,
    pub is_default: bool,
}

#[cfg(windows)]
mod native {
    use super::AudioDevice;
    use std::ffi::c_void;
    use windows::core::{GUID, Interface, IUnknown, IUnknown_Vtbl, PCWSTR};
    use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
    use windows::Win32::Media::Audio::{
        eCapture, eCommunications, eConsole, eMultimedia, eRender, DEVICE_STATE_ACTIVE, EDataFlow,
        ERole, IMMDevice, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_ALL,
        COINIT_APARTMENTTHREADED, STGM_READ,
    };
    use windows::Win32::System::Com::StructuredStorage::PropVariantToStringAlloc;

    // `IPolicyConfig` is the Windows shell's endpoint-policy interface, and it is
    // the one interface in this app that Microsoft does not publish. It has to be
    // hand-declared because *there is no documented way to change the default
    // audio endpoint at all* — Core Audio can enumerate and read the default, and
    // nothing in the public surface can write it. The alternative is opening the
    // Sound control panel and asking the user to do it, which is the four-click
    // trip this card exists to remove.
    //
    // What makes it safe enough to ship: a COM IID *is* the contract. The
    // `CoCreateInstance` below asks for this IID specifically, so it either hands
    // back an object whose vtable has this exact layout or it fails with
    // E_NOINTERFACE — a changed layout would have to arrive under a new IID to be
    // COM at all. This pair (CLSID_CPolicyConfigClient / IID_IPolicyConfig) has
    // been stable from Vista through Windows 11 and is what every audio switcher
    // on Windows uses. The preceding entries are retained rather than padded over
    // because the slot index is the whole contract: SetDefaultEndpoint is slot 13
    // (three `IUnknown` slots plus the ten methods declared before it), and a
    // miscount would call a different method with a mismatched signature.
    #[repr(transparent)]
    #[derive(Clone, PartialEq, Eq)]
    struct PolicyConfig(IUnknown);

    unsafe impl Interface for PolicyConfig {
        type Vtable = PolicyConfigVtable;
        const IID: GUID = GUID::from_u128(0xf8679f50_850a_41cf_9c72_430f290290c8);
    }

    #[repr(C)]
    struct PolicyConfigVtable {
        base__: IUnknown_Vtbl,
        get_mix_format: usize,
        get_device_format: usize,
        reset_device_format: usize,
        set_device_format: usize,
        get_processing_period: usize,
        set_processing_period: usize,
        get_share_mode: usize,
        set_share_mode: usize,
        get_property_value: usize,
        set_property_value: usize,
        set_default_endpoint: unsafe extern "system" fn(*mut c_void, PCWSTR, ERole) -> windows::core::HRESULT,
        set_endpoint_visibility: usize,
    }

    const POLICY_CONFIG_CLIENT: GUID = GUID::from_u128(0x870af99c_171d_4f9e_af0d_e63df40c2bc9);

    struct ComApartment(bool);

    impl ComApartment {
        fn initialize() -> Self {
            // A Tauri command can land on a thread COM has already initialised
            // differently. That is still usable; only uninitialise when this call
            // itself established (or incremented) the apartment.
            Self(unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok() })
        }
    }

    impl Drop for ComApartment {
        fn drop(&mut self) {
            if self.0 {
                unsafe { CoUninitialize() }
            }
        }
    }

    fn endpoint_id(device: &IMMDevice) -> Result<String, String> {
        unsafe {
            let raw = device.GetId().map_err(|error| error.to_string())?;
            let id = raw.to_string().map_err(|error| error.to_string());
            CoTaskMemFree(Some(raw.0.cast()));
            id
        }
    }

    fn endpoint_name(device: &IMMDevice) -> String {
        unsafe {
            let Ok(store) = device.OpenPropertyStore(STGM_READ) else {
                return "Unnamed audio device".to_string();
            };
            let Ok(value) = store.GetValue(&PKEY_Device_FriendlyName) else {
                return "Unnamed audio device".to_string();
            };
            let Ok(raw) = PropVariantToStringAlloc(&value) else {
                return "Unnamed audio device".to_string();
            };
            let name = raw.to_string().unwrap_or_else(|_| "Unnamed audio device".to_string());
            CoTaskMemFree(Some(raw.0.cast()));
            name
        }
    }

    fn endpoints(flow: EDataFlow, device_type: &'static str) -> Result<Vec<AudioDevice>, String> {
        let enumerator: IMMDeviceEnumerator = unsafe {
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|error| error.to_string())?
        };
        let default_id = unsafe {
            enumerator
                .GetDefaultAudioEndpoint(flow, eMultimedia)
                .ok()
                .and_then(|device| endpoint_id(&device).ok())
        };
        let collection = unsafe {
            enumerator
                .EnumAudioEndpoints(flow, DEVICE_STATE_ACTIVE)
                .map_err(|error| error.to_string())?
        };
        let count = unsafe { collection.GetCount().map_err(|error| error.to_string())? };
        let mut devices = Vec::with_capacity(count as usize);

        for index in 0..count {
            // One endpoint failing is not the list failing. A device mid-way
            // through being removed answers E_INVALIDARG here, and taking the
            // whole card down over it would mean an unplugged headset blanking
            // the speaker list for as long as Windows took to tidy up.
            let Ok(device) = (unsafe { collection.Item(index) }) else { continue };
            let Ok(id) = endpoint_id(&device) else { continue };
            devices.push(AudioDevice {
                name: endpoint_name(&device),
                is_default: default_id.as_deref() == Some(id.as_str()),
                id,
                device_type,
            });
        }
        Ok(devices)
    }

    pub fn list() -> Result<Vec<AudioDevice>, String> {
        let _apartment = ComApartment::initialize();

        // The two roles are read independently and only a total failure is an
        // error: a machine with no capture endpoint at all is ordinary (a desktop
        // with speakers and no microphone), and it must still get its speaker row.
        let render = endpoints(eRender, "speakers");
        let capture = endpoints(eCapture, "microphone");

        match (render, capture) {
            (Ok(mut devices), Ok(rest)) => {
                devices.extend(rest);
                Ok(devices)
            }
            (Ok(devices), Err(_)) | (Err(_), Ok(devices)) => Ok(devices),
            (Err(error), Err(_)) => Err(error),
        }
    }

    pub fn set_default(device_type: &str, device_id: &str) -> Result<(), String> {
        let _apartment = ComApartment::initialize();
        let (flow, stable_type) = match device_type {
            "speakers" => (eRender, "speakers"),
            "microphone" => (eCapture, "microphone"),
            _ => return Err("Unsupported audio device type".to_string()),
        };

        // Validate the id against the currently active endpoints before giving it
        // to the policy interface. It prevents stale UI state selecting a device
        // that was unplugged between opening the card and clicking it.
        let available = endpoints(flow, stable_type)?;
        if !available.iter().any(|device| device.id == device_id) {
            return Err("That audio device is no longer available".to_string());
        }

        let policy: PolicyConfig = unsafe {
            CoCreateInstance(&POLICY_CONFIG_CLIENT, None, CLSCTX_ALL)
                .map_err(|_| "Windows would not open its audio policy service".to_string())?
        };
        let wide: Vec<u16> = device_id.encode_utf16().chain(Some(0)).collect();
        let vtable = Interface::vtable(&policy);

        // All three roles, not just `eConsole`. Windows keeps a separate default
        // for voice chat, and a card whose whole promise is "sound comes out of
        // this now" that left calls on the old headset would be answering a
        // question nobody asked. The Sound control panel's split is for people who
        // went looking for it; this is the one-click path.
        for role in [eConsole, eMultimedia, eCommunications] {
            unsafe {
                (vtable.set_default_endpoint)(Interface::as_raw(&policy), PCWSTR(wide.as_ptr()), role)
                    .ok()
                    // Short on purpose: this crosses to the card's header, which
                    // is one line. An HRESULT's own text is a sentence and a hex
                    // code, and would arrive ellipsized to nothing useful.
                    .map_err(|_| "Windows refused the switch".to_string())?;
            }
        }
        Ok(())
    }
}

#[tauri::command]
pub fn list_audio_devices() -> Result<Vec<AudioDevice>, String> {
    #[cfg(windows)]
    return native::list();

    #[cfg(not(windows))]
    Ok(Vec::new())
}

#[tauri::command]
pub fn set_default_audio_device(device_type: String, device_id: String) -> Result<(), String> {
    #[cfg(windows)]
    return native::set_default(&device_type, &device_id);

    #[cfg(not(windows))]
    Err("Audio device switching is available on Windows only".to_string())
}
