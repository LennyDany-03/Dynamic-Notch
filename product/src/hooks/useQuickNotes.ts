import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface Note {
  id: string
  body: string
  updatedAt: number
}

const AUTOSAVE_DEBOUNCE_MS = 400
const STORAGE_KEY = 'dynamic-notch-notes'

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

const newNote = (): Note => ({
  id: crypto.randomUUID(),
  body: '',
  updatedAt: Date.now(),
})

/**
 * Quick Notes state, backed by a JSON file in the app-data dir.
 *
 * Autosave is debounced so a burst of keystrokes is one disk write, and a final
 * flush runs on unmount so the last edit is never dropped. Outside Tauri it falls
 * back to localStorage so the pane still works in a browser.
 */
export function useQuickNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest notes, readable by the unmount flush without making it a dependency.
  const notesRef = useRef<Note[]>([])
  notesRef.current = notes

  const persist = useCallback(async (next: Note[]) => {
    try {
      if (isTauri()) {
        await invoke('write_notes', { notes: next })
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      }
    } catch (err) {
      console.error('quick notes: save failed', err)
    }
  }, [])

  // Initial load.
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      let stored: Note[] = []
      try {
        if (isTauri()) {
          const file = await invoke<{ notes: Note[] }>('read_notes')
          stored = file?.notes ?? []
        } else {
          stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
        }
      } catch (err) {
        console.error('quick notes: load failed', err)
      }
      if (cancelled) return

      // Always have something to type into.
      const initial = stored.length > 0 ? stored : [newNote()]
      setNotes(initial)
      setActiveId(initial[0].id)
      setLoaded(true)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Debounced autosave. Skipped until the initial load lands, so an empty
  // starting state can never overwrite what is on disk.
  useEffect(() => {
    if (!loaded) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      persist(notesRef.current)
    }, AUTOSAVE_DEBOUNCE_MS)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [notes, loaded, persist])

  // Flush on unmount so a pending debounce is not lost.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        persist(notesRef.current)
      }
    }
  }, [persist])

  const activeNote = notes.find((n) => n.id === activeId) ?? null

  const updateActive = useCallback(
    (body: string) => {
      setNotes((current) =>
        current.map((note) =>
          note.id === activeId ? { ...note, body, updatedAt: Date.now() } : note,
        ),
      )
    },
    [activeId],
  )

  const addNote = useCallback(() => {
    const note = newNote()
    // Newest first, so the active note is always notes[0] on next load.
    setNotes((current) => [note, ...current])
    setActiveId(note.id)
  }, [])

  return { activeNote, notes, loaded, updateActive, addNote }
}
