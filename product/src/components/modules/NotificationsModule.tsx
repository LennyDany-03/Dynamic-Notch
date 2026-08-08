import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import AppLogo from '../notifications/AppLogo'
import NotificationDetail from '../notifications/NotificationDetail'
import { relativeTime } from '../../hooks/useClipboardHistory'
import type { NotificationFeed } from '../../hooks/useWindowsNotifications'
import { NOTIFICATION_ROW_HEIGHT } from '../../layout'
import { color, radius, sectionLabel } from '../../tokens'

/**
 * The standing list of what is in the Windows notification centre.
 *
 * The announce banner reports one arrival and leaves after three seconds; this is
 * where the ones that came while you were away are still sitting. Rows are one
 * line each — the full message is one click away in `NotificationDetail`.
 *
 * The card is sized to this list rather than the other way round, so every box
 * here that the arithmetic in `layout.notificationsCardHeight` counts is pinned to
 * an explicit height: a row that grew by a pixel with the font would leave the
 * card a pixel short of its own contents, and one that shrank would put the empty
 * stripe back. That is why the header carries a height it looks like it does not
 * need — with nothing in the list there is no "Clear all" button to set it.
 *
 * Reads the same poll the banner does (`useWindowsNotifications`), handed down
 * from `App`, which also owns which row is open — the sheet takes the full card,
 * so that is a question about geometry and geometry is not decided in here.
 */

function Row({
  notification,
  onOpen,
  last,
}: {
  notification: NotificationFeed['notifications'][number]
  onOpen: () => void
  last: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={onOpen}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      title="Read this one"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: NOTIFICATION_ROW_HEIGHT,
        padding: '0 6px',
        margin: '0 -6px',
        flex: 'none',
        textAlign: 'left',
        borderRadius: radius.small,
        background: hovered ? color.tile : 'transparent',
        // Hairline dividers rather than cards, matching the clipboard list. The
        // last row leaves it off so the list does not end on a rule.
        boxShadow: last ? undefined : `inset 0 -1px 0 ${color.divider}`,
        transition: 'background 90ms linear',
      }}
    >
      <AppLogo appId={notification.appId} size={26} />

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 500,
            color: color.text.secondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {notification.app}
        </span>
        <span
          style={{
            display: 'block',
            marginTop: 1,
            fontSize: 12,
            color: color.text.strong,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {notification.message}
        </span>
      </span>

      {notification.timestamp > 0 && (
        <span style={{ flex: 'none', fontSize: 11, color: color.text.muted }}>
          {relativeTime(notification.timestamp)}
        </span>
      )}
    </button>
  )
}

/** Centred one-liner for every reason the list has nothing in it. */
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        placeItems: 'center',
        padding: '0 24px',
        textAlign: 'center',
        fontSize: 11.5,
        lineHeight: 1.5,
        color: color.text.muted,
      }}
    >
      {children}
    </div>
  )
}

export default function NotificationsModule({
  feed,
  enabled,
  openId,
  onOpen,
}: {
  feed: NotificationFeed
  /** The "notifications in the notch" preference. Off means nothing is polling. */
  enabled: boolean
  /**
   * Which row's detail sheet is open, owned by `App` because the card grows to
   * hold it. The id rather than the notification: the poll replaces the array
   * every two seconds, and a held object would go on showing an entry that has
   * since been dismissed from somewhere else. Looking it up again each render
   * means the sheet closes by itself when its notification leaves the centre.
   */
  openId: string | null
  onOpen: (id: string | null) => void
}) {
  const { notifications, loaded, unavailable, dismiss, clearAll } = feed

  const open = notifications.find((notification) => notification.id === openId) ?? null

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 20, flex: 'none' }}>
        <span style={sectionLabel}>Notifications</span>
        {notifications.length > 0 && (
          <span
            style={{
              padding: '1px 6px',
              borderRadius: radius.pill,
              background: color.tile,
              fontSize: 10,
              fontWeight: 600,
              color: color.text.secondary,
            }}
          >
            {notifications.length}
          </span>
        )}

        <span style={{ flex: 1 }} />

        {notifications.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onOpen(null)
              clearAll()
            }}
            style={{
              height: 20,
              padding: '0 8px',
              borderRadius: radius.small,
              fontSize: 11,
              color: color.text.muted,
            }}
          >
            Clear all
          </button>
        )}
      </div>

      <div style={{ height: 10, flex: 'none' }} />

      {!enabled ? (
        <Empty>
          Notifications in the notch are turned off. Turn them back on in Settings and this list
          fills itself.
        </Empty>
      ) : unavailable ? (
        <Empty>
          Windows hasn't given Crest access to your notifications. Turn on Privacy &amp; security →
          Notifications.
        </Empty>
      ) : notifications.length === 0 ? (
        // Nothing at all until the first poll settles: an empty list a frame
        // before the data arrives would flash "You're all caught up" at someone
        // who has twelve notifications waiting.
        <Empty>{loaded ? "You're all caught up" : ''}</Empty>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {notifications.map((notification, index) => (
            <Row
              key={notification.id}
              notification={notification}
              last={index === notifications.length - 1}
              onOpen={() => onOpen(notification.id)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <NotificationDetail
            key={open.id}
            notification={open}
            onClose={() => onOpen(null)}
            onDismiss={() => {
              onOpen(null)
              dismiss(open.id)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
