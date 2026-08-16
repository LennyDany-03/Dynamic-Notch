import { useState } from 'react'
import { motion } from 'framer-motion'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import AppLogo from './AppLogo'
import { relativeTime } from '../../hooks/useClipboardHistory'
import type { WinNotification } from '../../types/notifications'
import { color, radius, sectionLabel, spring } from '../../tokens'

/**
 * One notification, in full, over the list it came from.
 *
 * A sheet inside the card rather than a floating window, and that is not a
 * stylistic choice. The overlay's interactive bounds come from `layout.ts` and
 * are a single rect covering the largest card — anything drawn outside it sits on
 * a click-through region, so a popup hanging below the card would take no clicks
 * and the notch would count the cursor as "outside" and collapse the moment it
 * moved onto it. Inside the card it is a popup in every way that matters: raised,
 * dismissable, and over a scrim that says the list is still there behind it.
 *
 * The list rows clamp to one line because a card holding six of them has no room
 * for more; this is where a message that did not fit is actually readable, so the
 * body is unclamped and scrolls.
 */
export default function NotificationDetail({
  notification,
  onClose,
  onDismiss,
  onSnooze,
}: {
  notification: WinNotification
  onClose: () => void
  onDismiss: () => void
  onSnooze: () => void
}) {
  // Windows joins the toast's text elements as "title: body". Splitting the first
  // segment back out gives the sheet a heading, which is what makes a long message
  // scannable — and falls back to the whole string when there is no separator, so
  // a one-line notification is never left with an empty body.
  const split = notification.message.indexOf(': ')
  const title = split > 0 ? notification.message.slice(0, split) : notification.message
  const body = split > 0 ? notification.message.slice(split + 2) : ''

  // The trailing class excludes the punctuation a URL is commonly written next to
  // rather than in — a full stop ending the sentence, a closing bracket around
  // the whole link. `[^\s<>]+` swallowed those and opened a 404.
  const link = notification.message.match(/https?:\/\/[^\s<>]*[^\s<>.,;:!?)\]}'"]/i)?.[0]

  const [copied, setCopied] = useState(false)

  const actionStyle = {
    height: 26,
    flex: 'none',
    padding: '0 10px',
    borderRadius: radius.small,
    fontSize: 11,
    fontWeight: 500,
    color: color.text.strong,
    background: color.tile,
  } as const

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
      {/* Scrim. Also the click target that closes — the list behind it is not
          interactive while a sheet is over it, and clicking away is the fastest
          way out of something you only opened to read. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: color.scrim }}
      />

      <motion.div
        className="tile"
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.99 }}
        transition={spring.expand}
        style={{
          position: 'absolute',
          inset: '10px 12px',
          borderRadius: radius.tile,
          // Opaque rather than the tile's usual translucent fill: this sits over
          // the list, and at .055 the rows read straight through the message.
          background: 'rgba(46,46,46,.97)',
          boxShadow: color.popShadow,
          display: 'flex',
          flexDirection: 'column',
          padding: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
          <AppLogo appId={notification.appId} size={30} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                ...sectionLabel,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {notification.app}
            </div>
            {notification.timestamp > 0 && (
              <div style={{ marginTop: 2, fontSize: 11, color: color.text.muted }}>
                {relativeTime(notification.timestamp)} ago
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label="Back to the list"
            onClick={onClose}
            style={{
              width: 24,
              height: 24,
              flex: 'none',
              display: 'grid',
              placeItems: 'center',
              borderRadius: radius.small,
              color: color.text.icon,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={14}
              height={14}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* The message. Scrolls rather than clamping — the whole point of opening
            a row is the part the row could not show. */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: color.text.primary, lineHeight: 1.4 }}>
            {title}
          </div>
          {body && (
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                lineHeight: 1.55,
                color: color.text.body,
                // Notification bodies arrive with the app's own line breaks in
                // them; collapsing them would run a list into one paragraph.
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              {body}
            </div>
          )}
        </div>

        {/* Two rows, and deliberately not one that wraps. Four actions plus a
            status line do not fit across a 420 card, so a single flex row with
            `flexWrap` reflowed differently depending on whether the message
            happened to contain a link — the Dismiss button moved under the
            cursor between one notification and the next. Splitting it costs
            about sixteen pixels of the message pane and never moves. */}
        <div
          style={{
            flex: 'none',
            marginTop: 12,
            paddingTop: 10,
            borderTop: `1px solid ${color.divider}`,
          }}
        >
          {/* Still true, and still the reason there is no "open in the app"
              button: `UserNotificationListener` reads the centre, it cannot
              activate an entry, and a button that looked like Windows' own and
              did nothing would be worse than none. Everything below acts on the
              text Crest already has. */}
          <div style={{ fontSize: 11, color: color.text.muted }}>
            Still in Windows' notification centre
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => {
                void invoke('copy_to_clipboard', { text: notification.message })
                  .then(() => setCopied(true))
                  .catch(() => {})
              }}
              style={actionStyle}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button type="button" onClick={onSnooze} style={actionStyle}>
              Snooze 5m
            </button>

            {link && (
              <button
                type="button"
                title={link}
                onClick={() => void openUrl(link).catch(() => {})}
                style={actionStyle}
              >
                Open link
              </button>
            )}

            <span style={{ flex: 1 }} />

            <button type="button" onClick={onDismiss} style={actionStyle}>
              Dismiss
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
