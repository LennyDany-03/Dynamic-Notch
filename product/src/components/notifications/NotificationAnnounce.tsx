import { useEffect, useState } from 'react'
import { useNotificationLogo } from '../../hooks/useNotificationLogo'
import type { WinNotification } from '../../types/notifications'
import { color, radius } from '../../tokens'

/**
 * An arriving Windows notification, on the same banner the media announcement
 * uses — one shape for "the notch has something to tell you", whatever raised it.
 *
 * Read-only by design. Windows' own banner carries the app's buttons because
 * clicking one activates the notification in the app that raised it; there is no
 * way to do that from here (`UserNotificationListener` reads the centre, it does
 * not activate entries), so offering a button that only looked like Windows' own
 * would be worse than offering none — and there is no time to aim at one on a
 * surface that leaves after `timing.announceMs`. The notification stays in the
 * notification centre, which is where it can still be acted on.
 */
export default function NotificationAnnounce({
  notification,
}: {
  notification: WinNotification
}) {
  // Fetched by the banner, not handed to it: the notification is on screen
  // whether or not the shell ever produces an icon for it.
  const logo = useNotificationLogo(notification.appId)

  // Windows hands the logo over as whatever the app registered, and a packaged
  // app's asset is not guaranteed to be a PNG. A decode failure falls back to the
  // mark rather than leaving the browser's broken-image glyph on the banner.
  const [logoBroken, setLogoBroken] = useState(false)
  const showLogo = !!logo && !logoBroken

  // A new banner reuses this component, so the failure has to be forgotten with
  // the image it belonged to.
  useEffect(() => setLogoBroken(false), [logo])

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
      {/* The raising app's own logo where Windows has one — it is what makes a
          banner recognisable before the text is read. The bell stands in when it
          does not, rather than a blank tile. */}
      <div
        style={{
          width: 36,
          height: 36,
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
            // image and this component fell back to the bell for every icon.
            src={logo}
            alt=""
            onError={() => setLogoBroken(true)}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
            <path d="M13.7 19a2 2 0 0 1-3.4 0" />
          </svg>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: color.text.muted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {notification.app}
        </div>

        {/* Two lines, then clipped. Notification bodies have no length limit and
            the banner does; a third line would push the type below the card. */}
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            lineHeight: 1.35,
            color: color.text.strong,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
          }}
        >
          {notification.message}
        </div>
      </div>
    </div>
  )
}
