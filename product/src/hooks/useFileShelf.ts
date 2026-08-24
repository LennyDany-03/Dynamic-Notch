import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebview } from '@tauri-apps/api/webview'

export interface ShelfItem {
  path: string
  name: string
}

const MAX_ITEMS = 12

/**
 * How long the internal-drag guard outlives the drag itself.
 *
 * It has to outlive it at all because the drag events arrive *late*, and that is
 * not a nicety — it is the whole remaining bug. `SHDoDragDrop` blocks Tauri's
 * event loop for the entire drag (see `shelf.rs`, which runs it on the main
 * thread on purpose: OLE only tracks a drag on the thread owning the source
 * window). So the `enter`/`over` that Windows raises as the cursor crosses the
 * notch on its way out cannot be dispatched while they happen — they queue, and
 * the loop only resumes once the modal loop returns. `file-drag-ended` is emitted
 * from inside that closure, so it reaches the webview *first*, and the drag
 * events land a moment later on a guard that has already been cleared. The notch
 * then jumps to the shelf a fraction of a second after the file was dropped into
 * another app entirely, which is precisely what it looked like from the outside.
 *
 * 400ms is one event-loop turn several hundred times over, and the only thing it
 * costs is an external drag begun in the fraction of a second after Crest's own
 * drag ended — which is not a gesture a hand can make.
 */
const DRAG_SETTLE_MS = 400

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

const toItem = (path: string): ShelfItem => ({
  path,
  name: path.split(/[\\/]/).pop() || path,
})

/**
 * File Shelf drop target.
 *
 * Tauri intercepts HTML5 drag-and-drop at the webview level, so `ondrop` never
 * fires — the drop arrives as a webview drag-drop event instead.
 *
 * `onDragOver` exists because of how the overlay handles input: the window is
 * click-through whenever the cursor is off content, and even an 800ms dwell is
 * too long to hold a file at the top of the screen. Once a drag reaches the peeked
 * pill the window is accepting input, so the first drag event is used to jump
 * straight to the shelf rather than waiting the dwell out.
 *
 * This must stay mounted for the whole session, not just while the shelf is
 * visible, or a drag would have nothing listening when it arrives.
 */
