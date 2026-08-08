import { useEffect } from 'react'

/**
 * Paint the `backgroundOpacity` preference onto this window's Mica surfaces.
 *
 * A CSS variable rather than an inline style on each card, because `.mica` is a
 * transcription of the design file and its base fill is one declaration used by
 * four different windows' worth of surfaces — the notch's cards, the collapsed
 * pill, the tray popup, the context menu and the settings window. Threading a
 * number through all of them to change one alpha would put the preference in
 * every component that happens to draw a surface.
 *
 * Every window calls this for itself. There is no cross-window CSS: each has its
 * own webview and its own `:root`, and each reads the same preference through
 * `useSettings`, which Rust broadcasts to all of them.
 *
 * Not cleaned up on unmount on purpose — the variable is window-scoped state, and
 * the only component that unmounts here is a whole window's root.
 */
export function useSurfaceOpacity(percent: number) {
  useEffect(() => {
    document.documentElement.style.setProperty('--mica-alpha', String(percent / 100))
  }, [percent])
}
