import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { AppEntry } from '../../hooks/useAppLauncher'
import { color } from '../../tokens'

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

/**
 * Resolved icons, kept outside React so remounting the launcher does not re-fetch
 * what is already known. Shared by the pinned tiles and the app picker, which is
 * most of the point: the picker lists every installed app, and reopening it after
 * a scroll would otherwise re-ask the shell for icons it resolved a second ago.
 *
 * Only successes are stored. The shell's imaging pipeline fails occasionally when
 * it is busy, and remembering that would pin an app to its initial for the rest of
 * the session; leaving it unrecorded means the next render tries again.
 */
const iconCache = new Map<string, string>()

/** An app's real icon, falling back to its initial until one arrives. */
export default function AppIcon({ app, px }: { app: AppEntry; px: number }) {
  const [icon, setIcon] = useState<string | null>(() => iconCache.get(app.path) ?? null)

  useEffect(() => {
    if (!isTauri()) return
    const cached = iconCache.get(app.path)
    if (cached !== undefined) {
      setIcon(cached)
      return
    }

    let cancelled = false
    invoke<string | null>('app_icon', { path: app.path })
      .then((data) => {
        if (data) iconCache.set(app.path, data)
        if (!cancelled) setIcon(data ?? null)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [app.path])

  // The initial is the fallback, not the default: it shows for the frame or two
  // before the icon resolves, and permanently for apps that have none.
  if (!icon) {
    return (
      <span
        style={{
          width: px,
          height: px,
          display: 'grid',
          placeItems: 'center',
          flex: 'none',
          fontSize: Math.max(11, Math.round(px * 0.5)),
          fontWeight: 600,
          color: color.text.strong,
        }}
      >
        {app.name.charAt(0).toUpperCase()}
      </span>
    )
  }

  return (
    <img
      src={icon}
      alt=""
      width={px}
      height={px}
      draggable={false}
      style={{ display: 'block', objectFit: 'contain', flex: 'none' }}
    />
  )
}
