import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { BluetoothDevice, NetworkStatus, SystemEvent, SystemStatus } from '../types/system'

/**
 * Watches the machine itself — the charger, connected Bluetooth devices, the
 * network — and reports each change once, so the notch can say what just
 * happened.
 *
 * One poll for all three, because Rust answers all three in one call. The hook
 * holds no visible state and returns nothing: everything it knows is either in
 * the event it just reported or is the baseline it compares the next poll
 * against. A card showing the standing values would be a different feature (a
 * module), and this is deliberately not it — these are things you want to be
 * *told*, not things you go and look at.
 *
 * Polled rather than subscribed, the same as the notification centre. Each of the
 * three does have a WinRT change event, but they are three subscriptions with
 * three lifetimes to keep alive across a sleep/resume — against one timer reading
 * three cheap values.
 *
 * The first poll is a baseline and reports nothing. Launching Crest with a
 * charger already in and a headset already paired is not three things that just
 * happened, and announcing them would open the notch uninvited on every start —
 * the same rule `useMediaAnnounce` and the notification poll follow.
 */

/**
 * Slow enough to be cheap all day; fast enough that a plug still feels caused.
 *
 * The snapshot behind it measures ~50ms in a debug build (`system.rs`'s test
 * prints it), almost all of it the two Bluetooth device queries — so the poll
 * spends a low single-digit percentage of one worker thread, and never the UI
 * one. Anything much faster would be paying that repeatedly for a charger that
 * gets plugged in twice a day.
 */
const POLL_MS = 2000

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

/**
 * What the network is, as one comparable string. Deliberately excludes the signal
 * strength: bars drift up and down while you sit still, and a banner every time
 * they did would be the notch reporting the weather.
 */
const networkKey = (network: NetworkStatus) => `${network.kind}:${network.name ?? ''}`

/**
 * Snapshot state carried between polls. All of it is "what has been reported",
 * not "what the last poll saw" — the difference is the flap rule below.
 */
interface Baseline {
  /** Whether a charger is attached, as last reported. */
  plugged: boolean
  /** Network signature, as last reported. */
  network: string
  /** Connected Bluetooth devices, by id, as last reported. */
  devices: Map<string, BluetoothDevice>
  /**
   * Things that have gone away but have not yet been reported as gone: the
   * network signature seen in the previous poll, and device ids absent from it.
   *
   * A loss has to survive a second poll before the notch says anything, because
   * losses flap and arrivals do not. Wi-Fi drops for a DHCP renew, and a headset
   * drops for a moment when it switches between its handsfree and stereo
   * profiles — both come back within a poll, and both would otherwise be a
   * "disconnected" banner followed by a "connected" one for a user who did
   * nothing and noticed nothing. Arrivals are reported on sight, which is where
   * the latency actually matters: plugging a charger in and being told about it
   * four seconds later reads as a coincidence rather than a response.
   */
  missingNetwork: string | null
  missingDevices: Set<string>
}

const emptyBaseline = (): Baseline => ({
  plugged: false,
  network: '',
  devices: new Map(),
  missingNetwork: null,
  missingDevices: new Set(),
})

export function useSystemStatus(enabled: boolean, onEvent: (event: SystemEvent) => void) {
  // Held in a ref for the same reason as the notification poll's: a caller that
  // rebuilds the callback each render must not tear down the poll, which would
  // re-baseline and swallow whatever happened next.
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!enabled || !isTauri()) return

    let cancelled = false
    let baseline: Baseline | null = null
    let sequence = 0

    /**
     * Compare one snapshot against what has been reported, and hand back both
     * what changed and the baseline the next poll is measured from. Pure — the
     * caller adopts the new baseline — so the flap rules can be read in one place
     * without also tracking what has been assigned where.
     */
    const diff = (
      status: SystemStatus,
      previous: Baseline,
    ): { events: SystemEvent[]; baseline: Baseline } => {
      const events: SystemEvent[] = []
      const next: Baseline = {
        ...previous,
        devices: new Map(previous.devices),
        missingDevices: new Set(previous.missingDevices),
      }

      // ── The charger ────────────────────────────────────────────────────────
      // No flap rule: the AC line does not stutter, and this is the one event the
      // user is holding in their hand while they wait for it.
      const battery = status.battery
      if (battery && battery.acPower !== previous.plugged) {
        next.plugged = battery.acPower
        events.push({
          id: ++sequence,
          kind: 'power',
          plugged: battery.acPower,
          battery,
        })
      }

      // ── Bluetooth ──────────────────────────────────────────────────────────
      const present = new Map(status.bluetooth.map((device) => [device.id, device]))

      for (const [id, device] of present) {
        // Back before its absence was reported — the flap never happened as far
        // as anything outside this hook is concerned.
        next.missingDevices.delete(id)
        if (previous.devices.has(id)) continue

        next.devices.set(id, device)
        events.push({ id: ++sequence, kind: 'bluetooth', connected: true, device })
      }

      for (const [id, device] of previous.devices) {
        if (present.has(id)) continue

        if (!previous.missingDevices.has(id)) {
          // First poll without it. Give it one more before saying so.
          next.missingDevices.add(id)
          continue
        }

        next.missingDevices.delete(id)
        next.devices.delete(id)
        events.push({ id: ++sequence, kind: 'bluetooth', connected: false, device })
      }

      // ── The network ────────────────────────────────────────────────────────
      const key = networkKey(status.network)
      const connected = status.network.kind !== 'none'

      if (key !== previous.network) {
        // Losing the connection is a loss; swapping one network for another is
        // an arrival, even though the old one went away to make room for it.
        const isLoss = !connected

        if (isLoss && previous.missingNetwork !== key) {
          next.missingNetwork = key
        } else {
          next.missingNetwork = null
          next.network = key
          events.push({
            id: ++sequence,
            kind: 'network',
            connected,
            network: status.network,
          })
        }
      } else {
        next.missingNetwork = null
      }

      return { events, baseline: next }
    }

    const poll = async () => {
      let status: SystemStatus
      try {
        status = await invoke<SystemStatus>('get_system_status')
      } catch {
        // Nothing to report and nothing to be done from here. The next poll gets
        // another go; the baseline is left alone so a momentary failure does not
        // turn into a burst of events once it clears.
        return
      }
      if (cancelled) return

      if (!baseline) {
        // Baseline. Everything already true of the machine is recorded as
        // reported, so only what changes from here is an event.
        baseline = {
          ...emptyBaseline(),
          plugged: status.battery?.acPower ?? false,
          network: networkKey(status.network),
          devices: new Map(status.bluetooth.map((device) => [device.id, device])),
        }
        return
      }

      const result = diff(status, baseline)
      baseline = result.baseline
      if (!result.events.length) return

      // One banner per poll, whatever moved. Waking a laptop finds the charger
      // out, the Wi-Fi on a different network and the headset gone all at once,
      // and three banners in a row is a notch that will not go away. The rest are
      // absorbed into the baseline rather than queued: they are all still true,
      // and Windows' own tray is showing every one of them.
      onEventRef.current(result.events[0])
    }

    void poll()
    const id = setInterval(() => void poll(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled])
}
