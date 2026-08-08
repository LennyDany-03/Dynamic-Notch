import { useEffect, useState } from 'react'
import { useNotificationLogo } from '../../hooks/useNotificationLogo'
import { color, radius } from '../../tokens'

/**
 * The raising app's own logo — what makes a notification recognisable before the
 * text is read. The bell stands in when the shell has no icon for it, rather than
 * a blank tile.
 *
 * Shared by the arriving banner, the list rows and the detail sheet. Each mounts
 * its own copy and fetches for itself, which sounds wasteful and is not:
 * `useNotificationLogo` caches by AUMID, so a list of twenty notifications from
 * four apps is four calls, and the second notification from an app already on
 * screen costs nothing.
 *
 * Never blocks its caller. Resolving an icon reads the shell's imaging pipeline
 * off disk; a slow one must cost an icon, never the notification.
 */
export default function AppLogo({ appId, size }: { appId: string; size: number }) {
  const logo = useNotificationLogo(appId)

  // Windows hands the logo over as whatever the app registered, and a packaged
  // app's asset is not guaranteed to be a PNG. A decode failure falls back to the
  // mark rather than leaving the browser's broken-image glyph in place.
  const [broken, setBroken] = useState(false)
  const showLogo = !!logo && !broken

  // A row reuses this component as the list re-sorts, so the failure has to be
  // forgotten with the image it belonged to.
  useEffect(() => setBroken(false), [logo])

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius.small,
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        // No tint behind a real logo: app marks bring their own colour, and a
        // purple wash under them reads as a rendering error.
        background: showLogo ? 'transparent' : 'rgba(124,58,237,.18)',
        color: color.accentBright,
      }}
    >
      {showLogo ? (
        <img
          // Already a complete `data:image/png;base64,…` URI — the shell route
          // hands one back ready to render, unlike the media card's album art,
          // which is bare base64. Prefixing it again silently produced a broken
          // image and every icon fell back to the bell.
          src={logo}
          alt=""
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      ) : (
        <svg
          viewBox="0 0 24 24"
          width={Math.round(size * 0.47)}
          height={Math.round(size * 0.47)}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
          <path d="M13.7 19a2 2 0 0 1-3.4 0" />
        </svg>
      )}
    </div>
  )
}
