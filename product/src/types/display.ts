/**
 * A connected screen. Mirrors `DisplayInfo` in `src-tauri/src/display.rs`.
 *
 * The geometry is physical, in virtual-desktop coordinates — the same space
 * Windows' own display settings arranges its numbered rectangles in. Nothing on
 * this side uses the absolute values: the picker draws the screens relative to
 * each other, because two monitors side by side and two stacked are the same two
 * rows of text and completely different desktops.
 */
export interface DisplayInfo {
  /** Opaque monitor key — the adapter's device name (`\\.\DISPLAY1`). */
  id: string
  /** What to call it: "Display 1", or whatever the driver reported. */
  name: string
  primary: boolean
  x: number
  y: number
  width: number
  height: number
  scale: number
  /**
   * Whether the notch is on this screen *right now* — resolved in Rust rather
   * than compared against the stored preference here. That is what makes the
   * disconnect fallback visible: someone who picked a monitor that is currently
   * unplugged sees the notch marked on their primary, which is where it is.
   */
  active: boolean
}
