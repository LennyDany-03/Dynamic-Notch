import { AnimatePresence, motion } from 'framer-motion'
import CollapsedPill from './CollapsedPill'
import HotzoneHint from './HotzoneHint'
import ModulePlaceholder from './ModulePlaceholder'
import NavArrows from './NavArrows'
import MediaAnnounce from './media/MediaAnnounce'
import MediaControls from './media/MediaControls'
import NotificationAnnounce from './notifications/NotificationAnnounce'
import PerfAnnounce from './system/PerfAnnounce'
import ReminderAnnounce from './calendar/ReminderAnnounce'
import SystemAnnounce from './system/SystemAnnounce'
import UpdateAnnounce from './updater/UpdateAnnounce'
import CalendarModule from './modules/CalendarModule'
import FilesModule from './modules/FilesModule'
import LauncherModule from './modules/LauncherModule'
import NotificationsModule from './modules/NotificationsModule'
import SystemModule from './modules/SystemModule'
import WeatherModule from './modules/WeatherModule'
import type { MediaSession } from '../hooks/useMediaSession'
import type { FileShelfState } from '../hooks/useFileShelf'
import type { ReminderFeed } from '../hooks/useReminders'
import type { WeatherFeed } from '../hooks/useWeather'
import type { NotificationFeed } from '../hooks/useWindowsNotifications'
import { CARD_TOP, NAV_STRIP_HEIGHT, cardSize, type NotificationsFit } from '../layout'
import { radius, spring } from '../tokens'
import type { Announcement, NotchModule, NotchState } from '../types/notch'
import type { Performance } from '../types/perf'
import type { BatteryStatus } from '../types/system'

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
  /**
   * Which notification's detail sheet is open, and the same fit the state machine
   * hit-tests against — both owned by `App`, because the notifications card is
   * sized to them.
   */
  openNotificationId: string | null
  onOpenNotification: (id: string | null) => void
  notificationsFit: NotificationsFit
  /**
   * The standing charge, drawn on both resting surfaces — the pill and the nav
   * strip of every expanded card. Null on a machine with no battery.
   */
  battery: BatteryStatus | null
  /** The standing load, for the system monitor's meters. Null until the first poll. */
  performance: Performance | null
  /** The forecast, and the state of trying to get it. */
  weather: WeatherFeed
  /** The reminder list. Owned by `App` because the banner needs it card or no card. */
  reminders: ReminderFeed
  /** The cards in the ring, in order — the resolved `panels` preference. */
  modules: readonly NotchModule[]
  /** The "show me where the notch is" preference. See `HotzoneHint`. */
  hotzoneHint: boolean
}

function ModuleContent({
  module,
  session,
  shelf,
  notifications,
  notificationsEnabled,
  openNotificationId,
  onOpenNotification,
  performance,
  weather,
  reminders,
}: {
  module: NotchModule
  session: MediaSession
  shelf: FileShelfState
  notifications: NotificationFeed
  notificationsEnabled: boolean
  openNotificationId: string | null
  onOpenNotification: (id: string | null) => void
  performance: Performance | null
  weather: WeatherFeed
  reminders: ReminderFeed
}) {
  switch (module) {
    case 'media':
      return <MediaControls session={session} />
    case 'files':
      return <FilesModule shelf={shelf} />
    case 'launcher':
      return <LauncherModule active />
    case 'notifications':
      return (
        <NotificationsModule
          feed={notifications}
          enabled={notificationsEnabled}
          openId={openNotificationId}
          onOpen={onOpenNotification}
        />
      )
    case 'system':
      return <SystemModule performance={performance} />
    case 'weather':
      return <WeatherModule feed={weather} />
    case 'calendar':
      return <CalendarModule feed={reminders} />
    default:
      return <ModulePlaceholder module={module} />
  }
}

/**
 * What is drawn on the banner, and the key its cross-fade runs on.
 *
 * Every announcement keys on the specific thing being reported rather than on
 * "an announcement": a second notification arriving while the first is still up,
 * or a charger going back in a second after coming out, has to fade one surface
 * out and the next in. A shared key would swap the text under a fixed surface and
 * read as the first banner having been wrong.
 */
function announceKey(announcement: Announcement | null): string {
  switch (announcement?.kind) {
    case 'notification':
      return `notification:${announcement.notification.id}`
    case 'system':
      return `system:${announcement.event.id}`
    case 'performance':
      return `perf:${announcement.alert.id}`
    case 'reminder':
      return `reminder:${announcement.reminder.id}`
    case 'update':
      // Constant on purpose, unlike every other kind. The updater re-announces
      // on each progress tick to hold the banner up; a key that moved with the
      // percentage would remount the loader fifty times a download and restart
      // its ring from zero every time.
      return 'update'
    default:
      return 'announce'
  }
}

function AnnounceContent({
  announcement,
  session,
}: {
  announcement: Announcement | null
  session: MediaSession
}) {
  switch (announcement?.kind) {
    case 'notification':
      return <NotificationAnnounce notification={announcement.notification} />
    case 'system':
      return <SystemAnnounce event={announcement.event} />
    case 'performance':
      return <PerfAnnounce alert={announcement.alert} />
    case 'reminder':
      return <ReminderAnnounce reminder={announcement.reminder} />
    case 'update':
      return (
        <UpdateAnnounce
          phase={announcement.phase}
          version={announcement.version}
          progress={announcement.progress}
        />
      )
    default:
      // Media is the fallback rather than a case of its own: the announcement is
      // never cleared (see `useNotchState`), so this is also what the banner
      // draws for the frame or two it spends leaving.
      return <MediaAnnounce media={session.media} />
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
  openNotificationId,
  onOpenNotification,
  notificationsFit,
  battery,
  performance,
  weather,
  reminders,
  modules,
  hotzoneHint,
}: Props) {
  // The same call the state machine makes, with the same fit — the card that is
  // drawn and the rect that is hit-tested are one function of one input.
  const { width, height } = cardSize(state, activeModule, notificationsFit)
  const isExpanded = state === 'expanded'
  const isAnnouncing = state === 'announce'
  const peek = cardSize('peek', activeModule)

  // What is drawn inside the card, and the key the cross-fade runs on: a change
  // here fades one surface out and the next in without touching the card itself.
  const surface = isExpanded ? activeModule : isAnnouncing ? announceKey(announcement) : 'peek'

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
                      modules={modules}
                      battery={battery}
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
                          openNotificationId={openNotificationId}
                          onOpenNotification={onOpenNotification}
                          performance={performance}
                          weather={weather}
                          reminders={reminders}
                        />
                      ) : isAnnouncing ? (
                        <AnnounceContent announcement={announcement} session={session} />
                      ) : (
                        <CollapsedPill session={session} battery={battery} />
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
