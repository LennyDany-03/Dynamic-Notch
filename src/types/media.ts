export interface MediaInfo {
  title: string;
  artist: string;
  albumArtBase64: string | null;
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
}
