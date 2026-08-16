/** Device groups exposed by Quick Access. Keep this union small and explicit:
 * adding a new group should only require a registry entry and its icon. */
export type QuickAccessDeviceType = 'speakers' | 'microphone'

export interface QuickAccessDevice {
  id: string
  name: string
  type: QuickAccessDeviceType
  source: 'system' | 'default'
  /** The current Windows default for this input/output role. */
  isDefault?: boolean
}

export interface DeviceAssignment {
  type: QuickAccessDeviceType
  deviceId: string
}

export interface DeviceTypeDefinition {
  type: QuickAccessDeviceType
  label: string
  emptyLabel: string
}

export const QUICK_ACCESS_DEVICE_TYPES: readonly DeviceTypeDefinition[] = [
  { type: 'speakers', label: 'Speakers', emptyLabel: 'No speakers found' },
  { type: 'microphone', label: 'Microphone', emptyLabel: 'No microphone found' },
]

/** Safe browser/Tauri fallback while the native audio adapter is unavailable. */
export const DEFAULT_QUICK_ACCESS_DEVICES: readonly QuickAccessDevice[] = [
  { id: 'default-speakers', name: 'Default speakers', type: 'speakers', source: 'default' },
  { id: 'default-microphone', name: 'Default microphone', type: 'microphone', source: 'default' },
]
