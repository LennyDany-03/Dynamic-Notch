import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  DEFAULT_QUICK_ACCESS_DEVICES,
  type QuickAccessDevice,
  type QuickAccessDeviceType,
} from '../types/devices'

/**
 * The machine's audio endpoints, and the one call that re-points a role at one.
 *
 * There is no stored preference here and there deliberately never will be. The
 * *Windows* default is the setting — `set_default_audio_device` moves it and
 * `isDefault` reads it back — so Crest keeps no copy that could disagree with
 * the volume flyout, a headset being unplugged, or another app switching the
 * default out from under it. That is also why `assign` re-reads rather than
 * setting local state optimistically: the invoke resolves only after Core Audio
 * has accepted the change, so the very next read is already correct and a
 * guess in between could only ever be wrong.
 *
 * Polled while the card is on screen rather than watched. `IMMNotificationClient`
 * is the event-driven answer and it needs a live COM callback object parked on a
 * thread for the life of the process; this card is visible for a few seconds at a
 * time, so a poll that exists only while it is mounted is the cheaper half of
 * that trade. State is set only when something *drawn* moves, or the rows would
 * re-render on a 2s timer under the cursor.
 */

/** Matches the notification and system polls — cheap, and fast enough that
 *  plugging a headset in while the card is open lands within a blink. */
const POLL_MS = 2000

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

interface NativeAudioDevice {
  id: string
  name: string
  deviceType: QuickAccessDeviceType
  isDefault: boolean
}

/** Everything the card draws, in order, so a poll can skip a render. */
const signature = (devices: QuickAccessDevice[]) =>
  devices.map((device) => `${device.type}:${device.id}:${device.name}:${device.isDefault}`).join('|')

async function readBrowserDevices(): Promise<QuickAccessDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [...DEFAULT_QUICK_ACCESS_DEVICES]

  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const mapped: QuickAccessDevice[] = devices
      .filter((device) => device.kind === 'audioinput' || device.kind === 'audiooutput')
      .map((device) => ({
        id: device.deviceId || `system-${device.kind}`,
        name: device.label || (device.kind === 'audioinput' ? 'System microphone' : 'System audio'),
        type: device.kind === 'audioinput' ? 'microphone' : 'speakers',
        isDefault: false,
      }))

    // Chromium commonly exposes microphones before it exposes output devices.
    // Falling back only when *nothing* was found meant a detected microphone
    // accidentally removed both speaker rows. Reconcile each role separately.
    const withFallbacks = [...mapped]
    for (const fallback of DEFAULT_QUICK_ACCESS_DEVICES) {
      if (!withFallbacks.some((device) => device.type === fallback.type)) {
        withFallbacks.push(fallback)
      }
    }
    return withFallbacks
  } catch {
    return [...DEFAULT_QUICK_ACCESS_DEVICES]
  }
}

export interface QuickAccessFeed {
  devices: QuickAccessDevice[]
  /** False until the first read settles. An empty card before that means "not yet". */
  loaded: boolean
  /** Core Audio refused. The card says so rather than drawing plausible rows. */
  unavailable: boolean
  /** The last failed assignment, for the card to show and the next one to clear. */
  error: string | null
  /** The endpoint currently carrying this role, or undefined if there is none. */
  activeId: (type: QuickAccessDeviceType) => string | undefined
  assign: (type: QuickAccessDeviceType, deviceId: string) => void
}

export function useQuickAccessDevices(): QuickAccessFeed {
  const [devices, setDevices] = useState<QuickAccessDevice[]>([])
  const [loaded, setLoaded] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The browser fallback has no Windows default to read back, so the selection
  // it shows lives here for the session. Never persisted: nothing was actually
  // routed, and a choice that survived a reload would claim otherwise.
  const [fallbackSelection, setFallbackSelection] = useState<
    Partial<Record<QuickAccessDeviceType, string>>
  >({})

  const signatureRef = useRef('')

  const read = useCallback(async () => {
    if (!isTauri()) {
      const next = await readBrowserDevices()
      if (signatureRef.current !== signature(next)) {
        signatureRef.current = signature(next)
        setDevices(next)
      }
      setLoaded(true)
      return
    }

    try {
      const native = await invoke<NativeAudioDevice[]>('list_audio_devices')
      const next: QuickAccessDevice[] = native.map((device) => ({
        id: device.id,
        name: device.name,
        type: device.deviceType,
        isDefault: device.isDefault,
      }))
      if (signatureRef.current !== signature(next)) {
        signatureRef.current = signature(next)
        setDevices(next)
      }
      setUnavailable(false)
    } catch {
      setUnavailable(true)
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    const tick = () => {
      if (!cancelled) void read()
    }

    tick()
    const id = setInterval(tick, POLL_MS)
    // Chromium raises this without a permission for the *count* changing, which
    // is the case that matters here; the poll covers everything it misses.
    navigator.mediaDevices?.addEventListener?.('devicechange', tick)
    return () => {
      cancelled = true
      clearInterval(id)
      navigator.mediaDevices?.removeEventListener?.('devicechange', tick)
    }
  }, [read])

  const assign = useCallback(
    (type: QuickAccessDeviceType, deviceId: string) => {
      setError(null)

      if (!isTauri()) {
        setFallbackSelection((current) => ({ ...current, [type]: deviceId }))
        return
      }

      void invoke('set_default_audio_device', { deviceType: type, deviceId })
        .then(read)
        .catch((reason: unknown) => {
          // Surfaced rather than swallowed. Endpoints go away between opening the
          // card and clicking a row — a headset sleeping is enough — and a click
          // that silently did nothing is indistinguishable from a broken button.
          setError(typeof reason === 'string' ? reason : 'Could not switch that device')
          void read()
        })
    },
    [read],
  )

  const activeId = useCallback(
    (type: QuickAccessDeviceType) =>
      devices.find((device) => device.type === type && device.isDefault)?.id ??
      fallbackSelection[type],
    [devices, fallbackSelection],
  )

  return { devices, loaded, unavailable, error, activeId, assign }
}
