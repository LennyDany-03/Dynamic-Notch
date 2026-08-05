use base64::{engine::general_purpose, Engine as _};
use serde::Serialize;
use windows::core::Interface;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSessionMediaProperties,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
};
use windows::Storage::Streams::{DataReader, IRandomAccessStream};
use windows::Foundation::TimeSpan;

#[derive(Serialize)]
pub struct MediaInfo {
    pub title: String,
    pub artist: String,
    pub album_art_base64: Option<String>,
    pub progress_ms: u64,
    pub duration_ms: u64,
    pub is_playing: bool,
}

fn timespan_to_ms(ts: TimeSpan) -> u64 {
    (ts.Duration.unsigned_abs() / 10_000) as u64
}

fn read_thumbnail(props: &GlobalSystemMediaTransportControlsSessionMediaProperties) -> Option<String> {
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

    let timeline = session
        .GetTimelineProperties()
        .map_err(|e| e.to_string())?;

    let progress_ms = timespan_to_ms(timeline.Position().unwrap_or(TimeSpan { Duration: 0 }));
    let duration_ms = timespan_to_ms(timeline.EndTime().unwrap_or(TimeSpan { Duration: 0 }));

    let playback = session
        .GetPlaybackInfo()
        .map_err(|e| e.to_string())?;

    let is_playing = playback
        .PlaybackStatus()
        .map(|s| s == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
        .unwrap_or(false);

    Ok(MediaInfo {
        title,
        artist,
        album_art_base64,
        progress_ms,
        duration_ms,
        is_playing,
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
