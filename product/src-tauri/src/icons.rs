use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

/// Real app icons for the Quick Launcher.
///
/// `IShellItemImageFactory` is what Explorer itself draws with, and it is the only
/// route that covers both kinds of entry the index produces: a plain `.exe`/`.lnk`
/// path *and* a `shell:AppsFolder\<AppID>`. Packaged (Store/UWP) apps keep their
/// logo in a package manifest rather than as a resource in a binary, so the usual
/// `SHGetFileInfo`/`ExtractIconEx` route returns a generic placeholder for them —
/// which is most of the modern Start Menu.
///
/// Icons come back as 32bpp premultiplied BGRA DIB sections and leave as PNG data
/// URIs, because that is what an `<img>` can display directly.

/// Rendered size. Tiles draw at 32px; asking for double keeps them crisp on a
/// 200% display, which is the common case for the laptops this runs on.
const ICON_PX: i32 = 64;

/// An icon does not change for the life of an install, and search re-queries the
/// same handful of apps on every keystroke — so resolve each path at most once.
///
/// Only successes are stored. The shell's imaging pipeline fails transiently when
/// it is busy, and caching that would leave a permanently blank tile for an app
/// that has a perfectly good icon.
fn cache() -> &'static Mutex<HashMap<String, String>> {
    static CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// `async` keeps this off the main thread, and the shell work then moves to a
/// blocking worker: resolving an icon hits the disk and can take tens of ms, which
/// would otherwise stall the async runtime while the user is typing.
#[tauri::command]
pub async fn app_icon(path: String) -> Result<Option<String>, String> {
    if let Some(hit) = cache().lock().unwrap().get(&path) {
        return Ok(Some(hit.clone()));
    }

    let key = path.clone();
    let icon = tauri::async_runtime::spawn_blocking(move || extract(&path))
        .await
        .map_err(|e| format!("icon lookup failed: {e}"))?;

    if let Some(png) = &icon {
        cache().lock().unwrap().insert(key, png.clone());
    }
    Ok(icon)
}

#[cfg(windows)]
fn extract(path: &str) -> Option<String> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::SIZE;
    use windows::Win32::Graphics::Gdi::{DeleteObject, HGDIOBJ};
    use windows::Win32::UI::Shell::{
        IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_BIGGERSIZEOK, SIIGBF_ICONONLY,
    };

    unsafe {
        init_com_for_thread();

        let result = (|| {
            let wide: Vec<u16> = path.encode_utf16().chain(Some(0)).collect();
            let factory: IShellItemImageFactory =
                SHCreateItemFromParsingName(PCWSTR(wide.as_ptr()), None).ok()?;

            // BIGGERSIZEOK takes the next size up rather than upscaling a smaller
            // one, so a tile never shows a blurred 32px icon stretched to 64.
            let bitmap = factory
                .GetImage(
                    SIZE {
                        cx: ICON_PX,
                        cy: ICON_PX,
                    },
                    SIIGBF_ICONONLY | SIIGBF_BIGGERSIZEOK,
                )
                .ok()?;

            let png = encode_png(bitmap);
            let _ = DeleteObject(HGDIOBJ(bitmap.0));
            png
        })();

        result
    }
}

/// Initialise COM on this thread and deliberately never uninitialise it.
///
/// These run on pooled blocking threads, and icon extraction overlaps with the
/// launcher's background re-index — both talk to the shell. `CoUninitialize` on
/// the last reference in an apartment unloads in-process COM servers, which was
/// pulling the shell's handlers out from under whichever call was still running:
/// concurrent lookups failed and the tile fell back to a bare initial. The pool
/// threads live as long as the process, so leaving the apartment up costs nothing
/// and removes the race entirely.
#[cfg(windows)]
pub(crate) fn init_com_for_thread() {
    use std::cell::Cell;
    use windows::Win32::System::Com::{CoInitializeEx, COINIT_APARTMENTTHREADED};

    thread_local! {
        static READY: Cell<bool> = const { Cell::new(false) };
    }

    READY.with(|ready| {
        if ready.get() {
            return;
        }
        // A failure here means the thread is already an MTA, which the shell
        // calls below are equally happy to use.
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        }
        ready.set(true);
    });
}

