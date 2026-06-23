import { useEffect, useRef, useState } from "react";
import { cursorPosition, primaryMonitor, getCurrentWindow } from "@tauri-apps/api/window";

const isTauri = () =>
  !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;

export function useHotzone(mode: "idle" | "peek" | "expanded") {
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpenRef = useRef(false);
  const modeRef = useRef(mode);

  // Keep mode ref in sync
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Keep ref in sync with state
  useEffect(() => {
    isOpenRef.current = isOpen;
    if (!isTauri()) return;
    const win = getCurrentWindow();
    if (isOpen) {
      win.setIgnoreCursorEvents(false).catch(() => {});
    } else {
      win.setIgnoreCursorEvents(true).catch(() => {});
    }
  }, [isOpen]);

  // Start as click-through so the transparent window doesn't block the desktop
  useEffect(() => {
    if (!isTauri()) return;
    getCurrentWindow().setIgnoreCursorEvents(true).catch(() => {});
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const checkCursor = async () => {
      try {
        const pos = await cursorPosition();
        const monitor = await primaryMonitor();
        if (!monitor) return;

        const scale = monitor.scaleFactor || 1.0;
        const screenWidth = monitor.size.width;
        const centerX = screenWidth / 2;
        const hotZoneHalfWidth = 110 * scale; // 220px total
        const hotZoneHeight = 8 * scale;

        const inHotzone =
          pos.x >= centerX - hotZoneHalfWidth &&
          pos.x <= centerX + hotZoneHalfWidth &&
          pos.y <= hotZoneHeight;

        // Dynamic boundaries based on widget state
        let widgetHeight = 90;
        let widgetHalfWidth = 280;

        const currentMode = modeRef.current;
        if (currentMode === "expanded") {
          widgetHeight = 420;
          widgetHalfWidth = 270;
        } else if (currentMode === "peek") {
          widgetHeight = 110;
          widgetHalfWidth = 190;
        } else {
          widgetHeight = 90;
          widgetHalfWidth = 130;
        }

        const physicalWidgetHeight = widgetHeight * scale;
        const physicalWidgetHalfWidth = widgetHalfWidth * scale;

        // Stay open while cursor is within the active widget area
        const inWidget =
          pos.x >= centerX - physicalWidgetHalfWidth &&
          pos.x <= centerX + physicalWidgetHalfWidth &&
          pos.y <= physicalWidgetHeight;

        if (inHotzone && !isOpenRef.current) {
          if (!timerRef.current) {
            timerRef.current = setTimeout(() => {
              timerRef.current = null;
              setIsOpen(true);
            }, 10);
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
            }, 10);
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

    interval = setInterval(checkCursor, 20);

    return () => {
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return { isOpen, setIsOpen };
}
