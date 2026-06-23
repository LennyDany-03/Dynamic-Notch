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
  const lastUpdatedRef = useRef<number>(Date.now());
  const isSeekingRef = useRef(false);
  const seekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setDuration(info.duration_ms ?? 0);
      
      // Only update progress from Windows if we are not actively seeking
      if (!isSeekingRef.current) {
        setProgress(info.progress_ms ?? 0);
      }
      lastUpdatedRef.current = Date.now();
    } catch {
      setTrack(null);
      setIsPlaying(false);
      setProgress(0);
      setDuration(0);
    }
  }, []);

  // Poll for media session metadata changes
  useEffect(() => {
    fetchMedia();
    intervalRef.current = setInterval(fetchMedia, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchMedia]);

  // Smooth local timeline ticker running at 60fps when playing
  useEffect(() => {
    if (!isPlaying) return;

    let frameId: number;
    const tick = () => {
      const now = Date.now();
      const elapsed = now - lastUpdatedRef.current;
      lastUpdatedRef.current = now;

      // Only advance progress locally if we are not seeking
      if (!isSeekingRef.current) {
        setProgress((prev) => {
          const nextVal = prev + elapsed;
          return nextVal > duration ? duration : nextVal;
        });
      }

      frameId = requestAnimationFrame(tick);
    };

    lastUpdatedRef.current = Date.now();
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isPlaying, duration]);

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
    // Clear existing seek timer
    if (seekTimerRef.current) {
      clearTimeout(seekTimerRef.current);
    }

    // Set seeking lock and update local progress state immediately (optimistic UI)
    isSeekingRef.current = true;
    setProgress(positionMs);
    lastUpdatedRef.current = Date.now();

    // Call WinRT to change position
    await invoke("media_seek", { position_ms: Math.round(positionMs) }).catch(() => {});

    // Maintain the lock for 1.2s to prevent poll overwrite while Windows updates
    seekTimerRef.current = setTimeout(() => {
      isSeekingRef.current = false;
    }, 1200);
  }, []);

  return { track, isPlaying, progress, duration, playPause, next, prev, seek };
}
