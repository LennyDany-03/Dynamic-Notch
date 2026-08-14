import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { PanelPref } from '../types/notch'
import type { Place, WeatherPlace } from '../types/weather'

/**
 * Mirrors `Settings` in `src-tauri/src/settings.rs`, minus `bannersRestore` —
 * that field is Rust's memo of what the shell's banner switch was before Crest
 * touched it, not a preference, and nothing here has any business reading it.
 */
/** Where along the top edge the notch sits. Mirrors `NotchPosition` in Rust. */
export type NotchPosition = 'left' | 'center' | 'right'

export interface Settings {
  alwaysOnTop: boolean
  notifications: boolean
  /**
   * Whether the notch reports the machine's own state — a charger going in or
   * out, a Bluetooth device connecting, the network changing, or the CPU, memory,
   * GPU or disk sitting pinned at the top of its range.
   *
   * Gates the *announcing* only. Both polls behind it keep running whatever it
   * says, because both feed something that is drawn regardless: the charge on the
   * pill, and the meters on the system monitor. What it does switch off is the
   * expensive half of each — the Bluetooth device enumeration in
   * `useSystemStatus`, and every alert rule in `usePerformance`.
   */
  systemAlerts: boolean
  muteWindowsBanners: boolean
  /** Opacity of every Mica surface, as a percentage. See `useSurfaceOpacity`. */
  backgroundOpacity: number
  /**
   * Rust moves the overlay window for this; the notch never reads it to lay
   * anything out. Settings reads it because it draws the picker.
   */
  notchPosition: NotchPosition
  /** Whether the trigger strip is marked while the notch is away. */
  hotzoneHint: boolean
  /**
   * The accent, as `#RRGGBB`. Painted onto each window's `:root` by
   * `useAccentColor`; nothing reads it directly except the picker.
   */
  accentColor: string
  /**
   * Which cards the notch offers, and in what order. Empty means never set —
   * `resolvePanels` falls back to `MODULES` and reconciles from there.
   */
  panels: PanelPref[]
  /** Where the weather module looks, or null until the user picks somewhere. */
  weatherPlace: WeatherPlace | null
}

/**
 * Matches the Rust defaults. Spread over whatever comes back from disk so a field
 * added on the Rust side but missing from an old file still renders something,
 * and so the browser fallback (where `invoke` rejects) has a coherent state.
 *
 * `backgroundOpacity` and `accentColor` each have a third copy in `index.css`
 * (the `--mica-alpha` and `--accent` fallbacks); all three have to agree in both
 * cases or the surface visibly corrects itself once the real value lands.
 */
const DEFAULTS: Settings = {
  alwaysOnTop: true,
  notifications: true,
  systemAlerts: true,
  muteWindowsBanners: false,
  backgroundOpacity: 92,
  notchPosition: 'center',
  hotzoneHint: true,
  accentColor: '#7C3AED',
  // Empty rather than a copy of `MODULES`: that list is the frontend's own and
  // duplicating it here would give the default two places to disagree.
  panels: [],
  weatherPlace: null,
}

/**
 * The swatches offered before the hex field.
 *
 * Eight, spread around the wheel, all at roughly the accent's own lightness and
 * saturation — the design was drawn against a mid-violet on a near-black Mica
 * surface, and a pastel or a near-black accent would fail the contrast the rest
 * of the palette assumes. A user who genuinely wants one can still type it; this
 * is the set that is guaranteed to look like the app.
 */
export const ACCENT_SWATCHES: { hex: string; name: string }[] = [
  { hex: '#7C3AED', name: 'Violet' },
  { hex: '#2563EB', name: 'Blue' },
  { hex: '#0891B2', name: 'Teal' },
  { hex: '#059669', name: 'Green' },
  { hex: '#CA8A04', name: 'Amber' },
  { hex: '#EA580C', name: 'Orange' },
  { hex: '#DC2626', name: 'Red' },
  { hex: '#DB2777', name: 'Pink' },
]

/** The position picker's options, in the order they are drawn. */
export const NOTCH_POSITIONS: { id: NotchPosition; label: string }[] = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
]

