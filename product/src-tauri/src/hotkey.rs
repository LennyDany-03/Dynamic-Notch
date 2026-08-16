//! The keyboard shortcut that summons the notch.
//!
//! This is the one way into the overlay that does not involve the mouse, and it
//! has to be an **OS-level** registration rather than a `keydown` listener in the
//! webview: the notch never takes focus (that is the whole click-through design —
//! see `useHotzone`), so a webview listener would only ever fire while the user was
//! already interacting with the card they were trying to summon.
//!
//! The accelerator is stored as a preference and is a plain string
//! (`"Ctrl+Shift+KeyN"`). The key half is a `KeyboardEvent.code` name because that
//! is what the picker in Settings captures and what `Shortcut`'s parser accepts
//! without ambiguity — `KeyN` is the physical key, on every layout, where `N`
//! would have to be guessed at. Settings prettifies it for display; nothing else
//! interprets it.

use std::str::FromStr;
use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Broadcast when the shortcut fires. Every notch window listens — with mirroring
/// on, the point of the shortcut is to put the notch in front of you, and which
/// screen "you" are looking at is not something this can know.
pub const TOGGLE_EVENT: &str = "hotkey-toggle";

/// Parse an accelerator, and refuse the ones that would take a key away from
/// every other app on the machine.
///
/// The modifier rule is the important half. A global shortcut is registered
/// system-wide, so binding a bare `KeyN` means no text field anywhere on Windows
/// ever sees an `n` again — and the user who did it would have no way to type the
/// letter needed to fix it. The picker refuses to capture one, and this is the
/// same rule on the writing side, because `settings.json` is hand-editable.
pub fn parse(accelerator: &str) -> Result<Shortcut, String> {
    let shortcut = Shortcut::from_str(accelerator)
        .map_err(|_| format!("Crest doesn't recognise the shortcut \"{accelerator}\"."))?;

    if shortcut.mods.is_empty() {
        return Err("A shortcut needs at least one of Ctrl, Alt, Shift or Win with it.".into());
    }

    Ok(shortcut)
}

/// Put the stored shortcut into effect, replacing whatever was registered before.
///
/// `unregister_all` first, unconditionally, because this runs on every `apply` —
/// at startup, on every preference change and on every appearance. Reconciling
/// against what is currently registered would mean keeping a second copy of the
/// answer next to the one in `settings.json`; clearing the whole set is one line
/// and cannot disagree with anything. There is never more than one shortcut.
///
/// A failure to register is reported to the caller but is not fatal: the usual
/// cause is another app holding the same combination, and the right outcome then
/// is a notch that works exactly as it did before, with the settings row saying
/// why. `apply` ignores the error for that reason; `set_hotkey` does not, because
/// there the user is standing in front of the answer.
pub fn apply(app: &AppHandle, accelerator: Option<&str>) -> Result<(), String> {
    let manager = app.global_shortcut();
    let _ = manager.unregister_all();

    let Some(accelerator) = accelerator else {
        return Ok(());
    };

    let shortcut = parse(accelerator)?;
    manager.register(shortcut).map_err(|_| {
        format!("Windows wouldn't give Crest {accelerator} — another app is probably using it.")
    })
}

/// The plugin, with the one handler the app has.
///
/// Guarded on `Pressed`: Windows reports the release too, and acting on both would
/// open the notch and close it again inside the same keystroke.
pub fn plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                let _ = app.emit(TOGGLE_EVENT, ());
            }
        })
        .build()
}
