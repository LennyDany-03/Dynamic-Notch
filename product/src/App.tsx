import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import ContextMenu, { type MenuAnchor } from './components/ContextMenu'
import NotchShell from './components/NotchShell'
import { useNotchState } from './hooks/useNotchState'
import { useMediaAnnounce } from './hooks/useMediaAnnounce'
import { useMediaSession } from './hooks/useMediaSession'
import { useFileShelf } from './hooks/useFileShelf'
import { useSettings } from './hooks/useSettings'
import { useSurfaceOpacity } from './hooks/useSurfaceOpacity'
import { useWindowsNotifications } from './hooks/useWindowsNotifications'
import { timing } from './tokens'
import {
  MODULES,
  STATE_RANK,
  type Announcement,
  type NotchModule,
  type NotchState,
} from './types/notch'
import type { WinNotification } from './types/notifications'

export default function App() {
  // "Always on top" is both a z-order and a visibility preference: it keeps the
  // window above other windows *while idle* and keeps the pill on screen instead
  // of letting it collapse away. Rust owns the z-order half; this is the
  // visibility half. A notch that is actually on screen is promoted either way —
  // see the raise/settle pair in `useNotchState`.
  const { settings, loaded } = useSettings()

  // Not gated on `loaded`: the default here and the CSS fallback are the same
  // number, so an unread preference paints exactly what it was already painting.
  useSurfaceOpacity(settings.backgroundOpacity)

  // One poll, two consumers: the same banner for arriving Windows notifications,
  // and the standing list the notifications module draws. Gated on `loaded` as
  // well as the preference, so a default that is about to be corrected does not
  // start a poll — and, more to the point, does not put a banner on screen for
  // someone who turned the feature off.
  //
  // The preference reaches the module too, rather than only the banner: it is one
  // switch for whether the notch reads the notification centre at all, and a list
  // that kept filling itself after the user said no would be a second, silent
  // answer to that question. The module says as much when it is off.
  const notificationsEnabled = loaded && settings.notifications

  // The feed has to be read before the state machine is built, because the
  // notifications card is sized to its list and the machine hit-tests that card —
  // but announcing an arrival is a call *into* the machine. This ref is the cycle
  // broken at its narrowest point: the callback below is stable and reads the
  // current `announce` at the moment a notification lands, which is also exactly
  // what `useWindowsNotifications` wants (it holds the callback in a ref of its
  // own so a new identity does not restart the poll and swallow an arrival).
  const announceRef = useRef<(announcement: Announcement, durationMs: number) => void>(() => {})

  const notifications = useWindowsNotifications(
    notificationsEnabled,
    useCallback((arrived: WinNotification[]) => {
      // One banner per batch. A backlog that lands at once (waking the machine,
      // reconnecting) would otherwise queue up minutes of notch; the rest are
      // in the notification centre either way.
      //
      // Announced on the spot. The app's logo is a second WinRT call and the
      // banner does not wait on it — it is fetched by the banner itself and
      // appears when it appears. A version of this that resolved the icon first
      // showed nothing at all whenever that call was slow, which is a poor
      // trade for an icon arriving a frame early.
      announceRef.current({ kind: 'notification', notification: arrived[0] }, timing.announceMs)
    }, []),
  )

  // Which notification is open in full. Owned here rather than inside the module
  // because the sheet takes the whole card: it is an input to the card's height,
  // and the height is the state machine's business.
  const [openNotificationId, setOpenNotificationId] = useState<string | null>(null)

  const notificationsFit = useMemo(
    () => ({ rows: notifications.notifications.length, detail: openNotificationId !== null }),
    [notifications.notifications.length, openNotificationId],
  )

  const {
    state,
    activeModule,
    announcement,
    showModule,
    expand,
    announce,
    nextModule,
    previousModule,
  } = useNotchState({
    // Gated on `loaded` so the default never shows a pill it is about to retract.
    alwaysVisible: loaded && settings.alwaysOnTop,
    notificationsFit,
  })
  announceRef.current = announce

  // The sheet used to be state inside `NotificationsModule` and reset by being
  // unmounted; hoisted, it would still be open the next time the module is
  // reached for — and, until then, would hold the card at its full height for a
  // module nobody is looking at.
  useEffect(() => {
    if (state !== 'expanded' || activeModule !== 'notifications') setOpenNotificationId(null)
  }, [state, activeModule])

  // The tray popup can only ask; the state machine still owns what opens. Both
  // are pinned, because the cursor is down by the taskbar when they arrive.
  useEffect(() => {
    const pending = [
      listen('tray-show', () => expand({ pin: true })),
      listen<string>('tray-navigate', (event) => {
        const module = event.payload as NotchModule
        if (MODULES.includes(module)) showModule(module, { pin: true })
      }),
    ]
    return () => {
      for (const p of pending) void p.then((unlisten) => unlisten())
    }
  }, [expand, showModule])

  // One poll shared by the collapsed pill and the media card. Drops to a slow
  // watch rate while hidden rather than stopping, so a track starting still
  // registers with nothing on screen.
  const session = useMediaSession(state !== 'hidden')

  // Starting music drops the now-playing banner in for a few seconds, so
  // the notch says what is playing without being asked. The state machine still
  // decides whether that happens — a notch the cursor is already using is left
  // alone.
  useMediaAnnounce(
    session,
    useCallback(() => announce({ kind: 'media' }, timing.announceMs), [announce]),
  )

  // A drag reaching the notch is an unambiguous request for the shelf, so it
  // skips the dwell timer and opens straight to it.
  const revealShelf = useCallback(() => showModule('files'), [showModule])
  const shelf = useFileShelf(revealShelf)

  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])

  // A menu outlives the card that opened it otherwise — the notch collapses on
  // its own timer and would leave the menu floating over nothing. Any step down
  // closes it, rather than only `hidden`: with the pill resting on screen the
  // notch never reaches `hidden`, so keying off that alone would strand a menu
  // over a card that had already shrunk out from under it.
  const menuStateRef = useRef<NotchState>(state)
  useEffect(() => {
    if (STATE_RANK[state] < STATE_RANK[menuStateRef.current]) setMenu(null)
    menuStateRef.current = state
  }, [state])

  return (
    // The shell's transparent canvas has pointer events off, so this only ever
    // fires for a right-click that actually landed on the card.
    <div
      onContextMenu={(event) => {
        event.preventDefault()
        setMenu({ x: event.clientX, y: event.clientY })
      }}
    >
      <NotchShell
        state={state}
        activeModule={activeModule}
        announcement={announcement}
        onPreviousModule={previousModule}
        onNextModule={nextModule}
        session={session}
        shelf={shelf}
        notifications={notifications}
        notificationsEnabled={notificationsEnabled}
        openNotificationId={openNotificationId}
        onOpenNotification={setOpenNotificationId}
        notificationsFit={notificationsFit}
        // Gated on `loaded` for the same reason as the pill: the default is on,
        // and painting a mark on someone's wallpaper on the strength of a guess
        // is a mark they watch disappear a frame later.
        hotzoneHint={loaded && settings.hotzoneHint}
      />

      {menu && <ContextMenu anchor={menu} onClose={closeMenu} />}
    </div>
  )
}
