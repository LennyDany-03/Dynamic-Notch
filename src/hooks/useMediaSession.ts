import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Track {
  title: string;
  artist: string;
  albumArt: string | null;
}

export function useMediaSession() {
  const [track, setTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMedia = useCallback(async () => {
    try {
      const info = await invoke<any>("get_current_media");
      const b64 = info.album_art_base64 ?? null;
      setTrack({
        title: info.title ?? "",
        artist: info.artist ?? "",
        albumArt: b64 ? `data:image/jpeg;base64,${b64}` : null,
      });
      setIsPlaying(info.is_playing ?? false);
      setProgress(info.progress_ms ?? 0);
      setDuration(info.duration_ms ?? 0);
    } catch {
      setTrack(null);
      setIsPlaying(false);
      setProgress(0);
      setDuration(0);
    }
  }, []);

  useEffect(() => {
    fetchMedia();
    intervalRef.current = setInterval(fetchMedia, 500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchMedia]);

  const playPause = useCallback(async () => {
    await invoke("media_play_pause").catch(() => {});
    fetchMedia();
  }, [fetchMedia]);

  const next = useCallback(async () => {
    await invoke("media_next").catch(() => {});
    setTimeout(fetchMedia, 300);
  }, [fetchMedia]);

  const prev = useCallback(async () => {
    await invoke("media_prev").catch(() => {});
    setTimeout(fetchMedia, 300);
  }, [fetchMedia]);

  const seek = useCallback(async (positionMs: number) => {
    await invoke("media_seek", { position_ms: Math.round(positionMs) }).catch(() => {});
    fetchMedia();
  }, [fetchMedia]);

  return { track, isPlaying, progress, duration, playPause, next, prev, seek };
}
