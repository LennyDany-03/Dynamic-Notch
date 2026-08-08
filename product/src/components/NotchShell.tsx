import { AnimatePresence, motion } from 'framer-motion'
import CollapsedPill from './CollapsedPill'
import HotzoneHint from './HotzoneHint'
import ModulePlaceholder from './ModulePlaceholder'
import NavArrows from './NavArrows'
import MediaAnnounce from './media/MediaAnnounce'
import MediaControls from './media/MediaControls'
import NotificationAnnounce from './notifications/NotificationAnnounce'
import FilesModule from './modules/FilesModule'
import LauncherModule from './modules/LauncherModule'
import NotificationsModule from './modules/NotificationsModule'
import type { MediaSession } from '../hooks/useMediaSession'
import type { FileShelfState } from '../hooks/useFileShelf'
import type { NotificationFeed } from '../hooks/useWindowsNotifications'
import { CARD_TOP, NAV_STRIP_HEIGHT, cardSize } from '../layout'
import { radius, spring } from '../tokens'
import type { Announcement, NotchModule, NotchState } from '../types/notch'

interface Props {
  state: NotchState
  activeModule: NotchModule
  announcement: Announcement | null
  onPreviousModule: () => void
  onNextModule: () => void
  session: MediaSession
  shelf: FileShelfState
  notifications: NotificationFeed
  /** The "notifications in the notch" preference, for the module's empty state. */
  notificationsEnabled: boolean
  /** The "show me where the notch is" preference. See `HotzoneHint`. */
  hotzoneHint: boolean
}

function ModuleContent({
  module,
  session,
  shelf,
  notifications,
  notificationsEnabled,
}: {
  module: NotchModule
  session: MediaSession
  shelf: FileShelfState
  notifications: NotificationFeed
  notificationsEnabled: boolean
}) {
  switch (module) {
    case 'media':
      return <MediaControls session={session} />
    case 'files':
      return <FilesModule shelf={shelf} />
    case 'launcher':
      return <LauncherModule active />
    case 'notifications':
      return <NotificationsModule feed={notifications} enabled={notificationsEnabled} />
    default:
      return <ModulePlaceholder module={module} />
  }
}

/**
 * The outer window frame: the Mica surface, its spring sizing, and whatever
 * content the current state calls for.
 *
 * Nothing at all renders while hidden. Pointer events are off everywhere except
 * the card, so the transparent canvas never eats a click that belongs to the
 * desktop.
 */
export default function NotchShell({
  state,
  activeModule,
  announcement,
  onPreviousModule,
  onNextModule,
  session,
  shelf,
  notifications,
  notificationsEnabled,
  hotzoneHint,
}: Props) {
  const { width, height } = cardSize(state, activeModule)
  const isExpanded = state === 'expanded'
  const isAnnouncing = state === 'announce'
  const peek = cardSize('peek', activeModule)

  // What is drawn inside the card, and the key the cross-fade runs on: a change
  // here fades one surface out and the next in without touching the card itself.
  // Notifications key on the id as well, so a second one arriving while the first
  // is still up cross-fades rather than swapping text under a fixed key.
  const surface = isExpanded
    ? activeModule
    : isAnnouncing
      ? announcement?.kind === 'notification'
        ? `notification:${announcement.notification.id}`
        : 'announce'
      : 'peek'

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
      {/* Outside the card's wrapper, and its own AnimatePresence: the two swap —
          the hint is only up while the card is not — and sharing a presence
          group would make one wait on the other's exit. */}
      <AnimatePresence>
        {hotzoneHint && state === 'hidden' && <HotzoneHint key="hint" />}
      </AnimatePresence>

      <div
        style={{
          position: 'absolute',
          top: CARD_TOP,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <AnimatePresence>
          {state !== 'hidden' && (
            <motion.div
              key="card"
              className="mica"
              initial={{ width: peek.width, height: peek.height, opacity: 0, y: -8 }}
              animate={{ width, height, opacity: 1, y: 0 }}
              exit={{ width: peek.width, height: peek.height, opacity: 0, y: -8 }}
              transition={isExpanded ? spring.expand : spring.peek}
              style={{ borderRadius: radius.shell, pointerEvents: 'auto' }}
            >
              {/* Sits above .mica::before (noise) and .mica::after (hairline). */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {isExpanded && (
                  <div
                    style={{
                      height: NAV_STRIP_HEIGHT,
                      flex: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <NavArrows
                      active={activeModule}
                      onPrev={onPreviousModule}
                      onNext={onNextModule}
                    />
                  </div>
                )}

                {/* Panels cross-fade in place. `mode="wait"` used to hold the
                    incoming panel back until the outgoing one had finished
                    fading, so switching cost two 120ms fades end to end and read
                    as lag; overlapping them costs one. Absolute positioning is
                    what lets both occupy the box at once, and .mica clips the
                    outgoing panel while the card springs to its new size. */}
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <AnimatePresence initial={false}>
                    <motion.div
                      key={surface}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                      style={{ position: 'absolute', inset: 0 }}
                    >
                      {isExpanded ? (
                        <ModuleContent
                          module={activeModule}
                          session={session}
                          shelf={shelf}
                          notifications={notifications}
                          notificationsEnabled={notificationsEnabled}
                        />
                      ) : isAnnouncing && announcement?.kind === 'notification' ? (
                        <NotificationAnnounce notification={announcement.notification} />
                      ) : isAnnouncing ? (
                        <MediaAnnounce media={session.media} />
                      ) : (
                        <CollapsedPill session={session} />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
