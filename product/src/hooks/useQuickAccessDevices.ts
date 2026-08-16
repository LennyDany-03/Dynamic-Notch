import { useCallback, useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  DEFAULT_QUICK_ACCESS_DEVICES,
  type DeviceAssignment,
  type QuickAccessDevice,
  type QuickAccessDeviceType,
} from '../types/devices'

const STORAGE_KEY = 'crest.quick-access.assignments'

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

interface NativeAudioDevice {
  id: string
  name: string
  deviceType: QuickAccessDeviceType
  isDefault: boolean
}

async function readDevices(): Promise<QuickAccessDevice[]> {
  if (isTauri()) {
    try {
      const devices = await invoke<NativeAudioDevice[]>('list_audio_devices')
      return devices.map((device) => ({
        id: device.id,
        name: device.name,
        type: device.deviceType,
        source: 'system',
        isDefault: device.isDefault,
      }))
    } catch {
      // The card remains usable in the browser fallback if the native bridge is
      // unavailable during startup or after a development rebuild.
      return [...DEFAULT_QUICK_ACCESS_DEVICES]
    }
  }

  if (!navigator.mediaDevices?.enumerateDevices) return [...DEFAULT_QUICK_ACCESS_DEVICES]

  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const mapped: QuickAccessDevice[] = devices
      .filter((device) => device.kind === 'audioinput' || device.kind === 'audiooutput')
      .map((device) => ({
        id: device.deviceId || `system-${device.kind}`,
        name: device.label || (device.kind === 'audioinput' ? 'System microphone' : 'System audio'),
        type: device.kind === 'audioinput' ? 'microphone' : 'speakers',
        source: 'system' as const,
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

function readAssignments(): DeviceAssignment[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Device discovery and assignment state live here rather than in the card.
 * A future Windows audio adapter can replace readDevices and the assignment
 * commit without changing QuickAccessModule or its device rows.
 */
export function useQuickAccessDevices() {
  const [devices, setDevices] = useState<QuickAccessDevice[]>([...DEFAULT_QUICK_ACCESS_DEVICES])
  const [assignments, setAssignments] = useState<DeviceAssignment[]>([])

  useEffect(() => {
    setAssignments(readAssignments())
    void readDevices().then(setDevices)

    const onDeviceChange = () => void readDevices().then(setDevices)
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange)
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange)
  }, [])

  const assign = useCallback((type: QuickAccessDeviceType, deviceId: string) => {
    if (isTauri()) {
      return invoke('set_default_audio_device', { deviceType: type, deviceId }).then(async () => {
        setDevices(await readDevices())
      })
    }

    setAssignments((current) => {
      const next = [...current.filter((assignment) => assignment.type !== type), { type, deviceId }]
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // A browser fallback can be storage-restricted; the live selection still works.
      }
      return next
    })
    return Promise.resolve()
  }, [])

  const assigned = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.type, assignment.deviceId])),
    [assignments],
  )

  return { devices, assigned, assign }
}