/**
 * Bounds for the opacity slider. Mirrors `OPACITY_MIN`/`OPACITY_MAX` in
 * `settings.rs`, which clamps anyway — this is so the control cannot ask for a
 * value it would be handed back a different answer for.
 */
export const OPACITY = { min: 60, max: 100, step: 2 } as const

/**
 * The settings window's state. Rust owns the file and the window flags; this only
 * mirrors them.
 *
 * Writes are optimistic — a switch has to move under the pointer — and reconcile
 * against the state Rust reports actually reaching, so a failed write snaps the
 * switch back instead of leaving it lying.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [error, setError] = useState<string | null>(null)

  /**
   * False until the first read settles, either way.
   *
   * `DEFAULTS` is a guess, and the notch acts on this hook — it would put the
   * pill on screen on the strength of that guess and snatch it back a frame
   * later for everyone who had the preference off. Callers whose behaviour is
   * visible should wait for the real value; it arrives within a frame or two.
   */
  const [loaded, setLoaded] = useState(false)

  const read = useCallback(() => {
    void invoke<Settings>('read_settings')
      .then((stored) => setSettings({ ...DEFAULTS, ...stored }))
      .catch(() => setSettings(DEFAULTS))
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => read(), [read])

  // The window is hidden and reshown rather than rebuilt, so React never remounts.
  // Re-reading per open is what keeps it honest about changes made elsewhere.
  useEffect(() => {
    const pending = listen('settings-opened', () => {
      setError(null)
      read()
    })
    return () => {
      void pending.then((unlisten) => unlisten())
    }
  }, [read])

  // Rust broadcasts every accepted change. That is what carries a preference to a
  // window that did not make it — the notch reads this hook too, and the switch it
  // has to obey lives in another window entirely.
  useEffect(() => {
    const pending = listen<Settings>('settings-changed', (event) => {
      setSettings({ ...DEFAULTS, ...event.payload })
    })
    return () => {
      void pending.then((unlisten) => unlisten())
    }
  }, [])

  /**
   * Optimistic write, reconciled against what Rust reports actually reaching.
   *
   * `args` is passed separately from the value because the commands name their
   * parameter after what it is (`enabled`, `percent`), and the returned value is
   * not always the one asked for — an out-of-range opacity comes back clamped.
   *
   * The failure message comes from Rust when it has one to give: refusing to
   * silence Windows' banners is a decision with a reason ("nothing would show
   * them"), and "Couldn't save that setting" would throw the reason away.
   */
  const write = useCallback(
    <K extends keyof Settings>(
      command: string,
      key: K,
      value: Settings[K],
      args: Record<string, unknown>,
    ) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
      setError(null)

      void invoke<Settings[K]>(command, args)
        .then((reached) => setSettings((prev) => ({ ...prev, [key]: reached })))
        .catch((reason) => {
          setError(typeof reason === 'string' && reason ? reason : "Couldn't save that setting.")
          // Re-read rather than invert the request. Rust only updates its
          // in-memory copy once the change has landed, so a refused write leaves
          // the authoritative value sitting there — and a numeric preference has
          // no inverse to guess at in the first place.
          read()
        })
    },
    [read],
  )

  const setAlwaysOnTop = useCallback(
    (enabled: boolean) => write('set_always_on_top', 'alwaysOnTop', enabled, { enabled }),
    [write],
  )

  const setNotifications = useCallback(
    (enabled: boolean) => write('set_notifications', 'notifications', enabled, { enabled }),
    [write],
  )

  const setSystemAlerts = useCallback(
    (enabled: boolean) => write('set_system_alerts', 'systemAlerts', enabled, { enabled }),
    [write],
  )

  const setMuteWindowsBanners = useCallback(
    (enabled: boolean) =>
      write('set_mute_windows_banners', 'muteWindowsBanners', enabled, { enabled }),
    [write],
  )

  const setBackgroundOpacity = useCallback(
    (percent: number) =>
      write('set_background_opacity', 'backgroundOpacity', percent, { percent }),
    [write],
  )

  const setNotchPosition = useCallback(
    (position: NotchPosition) =>
      write('set_notch_position', 'notchPosition', position, { position }),
    [write],
  )

  const setHotzoneHint = useCallback(
    (enabled: boolean) => write('set_hotzone_hint', 'hotzoneHint', enabled, { enabled }),
    [write],
  )

  const setAccentColor = useCallback(
    (hex: string) => write('set_accent_color', 'accentColor', hex, { hex }),
    [write],
  )

  const setPanels = useCallback(
    (panels: PanelPref[]) => write('set_panels', 'panels', panels, { panels }),
    [write],
  )

  const setWeatherPlace = useCallback(
    (place: WeatherPlace | null) => write('set_weather_place', 'weatherPlace', place, { place }),
    [write],
  )

  return {
    settings,
    loaded,
    error,
    setAlwaysOnTop,
    setNotifications,
    setSystemAlerts,
    setMuteWindowsBanners,
    setBackgroundOpacity,
    setNotchPosition,
    setHotzoneHint,
    setAccentColor,
    setPanels,
    setWeatherPlace,
  }
}

