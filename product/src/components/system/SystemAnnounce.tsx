import { BluetoothGlyph, NetworkGlyph, PowerGlyph } from './SystemGlyphs'
import type { BatteryStatus, SystemEvent } from '../../types/system'
import { color } from '../../tokens'

/**
 * Something about the machine changed — a charger went in, a headset connected,
 * the Wi-Fi moved — on the same banner the media and notification announcements
 * use.
 *
 * One shape for "the notch has something to tell you", whatever raised it. That
 * is why this is a banner and not a fifth module: none of these are pages you go
 * and look at (Windows already has all three in its tray, a click away), they are
 * moments worth being told about at the instant they happen. A card would ask the
 * user to remember to open it, which is exactly the thing a charger falling out
 * of a laptop needs not to depend on.
 *
 * Read-only, like the notification banner and for a plainer reason: there is
 * nothing to do about any of it from here. The charger is in your hand.
 *
 * The three lines are the same ramp as `MediaAnnounce` — what raised this, what
 * it was, and the detail — so the eye lands in the same place whichever banner
 * comes down.
 */

/** What each event says, in the order the three lines are read. */
interface Copy {
  /** Which subsystem — the "why am I seeing this" line. */
  label: string
  /** The thing itself: a device name, a network, a state. */
  title: string
  /** The number or the state that qualifies it. */
  detail: string
}

/**
 * The battery, spelled the way Windows' own flyout spells it.
 *
 * On mains the runtime estimate is meaningless (it is an estimate of time *left*
 * on battery) so only the charge is given. Off mains it is the whole point, and
 * it is absent for the first minutes of a discharge while Windows works out a
 * rate — the label leaves it out rather than guessing at one.
 */
function batteryDetail(battery: BatteryStatus): string {
  const percent = battery.percent === null ? null : `${battery.percent}%`
  if (battery.acPower) return percent ?? 'On mains power'

  const remaining = formatRemaining(battery.secondsRemaining)
  if (percent && remaining) return `${percent} · ${remaining} left`
  return percent ?? 'Running on battery'
}

function formatRemaining(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null

  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours <= 0) return `${minutes} min`
  if (minutes === 0) return `${hours} hr`
  return `${hours} hr ${minutes} min`
}

function copyFor(event: SystemEvent): Copy {
  switch (event.kind) {
    case 'power':
      return {
        label: 'Power',
        // "Charging" rather than "Plugged in" whenever the battery is actually
        // taking charge, because those are different facts and a full battery on
        // mains is only the second one.
        title: event.plugged
          ? event.battery.charging
            ? 'Charging'
            : 'Plugged in'
          : 'Unplugged',
        detail: batteryDetail(event.battery),
      }

    case 'bluetooth':
      return {
        label: 'Bluetooth',
        // The device's own name, always. It is the one thing the user recognises
        // and the reason this event is worth a banner at all.
        title: event.device.name,
        detail: event.connected ? 'Connected' : 'Disconnected',
      }

    case 'network':
      if (!event.connected) {
        return {
          label: 'Network',
          title: 'Disconnected',
          detail: 'No internet connection',
        }
      }
      return {
        label: event.network.kind === 'wifi' ? 'Wi-Fi' : 'Network',
        title: event.network.name ?? 'Connected',
        detail: event.network.name ? 'Connected' : 'Network connected',
      }
  }
}

function Glyph({ event }: { event: SystemEvent }) {
  switch (event.kind) {
    case 'power':
      return <PowerGlyph battery={event.battery} plugged={event.plugged} />
    case 'bluetooth':
      return <BluetoothGlyph kind={event.device.kind} connected={event.connected} />
    case 'network':
      return <NetworkGlyph network={event.network} connected={event.connected} />
  }
}

export default function SystemAnnounce({ event }: { event: SystemEvent }) {
  const copy = copyFor(event)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: color.text.strong,
      }}
    >
      <Glyph event={event} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: color.text.muted,
          }}
        >
          {copy.label}
        </div>

        {/* One line, clipped. A device name can be anything its maker felt like
            ("Lenny's AirPods Pro (2nd generation)") and the banner is 300px. */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '-.01em',
            marginTop: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {copy.title}
        </div>

        <div
          style={{
            fontSize: 11,
            color: color.text.secondary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {copy.detail}
        </div>
      </div>
    </div>
  )
}
