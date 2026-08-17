/** One recent screenshot. Mirrors `Shot` in `src-tauri/src/screenshots.rs`. */
export interface Screenshot {
  /**
   * Absolute path, and the id.
   *
   * A path rather than a generated id because there is nothing to generate one
   * *from*: the list is a view over the user's own folders (see `screenshots.rs`),
   * re-derived on every poll and stored nowhere, so the only stable handle on a
   * capture is where it lives. It is also what both actions take — opening it and
   * dragging it out are both the shell being handed a filesystem object.
   */
  path: string
  name: string
  /** Unix millis, from the file's modified time. */
  capturedAt: number
}