/**
 * Debounced place search for the weather location picker.
 *
 * Debounced because the control is a text field and the backend is somebody
 * else's free service: typing "Chennai" would otherwise be seven geocoder
 * requests, six of which are for prefixes nobody wants an answer to.
 *
 * A sequence number rather than an abort: `invoke` has nothing to cancel, and two
 * searches in flight can land out of order — the shorter query is usually the
 * faster one, so without this the list settles on the results for "Chen" a beat
 * after showing the right ones for "Chennai".
 */
export function usePlaceSearch(query: string) {
  const [results, setResults] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const sequence = useRef(0)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setSearching(false)
      return
    }

    const ticket = ++sequence.current
    setSearching(true)

    const timer = setTimeout(() => {
      void invoke<Place[]>('search_places', { query: trimmed })
        .then((found) => {
          if (ticket === sequence.current) setResults(found)
        })
        .catch(() => {
          if (ticket === sequence.current) setResults([])
        })
        .finally(() => {
          if (ticket === sequence.current) setSearching(false)
        })
    }, 350)

    return () => clearTimeout(timer)
  }, [query])

  return { results, searching }
}

/** Where notes are written. Mirrors `NotesLocation` in `src-tauri/src/notes.rs`. */
export interface NotesLocation {
  directory: string
  file: string
  exists: boolean
}

/**
 * Where Quick Notes are saved, for Settings to show.
 *
 * Read per open rather than once, like `useNotificationAccess`: the file comes
 * into existence the first time anything is typed, and someone who opens Settings
 * to ask "where does this go" and then goes and writes a note should not have to
 * relaunch to see `exists` flip.
 */
export function useNotesLocation(): NotesLocation | null {
  const [location, setLocation] = useState<NotesLocation | null>(null)

  const read = useCallback(() => {
    void invoke<NotesLocation>('notes_location')
      .then(setLocation)
      .catch(() => setLocation(null))
  }, [])

  useEffect(() => read(), [read])

  useEffect(() => {
    const pending = listen('settings-opened', read)
    return () => {
      void pending.then((unlisten) => unlisten())
    }
  }, [read])

  return location
}

/**
 * Whether Windows will let Crest read the notification centre.
 *
 * A separate hook because it is not a preference and not stored: it is a privacy
 * setting the user can revoke at any time, from outside this app. Settings shows
 * it because the notification rows are inert without it, and because Rust refuses
 * to silence Windows' banners while it is false — this is what explains that
 * refusal before the user meets it.
 */
export function useNotificationAccess(): boolean | null {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  const read = useCallback(() => {
    void invoke<boolean>('notifications_available')
      .then(setAllowed)
      .catch(() => setAllowed(false))
  }, [])

  useEffect(() => read(), [read])

  // Re-read per open: the user may have just been sent to Windows' own settings
  // to grant this, and the window is reshown rather than remounted.
  useEffect(() => {
    const pending = listen('settings-opened', read)
    return () => {
      void pending.then((unlisten) => unlisten())
    }
  }, [read])

  return allowed
}
