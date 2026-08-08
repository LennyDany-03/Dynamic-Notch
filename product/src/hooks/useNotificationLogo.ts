import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

/**
 * The icon of the app that raised a notification, as a ready-to-render
 * `data:image/png;base64,…` URI, or `null` until — and unless — the shell
 * produces one. A complete URI, not bare base64: it comes from the same command
 * the launcher tiles use, and that is the form they render.
 *
 * Owned by the banner rather than fetched with the arrival, because nothing the
 * banner shows may wait on a second native call. Resolving an icon reads the
 * shell's imaging pipeline off disk, and a slow one must cost an icon, never the
 * notification itself.
 *
 * Keyed by AUMID, which is also what makes the cache worth having: one entry
 * covers every notification the same app ever raises.
 */

const cache = new Map<string, string | null>()

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

export function useNotificationLogo(appId: string): string | null {
  const [logo, setLogo] = useState<string | null>(() => cache.get(appId) ?? null)

  useEffect(() => {
    if (cache.has(appId)) {
      setLogo(cache.get(appId) ?? null)
      return
    }
    if (!appId || !isTauri()) return

    let cancelled = false
    void invoke<string | null>('notification_logo', { appId })
      .catch(() => null)
      .then((result) => {
        const resolved = result ?? null
        cache.set(appId, resolved)
        if (!cancelled) setLogo(resolved)
      })

    return () => {
      cancelled = true
    }
  }, [appId])

  return logo
}
