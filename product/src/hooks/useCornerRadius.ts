import { useEffect } from 'react'

/**
 * Paint the `cornerRadius` preference onto this window's Mica shells.
 *
 * The third preference of exactly this shape, after `useSurfaceOpacity` and
 * `useAccentColor`, and it works identically: one custom property on `:root`,
 * read by every surface through `radius.shell` in `tokens.ts`, so no component
 * knows a preference exists. Every window calls this for itself — each has its own
 * webview and its own `:root`, and each reads the same broadcast value.
 *
 * The unit is added here rather than stored: the preference is a number of pixels,
 * and `borderRadius: 'var(--radius-shell)'` needs a length. Keeping the `px` on
 * this side means the stored value stays a number that can be clamped in Rust and
 * dragged on a slider.
 *
 * Not cleaned up on unmount, as with the other two — the variable is window-scoped
 * state and the only thing that unmounts here is a whole window's root.
 */
export function useCornerRadius(px: number) {
  useEffect(() => {
    document.documentElement.style.setProperty('--radius-shell', `${px}px`)
  }, [px])
}
