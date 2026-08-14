import type { WinNotification } from './notifications'
import type { PerfAlert } from './perf'
import type { Reminder } from './reminders'
import type { SystemEvent } from './system'

/**
 * Visibility state machine. Single source of truth lives in `useNotchState`.
 *
 * `announce` is the one state the cursor never asks for: a banner the notch drops
 * in by itself to report something (music starting) and retracts on a timer. It
 * sits between the pill and a full card in every sense — bigger than `peek`,
 * smaller and shorter-lived than `expanded` — and hovering it dwells through to
 * `expanded` exactly as hovering the pill does.
 */
export type NotchState = 'hidden' | 'peek' | 'announce' | 'expanded'

/**
 * How much of the notch each state puts on screen, so callers can compare two
 * states rather than enumerate them.
 *
 * The floor is not always `hidden` — with the always-on-top preference set the
 * pill rests on screen permanently — so "did the notch just grow or shrink?" can
 * no longer be answered by testing against a single state name.
 */
export const STATE_RANK: Record<NotchState, number> = {
  hidden: 0,
  peek: 1,
  announce: 2,
  expanded: 3,
}

/**
 * Which page is showing while expanded. Independent of `NotchState` so that
 * switching modules resizes the card without retriggering the expand animation.
 *
 * The first three are the design export's. The last two are not: the export
 * predates the notch reading the notification centre at all, and predates it
 * watching the machine.
 *
 * `notifications` is the standing list behind the notification banner — that one
 * reports an arrival and leaves, this is where the ones you missed are sitting.
 * `system` is the same relationship to the performance banner, and adds the one
 * thing on the notch that is not a readout: sleep, restart and shut down. Those
 * live here rather than in the tray popup because the reason to reach for them is
 * almost always the reason you are looking at the meters.
 */
export type NotchModule =
  | 'media'
  | 'launcher'
  | 'files'
  | 'notifications'
  | 'system'
  | 'weather'
  | 'calendar'

/**
 * The **default** order and the full set of modules that exist.
 *
 * No longer what the notch actually cycles through — that is the `panels`
 * preference, resolved by `resolvePanels` below. This is the fallback for a fresh
 * install, and the canonical list every stored preference is reconciled against:
 * anything here but missing from the stored order is appended (a module that
 * shipped in an update), anything stored but not here is dropped (a module that
 * was removed).
 *
 * Appended rather than inserted, still: a user who has not touched the preference
 * and knows the shelf is two right of media should not have that changed by a
 * release.
 */
export const MODULES: readonly NotchModule[] = [
  'media',
  'launcher',
  'files',
  'notifications',
  'system',
  'weather',
  'calendar',
] as const

/**
 * What each module is called, in one place.
 *
 * There were four copies of this — the nav strip, the placeholder, the tray and
 * now the settings list — and they had already drifted ("Launcher and clipboard"
 * against "Quick launcher and clipboard"). A `Record` keyed on the union also
 * means adding a module fails to compile until it has been named, which is one
 * of the five edits that have to agree.
 *
 * The tray keeps its own shorter set alongside its icons; these are the names
 * used anywhere the module is being *identified* rather than offered.
 */
export const MODULE_LABELS: Record<NotchModule, string> = {
  media: 'Media controls',
  launcher: 'Launcher and clipboard',
  files: 'File shelf and notes',
  notifications: 'Notifications',
  system: 'System monitor',
  weather: 'Weather',
  calendar: 'Calendar',
}

/**
 * One row of the `panels` preference: a module, and whether it is in the ring.
 *
 * Stored as an ordered list of `{ id, visible }` rather than as an order plus a
 * hidden set, because the two questions have the same answer shape and keeping
 * them together makes the settings list a straight render of the stored value.
 *
 * Rust stores `id` as an opaque string and never interprets it — the set of
 * modules is a frontend fact, and teaching `settings.rs` about it would mean
 * editing Rust every time a card is added.
 */
export interface PanelPref {
  id: string
  visible: boolean
}

/**
 * Turn the stored preference into the list the notch actually uses.
 *
 * Everything about this function is reconciliation, because the stored value and
 * the code can disagree in four ways and all four have to survive:
 *
 *  - **A module shipped in an update.** Not in the stored order, so it is
 *    appended and visible. A new card that silently never appeared because the
 *    user had opened Settings once before the release would be the worst of the
 *    failures here — invisible, and indistinguishable from a bug.
 *  - **A module was removed.** Still in the stored order; dropped.
 *  - **Duplicates**, from a hand-edited file. First occurrence wins.
 *  - **Everything switched off.** The notch would have no card to draw and
 *    `activeModule` would point at nothing, so this falls back to showing all of
 *    them. The picker refuses to let the last one go, but the file is editable
 *    and the running app must not depend on the picker having been the writer.
 *
 * Returns both halves: `visible` is what the arrows cycle and the tray lists,
 * `all` is the reconciled full list the settings picker renders.
 */
export function resolvePanels(stored: PanelPref[] | undefined | null): {
  visible: NotchModule[]
  all: { id: NotchModule; visible: boolean }[]
} {
  const known = new Set<string>(MODULES)
  const seen = new Set<string>()

  const all: { id: NotchModule; visible: boolean }[] = []

  for (const panel of stored ?? []) {
    if (!known.has(panel.id) || seen.has(panel.id)) continue
    seen.add(panel.id)
    all.push({ id: panel.id as NotchModule, visible: panel.visible !== false })
  }

  for (const id of MODULES) {
    if (!seen.has(id)) all.push({ id, visible: true })
  }

  const visible = all.filter((panel) => panel.visible).map((panel) => panel.id)

  // Nothing left to draw. Better a notch that ignores the preference than one
  // with no cards in it and no way back except this window.
  if (visible.length === 0) {
    return { visible: [...MODULES], all: all.map((panel) => ({ ...panel, visible: true })) }
  }

  return { visible, all }
}

/**
 * What an `announce` banner is reporting.
 *
 * The state machine carries this rather than a module, because an announcement
 * is not a module: `notification` and `system` have no card behind them to open,
 * and `media` borrows the media card only because one happens to exist. Kept as a
 * tagged union so each new source has to say what it is rather than being
 * inferred from whatever the notch was last showing.
 *
 * `system` is the machine reporting itself — a charger, a Bluetooth device, the
 * network. It carries the whole event rather than a subsystem name for the same
 * reason `notification` carries the notification: the banner reports one specific
 * thing having just happened, not the standing state of a thing.
 *
 * `performance` is the machine struggling and `reminder` is a time the user
 * asked to be told about. Both have a card behind them: like `media`, hovering
 * them dwells through to somewhere the user can act on what they were just told —
 * the meters and the power row, or the day the reminder is on. `notification` and
 * `system` have nowhere to go, and hovering those only holds them up to be read.
 */
export type Announcement =
  | { kind: 'media' }
  | { kind: 'notification'; notification: WinNotification }
  | { kind: 'system'; event: SystemEvent }
  | { kind: 'performance'; alert: PerfAlert }
  | { kind: 'reminder'; reminder: Reminder }

/** A rectangle in window-local CSS pixels. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}
