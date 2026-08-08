import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/**
 * Mirrors `Settings` in `src-tauri/src/settings.rs`, minus `bannersRestore` —
 * that field is Rust's memo of what the shell's banner switch was before Crest
 * touched it, not a preference, and nothing here has any business reading it.
 */
export interface Settings {
  alwaysOnTop: boolean
  notifications: boolean
  muteWindowsBanners: boolean
  /** Opacity of every Mica surface, as a percentage. See `useSurfaceOpacity`. */
  backgroundOpacity: number
}

/**
 * Matches the Rust defaults. Spread over whatever comes back from disk so a field
 * added on the Rust side but missing from an old file still renders something,
 * and so the browser fallback (where `invoke` rejects) has a coherent state.
 *
 * `backgroundOpacity` has a third copy in `index.css` (the `--mica-alpha`
 * fallback); all three have to agree or the surface visibly corrects itself once
 * the real value lands.
 */
const DEFAULTS: Settings = {
  alwaysOnTop: true,
  notifications: true,
  muteWindowsBanners: false,
  backgroundOpacity: 92,
}

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

  return {
    settings,
    loaded,
    error,
    setAlwaysOnTop,
    setNotifications,
    setMuteWindowsBanners,
    setBackgroundOpacity,
  }
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
