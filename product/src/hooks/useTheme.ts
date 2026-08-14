import { useEffect } from 'react'
import type { ThemeId } from './useSettings'

/**
 * Paint the `theme` preference onto this window's `:root`.
 *
 * The third hook of its kind, after `useSurfaceOpacity` and `useAccentColor`, and
 * for the same reasons — except that this one writes an *attribute* rather than a
 * variable, because a theme is a whole palette rather than one value. `index.css`
 * keys a block of custom properties off it and every `var()` in `tokens.ts`
 * follows, so no component knows the preference exists.
 *
 * An attribute and not a class: the palette blocks are also what draw the theme
 * picker's preview cards, and `[data-theme='ember']` on a card reads as "this
 * subtree is Ember" in a way a class name does not. It is also what lets the CSS
 * derive the accent per subtree — see the derivation block in `index.css`.
 *
 * Every window calls this for itself: each has its own webview and its own
 * `:root`, and each reads the same preference through `useSettings`, which Rust
 * broadcasts to all of them.
 *
 * Not cleaned up on unmount, as with the other two: the attribute is
 * window-scoped state and the only thing that unmounts here is a whole window's
 * root.
 */
export function useTheme(theme: ThemeId) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
}
