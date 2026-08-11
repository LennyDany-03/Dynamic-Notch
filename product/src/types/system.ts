/**
 * The machine's own state, and the changes in it worth a banner.
 *
 * Mirrors `SystemStatus` in `src-tauri/src/system.rs`. Rust reports a snapshot
 * and nothing else; what counts as an *event* is decided in `useSystemStatus`,
 * which is the only thing that sees two snapshots at once.
 */

export interface BatteryStatus {
  /** Charge remaining, 0–100, or null when Windows will not say. */
  percent: number | null
  /**
   * Whether a charger is attached — the thing the user just did, as opposed to
   * `charging`, which a battery already at 100% on mains is not doing.
   */
  acPower: boolean
  charging: boolean
  /** Runtime left on battery, in seconds, when Windows has an estimate. */
  secondsRemaining: number | null
}

export type NetworkKind = 'wifi' | 'wired' | 'none'

export interface NetworkStatus {
  kind: NetworkKind
  /** SSID for Wi-Fi, the adapter's profile name otherwise. */
  name: string | null
  /** 0–5, Wi-Fi only. Drawn, never diffed — it moves on its own all day. */
  signalBars: number | null
}

/** What sort of thing a connected device is, for the picture the banner draws. */
export type BluetoothKind = 'audio' | 'phone' | 'computer' | 'peripheral' | 'wearable' | 'other'

export interface BluetoothDevice {
  /** Windows' device id — opaque, and what one poll is diffed against the next on. */
  id: string
  name: string
  kind: BluetoothKind
}

export interface SystemStatus {
  /** Null on a desktop: no battery, so no charger to report going in or out. */
  battery: BatteryStatus | null
  network: NetworkStatus
  bluetooth: BluetoothDevice[]
}

/**
 * Something about the machine changed.
 *
 * A tagged union rather than a "before and after" pair, because the banner draws
 * one specific thing happening — a plug going in, a headset connecting — and the
 * animation that says so is chosen from the tag. Carrying both snapshots would
 * make every banner re-derive which of the three subsystems moved.
 *
 * `id` is a sequence number stamped by the hook. Two identical events in a row —
 * unplug, plug, unplug — are genuinely two events, and the cross-fade in
 * `NotchShell` keys on this so the second one is drawn rather than silently
 * matching the first.
 */
export type SystemEvent =
  | { id: number; kind: 'power'; plugged: boolean; battery: BatteryStatus }
  | { id: number; kind: 'bluetooth'; connected: boolean; device: BluetoothDevice }
  | { id: number; kind: 'network'; connected: boolean; network: NetworkStatus }
