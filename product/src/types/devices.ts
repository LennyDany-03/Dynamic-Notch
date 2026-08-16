/**
 * The device roles Quick Access routes.
 *
 * Deliberately a small closed union rather than a string: the card draws one row
 * per entry and Rust matches on the same two words, so adding a role means a
 * registry entry, a glyph and an `EDataFlow` in `audio.rs` — and nothing else.
 */
export type QuickAccessDeviceType = 'speakers' | 'microphone'

export interface QuickAccessDevice {
  /** Opaque Core Audio endpoint id. Never parsed; handed straight back to Rust. */
  id: string
  name: string
  type: QuickAccessDeviceType
  /**
   * Whether Windows currently routes this role here.
   *
   * This is the *only* record of what is selected, and that is on purpose: the
   * Windows default is the setting, so Crest storing a second copy of it would
   * be a preference that could disagree with the machine the moment the user
   * changed it from the volume flyout. The browser fallback has no such truth
   * and keeps its selection in memory for the session — see `useQuickAccessDevices`.
   */
  isDefault: boolean
}

export interface DeviceTypeDefinition {
  type: QuickAccessDeviceType
  label: string
  /** Shown in the row when the machine reports nothing for this role at all. */
  emptyLabel: string
}

export const QUICK_ACCESS_DEVICE_TYPES: readonly DeviceTypeDefinition[] = [
  { type: 'speakers', label: 'Speakers', emptyLabel: 'No speakers found' },
  { type: 'microphone', label: 'Microphone', emptyLabel: 'No microphone found' },
]

/**
 * Stand-ins for the browser fallback *only* — `npm run dev` in a browser has no
 * Core Audio and often no device labels either, and an empty card there says
 * nothing about the layout being worked on.
 *
 * Never used to paper over a failed native read: a card that answers "Default
 * speakers" when Core Audio refused is a card that is lying about the machine,
 * and the user would click it and nothing would happen. That path reports
 * `unavailable` instead.
 */
export const DEFAULT_QUICK_ACCESS_DEVICES: readonly QuickAccessDevice[] = [
  { id: 'default-speakers', name: 'Default speakers', type: 'speakers', isDefault: true },
  { id: 'default-microphone', name: 'Default microphone', type: 'microphone', isDefault: true },
]