/// Read the DIB's pixels and re-encode them as a PNG data URI.
#[cfg(windows)]
unsafe fn encode_png(bitmap: windows::Win32::Graphics::Gdi::HBITMAP) -> Option<String> {
    use base64::{engine::general_purpose, Engine as _};
    use windows::Win32::Graphics::Gdi::{GetObjectW, DIBSECTION, HGDIOBJ};

    let mut dib = DIBSECTION::default();
    let wanted = std::mem::size_of::<DIBSECTION>() as i32;
    if GetObjectW(
        HGDIOBJ(bitmap.0),
        wanted,
        Some(&mut dib as *mut _ as *mut _),
    ) != wanted
    {
        return None;
    }

    let width = dib.dsBm.bmWidth;
    let height = dib.dsBm.bmHeight.abs();
    if width <= 0 || height <= 0 || dib.dsBm.bmBitsPixel != 32 || dib.dsBm.bmBits.is_null() {
        return None;
    }

    let stride = dib.dsBm.bmWidthBytes as usize;
    let pixels = std::slice::from_raw_parts(dib.dsBm.bmBits as *const u8, stride * height as usize);

    // A negative header height marks a top-down DIB, which is what the shell
    // returns; a positive one is bottom-up and has to be read in reverse.
    let top_down = dib.dsBmih.biHeight < 0;

    // Some sources hand back an all-zero alpha channel rather than no channel at
    // all. Treating that literally would make the icon fully transparent, so it
    // is read as "opaque" instead.
    let has_alpha = (0..height as usize).any(|y| {
        let row = &pixels[y * stride..];
        (0..width as usize).any(|x| row[x * 4 + 3] != 0)
    });

    let mut rgba = Vec::with_capacity((width * height * 4) as usize);
    for y in 0..height as usize {
        let source = if top_down { y } else { height as usize - 1 - y };
        let row = &pixels[source * stride..];
        for x in 0..width as usize {
            let px = &row[x * 4..x * 4 + 4];
            let (b, g, r) = (px[0], px[1], px[2]);
            let a = if has_alpha { px[3] } else { 255 };
            // The shell premultiplies alpha; PNG wants it straight, and skipping
            // this leaves every soft edge darkened against the card.
            let un = |c: u8| {
                if a == 0 {
                    0
                } else {
                    ((c as u32 * 255) / a as u32).min(255) as u8
                }
            };
            rgba.extend_from_slice(&[un(r), un(g), un(b), a]);
        }
    }

    let mut out = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut out, width as u32, height as u32);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().ok()?;
        writer.write_image_data(&rgba).ok()?;
    }

    Some(format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(&out)
    ))
}

#[cfg(not(windows))]
fn extract(_path: &str) -> Option<String> {
    None
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    /// Guards the whole unsafe path: parsing name → shell image → DIB read →
    /// PNG. A regression anywhere in it shows up as a blank launcher tile, which
    /// is easy to mistake for a styling problem.
    #[test]
    fn extracts_a_real_icon() {
        let windir = std::env::var("WINDIR").expect("WINDIR");
        let icon = extract(&format!(r"{windir}\System32\notepad.exe"))
            .expect("notepad.exe should have an icon");

        assert!(icon.starts_with("data:image/png;base64,"));

        let payload = icon.trim_start_matches("data:image/png;base64,");
        let bytes = {
            use base64::{engine::general_purpose, Engine as _};
            general_purpose::STANDARD
                .decode(payload)
                .expect("valid base64")
        };
        assert_eq!(&bytes[..8], b"\x89PNG\r\n\x1a\n", "not a PNG");

        // Decodes, and is not a fully transparent square.
        let decoder = png::Decoder::new(bytes.as_slice());
        let mut reader = decoder.read_info().expect("readable PNG");
        let mut buf = vec![0; reader.output_buffer_size()];
        let info = reader.next_frame(&mut buf).expect("decodable frame");
        assert!(info.width >= 32 && info.height >= 32, "icon too small");
        assert!(
            buf.chunks(4).any(|px| px[3] != 0),
            "every pixel is transparent"
        );
    }

    /// The index hands back `shell:AppsFolder\<AppID>` for packaged apps, which
    /// are not files at all. This is the branch `SHGetFileInfo` could not serve
    /// and the reason the shell imaging API is used instead.
    ///
    /// Sampled rather than exhaustive, and tolerant of a few misses: some entries
    /// genuinely have no icon, and the shell's imaging pipeline fails
    /// occasionally when it is busy. A blanket failure is the regression worth
    /// catching — that would mean packaged apps had stopped resolving entirely.
    #[test]
    fn extracts_packaged_app_icons() {
        let apps = crate::launcher::scan_apps_folder().unwrap_or_default();
        assert!(
            !apps.is_empty(),
            "AppsFolder returned nothing to test against"
        );

        let sample: Vec<_> = apps.iter().take(8).collect();
        let resolved = sample
            .iter()
            .filter(|app| {
                extract(&app.path)
                    .map(|icon| icon.starts_with("data:image/png;base64,"))
                    .unwrap_or(false)
            })
            .count();

        assert!(
            resolved * 2 >= sample.len(),
            "only {resolved}/{} packaged apps resolved an icon",
            sample.len()
        );
    }

    #[test]
    fn missing_target_yields_no_icon() {
        assert!(extract(r"C:\definitely\not\a\real\app.exe").is_none());
    }
}
