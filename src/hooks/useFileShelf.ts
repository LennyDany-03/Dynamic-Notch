import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { getCurrentWindow } from '@tauri-apps/api/window'

export interface ShelfItem {
  path: string
  name: string
}

const MAX_ITEMS = 12

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
 * click-through whenever the cursor is off content, and a 1.5s dwell is far too
 * long to hold a file at the top of the screen. Once a drag reaches the peeked
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
      // OLE drag/drop only begins from the foreground source window. The notch
      // normally avoids focus so it stays unobtrusive; make this one gesture an
      // explicit exception before handing it to Windows.
      await getCurrentWindow().setFocus()
      await invoke('start_file_drag', { path: item.path })
    } catch (err) {
      console.error('shelf: could not start file drag', err)
    } finally {
      window.dispatchEvent(new CustomEvent<boolean>('native-file-drag', { detail: false }))
    }
  }, [])

  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | undefined
    let cancelled = false

    getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload
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
