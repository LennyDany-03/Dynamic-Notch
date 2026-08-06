/** Mirrors `MediaInfo` in `src-tauri/src/media.rs` (serialised camelCase). */
export interface MediaInfo {
  title: string
  artist: string
  albumArtBase64: string | null
  progressMs: number
  durationMs: number
  isPlaying: boolean
  /** AUMID of the owning app, e.g. "Spotify.exe", "msedge.exe". May be empty. */
  sourceAppId: string
}