export function useFileShelf(onDragOver: () => void) {
  const [items, setItems] = useState<ShelfItem[]>([])
  const [dragging, setDragging] = useState(false)
  const itemsRef = useRef<ShelfItem[]>([])
  itemsRef.current = items

  const onDragOverRef = useRef(onDragOver)
  onDragOverRef.current = onDragOver

  /**
   * Whether Crest itself is dragging a file *out* — a shelf tile, or a capture
   * from the screenshots card.
   *
   * This is the one thing the webview's drop target cannot work out for itself,
   * and getting it wrong is a real bug. `SHDoDragDrop` starts a genuine OS drag
   * from inside this very window, so the first thing the cursor crosses on its
   * way out is the notch — which arrives here as an ordinary `enter`/`over` and
   * is indistinguishable from a file being brought *in*. Two things followed:
   * dragging a screenshot lit up the shelf's "release to shelve" highlight and
   * jumped the card to the shelf, mid-drag, off the screenshots grid the user was
   * dragging from; and because the drop then lands in *another* app, the `leave`
   * that would have put the highlight back never arrived, so the shelf sat there
   * inviting a drop that had finished — for the life of the process, across every
   * later visit to the card.
   *
   * `native-file-drag` is the signal the two drag sources already dispatch for
   * `useHotzone` (which has the same problem from the other side — it must not
   * flip the window click-through mid-drag). Reusing it rather than inventing a
   * drag-scoped `dataTransfer` type is not a shortcut: Tauri intercepts HTML5
   * drag-and-drop at the webview level, so there is no `DragEvent` here to hang a
   * custom type on.
   *
   * It is held for `DRAG_SETTLE_MS` past the end of the drag rather than dropped
   * with it, because the events it has to swallow arrive *after* the drag is
   * over — see that constant, which is where the reasoning lives.
   */
  const internalDragRef = useRef(false)
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persist = useCallback(async (next: ShelfItem[]) => {
    if (!isTauri()) return
    try {
      await invoke('write_shelf', { paths: next.map((i) => i.path) })
    } catch (err) {
      console.error('shelf: save failed', err)
    }
  }, [])

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    invoke<string[]>('read_shelf')
      .then((paths) => {
        if (!cancelled) setItems(paths.map(toItem))
      })
      .catch((err) => console.error('shelf: load failed', err))
    return () => {
      cancelled = true
    }
  }, [])

  const addPaths = useCallback(
    (paths: string[]) => {
      setItems((current) => {
        const existing = new Set(current.map((i) => i.path))
        const added = paths.filter((p) => !existing.has(p)).map(toItem)
        // Newest first, oldest evicted once the shelf is full.
        const next = [...added, ...current].slice(0, MAX_ITEMS)
        persist(next)
        return next
      })
    },
    [persist],
  )

  const remove = useCallback(
    (path: string) => {
      setItems((current) => {
        const next = current.filter((i) => i.path !== path)
        persist(next)
        return next
      })
    },
    [persist],
  )

  const clear = useCallback(() => {
    setItems([])
    persist([])
  }, [persist])

  const open = useCallback(async (item: ShelfItem) => {
    if (!isTauri()) return
    try {
      await invoke('launch_app', { path: item.path })
    } catch (err) {
      console.error('shelf: open failed', err)
    }
  }, [])

  const startDrag = useCallback(async (item: ShelfItem) => {
    if (!isTauri()) return
    window.dispatchEvent(new CustomEvent<boolean>('native-file-drag', { detail: true }))
    try {
      // Resolves when the drag *starts*, not when it ends — the shell owns the
      // mouse from here, and `file-drag-ended` below reports the finish. The
      // window is raised to the foreground natively, on the same thread that
      // begins the drag, so no focus round-trip is needed first.
      await invoke('start_file_drag', { path: item.path })
    } catch (err) {
      console.error('shelf: could not start file drag', err)
      window.dispatchEvent(new CustomEvent<boolean>('native-file-drag', { detail: false }))
    }
  }, [])

  // The drag Crest started, seen from both ends. Not gated on `isTauri()`: the
  // event is a plain DOM one and the ref has to be right in the browser fallback
  // too, where `startDrag` returns early and never dispatches.
  useEffect(() => {
    const clearSettle = () => {
      if (settleRef.current) {
        clearTimeout(settleRef.current)
        settleRef.current = null
      }
    }

    const onInternalDrag = (event: Event) => {
      clearSettle()
      // Cleared on *both* edges rather than only on the start. The end is the one
      // that matters: the drop happens in another app, so the `leave` that would
      // otherwise put this back never arrives, and the shelf was left inviting a
      // drop that had already finished.
      setDragging(false)

      if ((event as CustomEvent<boolean>).detail) {
        internalDragRef.current = true
        return
      }

      // The drag is over, but the events it raised are not necessarily in yet —
      // they were queued behind a blocked event loop. Keep swallowing them.
      settleRef.current = setTimeout(() => {
        settleRef.current = null
        internalDragRef.current = false
        setDragging(false)
      }, DRAG_SETTLE_MS)
    }

    window.addEventListener('native-file-drag', onInternalDrag)
    return () => {
      window.removeEventListener('native-file-drag', onInternalDrag)
      clearSettle()
    }
  }, [])

  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | undefined
    let cancelled = false

    listen('file-drag-ended', () => {
      window.dispatchEvent(new CustomEvent<boolean>('native-file-drag', { detail: false }))
    })
      .then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      })
      .catch((err) => console.error('shelf: could not watch drag end', err))

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | undefined
    let cancelled = false

    getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload
        // A drag Crest is running is not a file arriving, whatever it looks like
        // from here. Every type is ignored, the drop included: a tile dragged out
        // and released back onto the notch is a cancelled drag, not a request to
        // shelve the thing that was already on the shelf.
        if (internalDragRef.current) return
        if (payload.type === 'enter' || payload.type === 'over') {
          setDragging(true)
          onDragOverRef.current()
          return
        }
        if (payload.type === 'drop') {
          setDragging(false)
          if (payload.paths?.length) {
            onDragOverRef.current()
            addPaths(payload.paths)
          }
          return
        }
        setDragging(false)
      })
      .then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      })
      .catch((err) => console.error('shelf: could not attach drop listener', err))

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [addPaths])

  return { items, dragging, addPaths, remove, clear, open, startDrag }
}

export type FileShelfState = ReturnType<typeof useFileShelf>
