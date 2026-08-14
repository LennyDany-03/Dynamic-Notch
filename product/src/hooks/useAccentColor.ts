import { useEffect } from 'react'

/**
 * Paint the `accentColor` preference onto this window's `:root`.
 *
 * The exact counterpart of `useSurfaceOpacity`, and for the same reasons. The
 * accent is read by around twenty components spread across three windows — the
 * scrub bar, the toggles, every active glyph, the tray's app mark, the settings
 * sliders — and threading a hex value through all of them would put a preference
 * into every component that happens to draw something active. One variable on
 * `:root` and every `color.accent` reader follows for free, because `tokens.ts`
 * hands them `var(--accent)` rather than a literal.
 *
 * Only `--accent` is written. `--accent-bright` and the two washes are derived
 * from it in `index.css` with `color-mix`, so a custom hue keeps the same
 * relationships the design export had between them instead of pinning three
 * independent colours that a user could put out of step with each other.
 *
 * Every window calls this for itself: each has its own webview and its own
 * `:root`, and each reads the same preference through `useSettings`, which Rust
 * broadcasts to all of them.
 *
 * Not cleaned up on unmount, as with the opacity: the variable is window-scoped
 * state and the only thing that unmounts here is a whole window's root.
 */
export function useAccentColor(hex: string) {
  useEffect(() => {
    // Rust validates and normalises before storing, so anything arriving here is
    // already a `#rrggbb`. A malformed value would simply fail to parse as a CSS
    // colour and leave the previous accent standing, which is the right failure.
    document.documentElement.style.setProperty('--accent', hex)
  }, [hex])
}
