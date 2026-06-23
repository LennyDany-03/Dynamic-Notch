import { useEffect, useRef, useState } from "react";
import { cursorPosition, primaryMonitor, getCurrentWindow } from "@tauri-apps/api/window";

export function useHotzone() {
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpenRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    isOpenRef.current = isOpen;
    const win = getCurrentWindow();
    if (isOpen) {
      win.setIgnoreCursorEvents(false).catch(() => {});
    } else {
      win.setIgnoreCursorEvents(true).catch(() => {});
    }
  }, [isOpen]);

  // Start as click-through so the transparent window doesn't block the desktop
  useEffect(() => {
    getCurrentWindow().setIgnoreCursorEvents(true).catch(() => {});
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const checkCursor = async () => {
      try {
        const pos = await cursorPosition();
        const monitor = await primaryMonitor();
        if (!monitor) return;

        const screenWidth = monitor.size.width;
        const centerX = screenWidth / 2;
        const hotZoneHalfWidth = 110; // 220px total
        const hotZoneHeight = 8;

        const inHotzone =
          pos.x >= centerX - hotZoneHalfWidth &&
          pos.x <= centerX + hotZoneHalfWidth &&
          pos.y <= hotZoneHeight;

        // Stay open while cursor is within the widget area
        const inWidget =
          pos.x >= centerX - 280 &&
          pos.x <= centerX + 280 &&
          pos.y <= 90;

        if (inHotzone && !isOpenRef.current) {
          if (!timerRef.current) {
            timerRef.current = setTimeout(() => {
              timerRef.current = null;
              setIsOpen(true);
            }, 50);
          }
          if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
          }
        } else if (!inHotzone && !inWidget && isOpenRef.current) {
          if (!closeTimerRef.current) {
            closeTimerRef.current = setTimeout(() => {
              closeTimerRef.current = null;
              setIsOpen(false);
            }, 800);
          }
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        } else if (!inHotzone && !isOpenRef.current) {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        } else if (inWidget && isOpenRef.current) {
          // Cancel any pending close timer while still hovering widget
          if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
          }
        }
      } catch (_) {}
    };

    interval = setInterval(checkCursor, 100);

    return () => {
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return { isOpen };
}
