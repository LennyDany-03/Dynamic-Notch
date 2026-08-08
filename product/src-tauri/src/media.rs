use base64::{engine::general_purpose, Engine as _};
use serde::Serialize;
use windows::core::Interface;
use windows::Foundation::TimeSpan;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionMediaProperties,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
};
use windows::Storage::Streams::{DataReader, IRandomAccessStream};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    pub title: String,
    pub artist: String,
    pub album_art_base64: Option<String>,
    pub progress_ms: u64,
    pub duration_ms: u64,
    pub is_playing: bool,
    /// AUMID of the app that owns the session, e.g. "Spotify.exe" or "msedge.exe".
    /// Used to pick the source mark; the design shows one per playing app.
    pub source_app_id: String,
}

/// Milliseconds between the epoch WinRT's `DateTime` counts from (1601-01-01) and
/// the Unix epoch. Same constant as `notifications.rs`, in the other direction.
const FILETIME_TO_UNIX_MS: i64 = 11_644_473_600_000;

/// 100-nanosecond ticks → whole milliseconds.
fn ticks_to_ms(ticks: i64) -> u64 {
    (ticks.unsigned_abs() / 10_000) as u64
}

/// "Now" on WinRT's clock — 100-nanosecond intervals since 1601-01-01, the same
/// scale `DateTime::UniversalTime` is on, so the two can be subtracted.
///
/// Taken from `SystemTime` rather than a Win32 call so this needs no additional
/// feature on the `windows` crate; the epoch shift is the whole conversion.
fn now_universal() -> i64 {
    let unix_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|since| since.as_millis() as i64)
        .unwrap_or(0);
    (unix_ms + FILETIME_TO_UNIX_MS) * 10_000
}

fn read_thumbnail(
    props: &GlobalSystemMediaTransportControlsSessionMediaProperties,
) -> Option<String> {
    let thumb = props.Thumbnail().ok()?;
    let stream: IRandomAccessStream = thumb.OpenReadAsync().ok()?.get().ok()?.cast().ok()?;
    let size = stream.Size().ok()? as u32;
    if size == 0 {
        return None;
    }
    let input_stream = stream.GetInputStreamAt(0).ok()?;
    let reader = DataReader::CreateDataReader(&input_stream).ok()?;
    reader.LoadAsync(size).ok()?.get().ok()?;
    let mut bytes = vec![0u8; size as usize];
    reader.ReadBytes(&mut bytes).ok()?;
    Some(general_purpose::STANDARD.encode(&bytes))
}

fn get_manager() -> Result<GlobalSystemMediaTransportControlsSessionManager, String> {
    GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_current_media() -> Result<MediaInfo, String> {
    let manager = get_manager()?;
    let session = manager
        .GetCurrentSession()
        .map_err(|_| "No active media session".to_string())?;

    let props = session
        .TryGetMediaPropertiesAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;

    let title = props.Title().map(|s| s.to_string()).unwrap_or_default();
    let artist = props.Artist().map(|s| s.to_string()).unwrap_or_default();
    let album_art_base64 = read_thumbnail(&props);

    let timeline = session.GetTimelineProperties().map_err(|e| e.to_string())?;
    let playback = session.GetPlaybackInfo().map_err(|e| e.to_string())?;

    let is_playing = playback
        .PlaybackStatus()
        .map(|s| s == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
        .unwrap_or(false);

    let zero = TimeSpan { Duration: 0 };
    let start = timeline.StartTime().unwrap_or(zero).Duration;
    let end = timeline.EndTime().unwrap_or(zero).Duration;
    let position = timeline.Position().unwrap_or(zero).Duration;

    // `Position` is a snapshot, not a running clock. Windows records it at
    // `LastUpdatedTime` and leaves it there until the source app pushes another
    // timeline update — which Spotify does every few seconds at best, and some
    // players only on seek, play or pause. Reading it raw once a second therefore
    // returns the same number over and over, and the scrub bar sits still while
    // the track plays. Adding the time since that snapshot is what makes the
    // value current; the frontend interpolates between polls on top of it.
    //
    // Only while playing: paused, the snapshot is the truth and adding elapsed
    // time would run the bar on past a stopped track.
    let elapsed = if is_playing {
        timeline
            .LastUpdatedTime()
            .map(|updated| (now_universal() - updated.UniversalTime).max(0))
            .unwrap_or(0)
    } else {
        0
    };

    // Both are relative to `StartTime`, which is 0 for a file and non-zero for a
    // stream with a seekable window behind it.
    let span = end - start;
    let raw = position + elapsed - start;
    // An unknown or unreported duration (`span <= 0`) has no ceiling to clamp to;
    // clamping to it anyway pinned every such track at 0.
    let progress = if span > 0 { raw.clamp(0, span) } else { raw.max(0) };

    let progress_ms = ticks_to_ms(progress);
    let duration_ms = ticks_to_ms(span.max(0));

    let source_app_id = session
        .SourceAppUserModelId()
        .map(|s| s.to_string())
        .unwrap_or_default();

    Ok(MediaInfo {
        title,
        artist,
        album_art_base64,
        progress_ms,
        duration_ms,
        is_playing,
        source_app_id,
    })
}

#[tauri::command]
pub async fn media_play_pause() -> Result<(), String> {
    let session = get_manager()?
        .GetCurrentSession()
        .map_err(|_| "No active media session".to_string())?;
    session
        .TryTogglePlayPauseAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn media_next() -> Result<(), String> {
    let session = get_manager()?
        .GetCurrentSession()
        .map_err(|_| "No active media session".to_string())?;
    session
        .TrySkipNextAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn media_prev() -> Result<(), String> {
    let session = get_manager()?
        .GetCurrentSession()
        .map_err(|_| "No active media session".to_string())?;
    session
        .TrySkipPreviousAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn media_seek(position_ms: u64) -> Result<(), String> {
    let session = get_manager()?
        .GetCurrentSession()
        .map_err(|_| "No active media session".to_string())?;
    let duration = TimeSpan {
        Duration: (position_ms as i64) * 10_000,
    };
    session
        .TryChangePlaybackPositionAsync(duration.Duration)
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;
    Ok(())
}
