import AppLogo from './AppLogo'
import type { WinNotification } from '../../types/notifications'
import { color } from '../../tokens'

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
 * notification centre, and in the notifications module, which is where it can
 * still be read in full.
 */
export default function NotificationAnnounce({
  notification,
}: {
  notification: WinNotification
}) {
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
      <AppLogo appId={notification.appId} size={36} />

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
            the banner does; a third line would push the type below the card. The
            rest is a nav arrow away, in the notifications module. */}
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
