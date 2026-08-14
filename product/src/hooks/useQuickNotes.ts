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

  /**
   * Start a new note — unless the one already open is blank, in which case that
   * *is* the new note and this only puts the caret back in it.
   *
   * Without the guard, "+" on an empty note makes a second empty note, and the
   * switcher fills up with identical "Untitled" entries that all have to be
   * deleted by hand. Clicking a button twice is not a request for two of
   * something when the first one was never used.
   */
  const addNote = useCallback(() => {
    const current = notesRef.current.find((note) => note.id === activeId)
    if (current && current.body.trim().length === 0) return

    const note = newNote()
    // Newest first, so the active note is always notes[0] on next load.
    setNotes((existing) => [note, ...existing])
    setActiveId(note.id)
  }, [activeId])

  const selectNote = useCallback((id: string) => setActiveId(id), [])

  /**
   * Delete a note, and make sure there is still one to type into.
   *
   * The list is never allowed to be empty — the pane's whole purpose is a place
   * to start typing, and an empty state offering a "new note" button would be one
   * click of ceremony in front of a text field. Deleting the last note therefore
   * replaces it with a blank one rather than leaving nothing.
   */
  const deleteNote = useCallback((id: string) => {
    setNotes((current) => {
      const next = current.filter((note) => note.id !== id)
      const kept = next.length > 0 ? next : [newNote()]

      setActiveId((active) => {
        if (active !== id) return active
        // Selection moves to the note that took its place in the list, falling
        // back to the new last one — the same thing a text editor does when you
        // close a tab, and it keeps the pane usable without a second click.
        const index = current.findIndex((note) => note.id === id)
        return (kept[Math.min(index, kept.length - 1)] ?? kept[0]).id
      })

      return kept
    })
  }, [])

  return { activeNote, activeId, notes, loaded, updateActive, addNote, selectNote, deleteNote }
}

/**
 * Everything on disk, read once, for somewhere that is not the notes pane.
 *
 * A second hook rather than a flag on `useQuickNotes`, because the two have
 * opposite responsibilities: that one owns the notes and writes them, this one
 * only looks. Mounting the writer in the settings window to render a list would
 * put a debounced autosave behind a viewer — and with two writers live, whichever
 * rendered last would win the file.
 *
 * `reload` rather than a poll: the settings window is not where notes are typed,
 * and the one moment the list can be stale is the moment it is opened.
 */
export function useSavedNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    try {
      if (isTauri()) {
        const file = await invoke<{ notes: Note[] }>('read_notes')
        setNotes(file?.notes ?? [])
      } else {
        setNotes(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'))
      }
    } catch (err) {
      console.error('quick notes: read failed', err)
      setNotes([])
    } finally {
      setLoaded(true)
    }
  }, [])

  return { notes, loaded, reload }
}

/**
 * The first line of a note, for the list.
 *
 * A note has no title field on purpose — asking for one before you can write
 * anything down is exactly the friction "quick notes" exists to avoid — so the
 * first non-empty line stands in, the way every notes app does it. Trimmed hard,
 * because the list column is narrow and a line that ellipsises at its own
 * leading whitespace looks broken.
 */
export function noteTitle(note: Note): string {
  const line = note.body.split('\n').find((candidate) => candidate.trim().length > 0)
  // "Untitled" rather than "Empty note": the switcher shows this next to real
  // titles, and "Empty note" reads as a description of a problem where this is
  // just a note nobody has typed into yet.
  return line?.trim() ?? 'Untitled'
}
