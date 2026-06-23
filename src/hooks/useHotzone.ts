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
  const lastIgnoreRef = useRef<boolean | null>(null);

  const setIgnoreEvents = (ignore: boolean) => {
    if (!isTauri()) return;
    if (lastIgnoreRef.current === ignore) return;
    lastIgnoreRef.current = ignore;
    getCurrentWindow().setIgnoreCursorEvents(ignore).catch(() => {});
  };

  // Keep mode ref in sync
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Keep ref in sync with state
  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      setIgnoreEvents(false);
    }
  }, [isOpen]);

  // Start as click-through so the transparent window doesn't block the desktop
  useEffect(() => {
    setIgnoreEvents(true);
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

        // Hover over the top center edge triggers expansion
        const inHotzone =
          pos.x >= centerX - hotZoneHalfWidth &&
          pos.x <= centerX + hotZoneHalfWidth &&
          pos.y <= hotZoneHeight;

        // Dynamic boundaries for expanded widget
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

        // Expanded widget mouse boundaries
        const inWidget =
          pos.x >= centerX - physicalWidgetHalfWidth &&
          pos.x <= centerX + physicalWidgetHalfWidth &&
          pos.y <= physicalWidgetHeight;

        // Collapsed notch boundary (200px wide, 28px high)
        const inCollapsedArea =
          pos.x >= centerX - (100 * scale) &&
          pos.x <= centerX + (100 * scale) &&
          pos.y <= 28 * scale;

        // The window should accept mouse inputs if it is expanded OR if the cursor is directly over the collapsed notch
        const shouldAcceptInput = isOpenRef.current ? inWidget : inCollapsedArea;
        setIgnoreEvents(!shouldAcceptInput);

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
