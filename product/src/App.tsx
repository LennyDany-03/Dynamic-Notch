import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import ContextMenu, { type MenuAnchor } from './components/ContextMenu'
import NotchShell from './components/NotchShell'
import { playChime } from './components/timer/chime'
import { useNotchState } from './hooks/useNotchState'
import { useMediaAnnounce } from './hooks/useMediaAnnounce'
import { useMediaSession } from './hooks/useMediaSession'
import { useAccentColor } from './hooks/useAccentColor'
import { useAutoUpdate } from './hooks/useAutoUpdate'
import { useCornerRadius } from './hooks/useCornerRadius'
import { useFileShelf } from './hooks/useFileShelf'
import { usePerformance } from './hooks/usePerformance'
import { useReminders } from './hooks/useReminders'
import { useScreenshots } from './hooks/useScreenshots'
import { useSettings } from './hooks/useSettings'
import { useSurfaceOpacity } from './hooks/useSurfaceOpacity'
import { useTheme } from './hooks/useTheme'
import { useSystemStatus } from './hooks/useSystemStatus'
import { useTimer } from './hooks/useTimer'
import { useWeather } from './hooks/useWeather'
import { useWheelCycle } from './hooks/useWheelCycle'
import { useWindowsNotifications } from './hooks/useWindowsNotifications'
import { timing } from './tokens'
import {
  resolvePanels,
  STATE_RANK,
  type Announcement,
  type NotchModule,
  type NotchState,
} from './types/notch'
import type { WinNotification } from './types/notifications'
import type { PerfAlert } from './types/perf'
import type { Reminder } from './types/reminders'
import type { Screenshot } from './types/screenshots'
import type { SystemEvent } from './types/system'

/**
 * Whether this is the notch window that speaks for the app.
 *
 * With "show the notch on every display" on, this component is mounted once per
 * screen: `display.rs` builds `notch-widget-2`, `-3`, … and each is a full
 * instance. Everything the notch *draws* should be duplicated — that is the whole
 * point of mirroring — but anything that acts on the machine's behalf must not be.
 * Today that is exactly one thing, the auto-updater, where two copies would race
 * to download and install the same release.
 *
 * The original window is the lead because it is the one that always exists: it is
 * built from `tauri.conf.json`, it is always the first target in `display.rs`, and
 * a mirror is destroyed the moment its screen goes away.
 *
 * Computed once, at module scope, and defensively: the browser fallback has no
 * Tauri metadata to read a label out of, and it is a single window in any case.
 */
const isLeadNotch = (() => {
  try {
    return getCurrentWindow().label === 'notch-widget'
  } catch {
    return true
  }
})()

export default function App() {
  // "Always on top" is both a z-order and a visibility preference: it keeps the
  // window above other windows *while idle* and keeps the pill on screen instead
  // of letting it collapse away. Rust owns the z-order half; this is the
  // visibility half. A notch that is actually on screen is promoted either way —
  // see the raise/settle pair in `useNotchState`.
  const { settings, loaded } = useSettings()

  // None of these is gated on `loaded`: the defaults here and the CSS fallbacks
  // are the same values, so an unread preference paints exactly what it was
  // already painting. That is the whole reason the copies have to agree.
  useSurfaceOpacity(settings.backgroundOpacity)
  useTheme(settings.theme)
  useAccentColor(settings.accentColor)
  useCornerRadius(settings.cornerRadius)

  /**
   * The adjustable geometry, as one value.
   *
   * Memoised on the three numbers rather than on `settings`, which is a fresh
   * object on every broadcast: this is handed to `useNotchState`, where it is
   * mirrored into a ref that the 60Hz cursor poll reads, and to `NotchShell`. A
   * new identity per broadcast would be harmless in both — neither has it in a
   * dependency list that matters — but the two of them holding *the same object*
   * is the visible statement that the card and its hit rect are one input, which
   * is the invariant `layout.ts` exists for.
   */
  const metrics = useMemo(
    () => ({
      pillWidth: settings.notchWidth,
      pillHeight: settings.notchHeight,
      panelScale: settings.panelScale,
    }),
    [settings.notchWidth, settings.notchHeight, settings.panelScale],
  )

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

  /**
   * Which cards the notch offers, and in what order.
   *
   * Memoised on the stored array, not on `settings`: `useSettings` builds a fresh
   * settings object on every broadcast, and this feeds `useNotchState`'s ring —
   * a new array identity each time would re-run the "is the active card still
   * visible" effect on every unrelated preference change.
   *
   * Not gated on `loaded`. The default is "everything, in the built-in order",
   * which is what the notch would draw anyway, so acting on it before the file
   * lands paints nothing that has to be taken back. That is the same test the
   * opacity and the accent pass and the always-on-top pill fails.
   */
  const panels = useMemo(() => resolvePanels(settings.panels), [settings.panels])

  const {
    state,
    activeModule,
    announcement,
    showModule,
    expand,
    toggle,
    announce,
    nextModule,
    previousModule,
  } = useNotchState({
    // Gated on `loaded` so the default never shows a pill it is about to retract.
    alwaysVisible: loaded && settings.alwaysOnTop,
    notificationsFit,
    modules: panels.visible,
    // Neither is gated on `loaded`, for the reason the opacity is not: the
    // defaults here are the design's own numbers, so acting on them before the
    // file lands is acting on what the notch would have drawn anyway.
    metrics,
    graceMs: settings.collapseDelay,
  })
  announceRef.current = announce

  // Scroll over an open card to move through the ring, alongside the arrows.
  //
  // Only while a card is actually open, and only when there is somewhere to go:
  // this mirrors the arrows exactly, which hide themselves on a ring of one
  // rather than offering a control that returns you to where you already are.
  useWheelCycle({
    enabled: state === 'expanded' && panels.visible.length > 1,
    onNext: nextModule,
    onPrevious: previousModule,
  })

  // The sheet used to be state inside `NotificationsModule` and reset by being
  // unmounted; hoisted, it would still be open the next time the module is
  // reached for — and, until then, would hold the card at its full height for a
  // module nobody is looking at.
  useEffect(() => {
    if (state !== 'expanded' || activeModule !== 'notifications') setOpenNotificationId(null)
  }, [state, activeModule])

  // The tray popup can only ask; the state machine still owns what opens. Both
  // are pinned, because the cursor is down by the taskbar when they arrive.
  //
  // The summon shortcut arrives on the same footing: Rust registers it with
  // Windows and emits when it fires (see `hotkey.rs`), and what that means is the
  // state machine's business, not the keyboard's. Every notch window listens, so
  // with mirroring on the shortcut puts a card on every screen — which is the
  // point of mirroring, and the one thing this cannot narrow down, since which
  // screen the user is looking at is not a thing a keystroke says.
  useEffect(() => {
    const pending = [
      listen('tray-show', () => expand({ pin: true })),
      listen('hotkey-toggle', () => toggle()),
      listen<string>('tray-navigate', (event) => {
        const module = event.payload as NotchModule
        // Checked against the *visible* ring, not every module that exists: the
        // tray only offers what is switched on, but the popup is a separate
        // window reading its own copy of the preference, so a row clicked in the
        // instant between a change and the broadcast could still name a card the
        // notch has just dropped.
        if (panels.visible.includes(module)) showModule(module, { pin: true })
      }),
    ]
    return () => {
      for (const p of pending) void p.then((unlisten) => unlisten())
    }
  }, [expand, showModule, toggle, panels.visible])

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

  // The machine reporting itself: a charger going in or coming out, a Bluetooth
  // device connecting, the network changing. Same banner, same rules — `announce`
  // still decides whether anything is shown.
  //
  // The same poll answers what the charge *is*, which the pill and every card's
  // nav strip draw, so it runs whatever the preference says; the preference gates
  // the announcing. Gated on `loaded` all the same, for the reason the
  // notification poll is: the default is on, and announcing on the strength of a
  // guess is a banner in front of someone who turned this off.
  const battery = useSystemStatus(
    loaded && settings.systemAlerts,
    useCallback(
      (event: SystemEvent) => announce({ kind: 'system', event }, timing.announceMs),
      [announce],
    ),
  )

  // How hard the machine is working, for the system monitor's meters and for the
  // banner that says one of them has been pinned long enough to mean it.
  //
  // Announcing is gated on the same preference as the charger and Wi-Fi banners
  // rather than on one of its own: `systemAlerts` is "does the notch tell me
  // about my machine", and an overload is squarely that. A second switch would
  // ask the user to answer the same question twice.
  //
  // The poll itself is not gated — the card needs its meters however the switch
  // is set — but it does speed up while the card is actually on screen, which is
  // the same trade `useMediaSession` makes with its watch rate.
  const performance = usePerformance(
    state === 'expanded' && activeModule === 'system',
    loaded && settings.systemAlerts,
    useCallback(
      (alert: PerfAlert) => announce({ kind: 'performance', alert }, timing.announceMs),
      [announce],
    ),
  )

  // The forecast. Fetched only once a place is set — Crest deliberately does not
  // guess where the user is, see `weather.rs` — and refreshed on open as well as
  // on its timer, which is cheap because Rust caches for ten minutes.
  const weather = useWeather(
    settings.weatherPlace,
    state === 'expanded' && activeModule === 'weather',
  )

  // Reminders, and the banner for one coming due.
  //
  // Mounted here rather than inside the calendar card for the same reason the
  // notification feed is mounted here: the announcing has to keep working while
  // the card has never been opened, which is almost all of the time. The card
  // takes the same feed as a prop.
  //
  // Gated on `notifications` rather than on `systemAlerts`: a reminder is a
  // message addressed to the user, which is what that preference covers, whereas
  // `systemAlerts` is the machine reporting on itself. The two would be a strange
  // pair — someone who turned off battery banners has said nothing about whether
  // they still want to be told about the dentist.
  const reminders = useReminders(
    loaded && settings.notifications,
    useCallback(
      (reminder: Reminder) => announce({ kind: 'reminder', reminder }, timing.announceMs),
      [announce],
    ),
  )

  // Crest updating itself, silently, with the notch as the only UI.
  //
  // Only the notch window runs this — the tray popup and the settings window
  // mount `useSettings` too, and three copies would race to spend the same parked
  // update. The tray's manual "Check for updates" row is unaffected; it is the
  // deliberate path, and this is the automatic one.
  //
  // And only the *lead* notch window, now that mirroring can mount this component
  // once per screen. Same race, one layer down: three monitors would be three
  // downloads of the same installer, and whichever finished first would restart
  // the app out from under the other two.
  //
  // The cost is that the progress banner appears on the lead screen only, which is
  // the right way round to be wrong: the update needs no watching, and a loader
  // that is missing from one screen is a smaller surprise than three of them
  // fighting over one download.
  const update = useAutoUpdate(isLeadNotch)

  // Held up by re-announcing rather than by a special state.
  //
  // `announce` retracts after `announceMs`, so a single call would drop the
  // loader three seconds into a download. Calling it again on every progress tick
  // resets that timer, which gives the banner exactly the lifetime it should
  // have: up while bytes are arriving, gone by itself if they stop. The state
  // machine needs no new state, no new hit rect and no exception to the pin
  // lease — and the constant cross-fade key (see `announceKey`) is what stops the
  // repeats from remounting the loader.
  //
  // `announce` declines while the cursor is on the notch or a card is open, which
  // is the right call: the update does not need watching, and taking someone's
  // card away to show them a progress bar would be worse than saying nothing.
  useEffect(() => {
    if (update.phase === 'idle') return
    announce(
      {
        kind: 'update',
        phase: update.phase,
        version: update.version,
        progress: update.progress,
      },
      timing.announceMs,
    )
  }, [update.phase, update.version, update.progress, announce])

  // A drag reaching the notch is an unambiguous request for the shelf, so it
  // skips the dwell timer and opens straight to it.
  const revealShelf = useCallback(() => showModule('files'), [showModule])
  const shelf = useFileShelf(revealShelf)

  // Recent screenshots, and the banner for one that has just landed.
  //
  // Mounted here rather than inside the card for the reason the notification feed
  // and the reminders are: the announcing has to keep working while the card has
  // never been opened, which is almost all of the time — and a capture is the one
  // event in this app where the useful moment and the moment it happens are the
  // same one. The card takes the same feed as a prop.
  //
  // Gated on `loaded` like the other two, and for the same reason: the default is
  // on, and starting a poll on the strength of a guess would put a banner in front
  // of someone who had turned the feature off.
  const screenshotsEnabled = loaded && settings.screenshots
  const screenshots = useScreenshots(
    screenshotsEnabled,
    useCallback(
      (shot: Screenshot) => announce({ kind: 'screenshot', shot }, timing.announceMs),
      [announce],
    ),
  )

  // The countdown, and everything that happens when one lands.
  //
  // Mounted here rather than inside the card for the reason the reminder,
  // notification and screenshot feeds are: the pill and every card's nav strip
  // draw a running timer, and it has to keep running while the card has never
  // been opened — which is almost all of the time.
  //
  // Not gated on `loaded`, unlike those three. There is no preference deciding
  // whether the timer *runs*: a countdown the user started is a commitment the
  // app made, and waiting a frame to honour it on the off-chance a setting says
  // otherwise would be the one case where the guess is worse than acting. The
  // preference below gates only the noise it makes.
  const [timerLandedAt, setTimerLandedAt] = useState<number | null>(null)

  const timer = useTimer(
    isLeadNotch,
    useCallback(
      (durationMs: number, landedAt: number) => {
        announce({ kind: 'timer', durationMs, landedAt }, timing.announceMs)

        // The flash. Its whole job is to be what is left when `announce`
        // declines — which it does whenever a card is already open or the cursor
        // is on the notch, i.e. exactly when the user is looking at the notch.
        // Set unconditionally rather than only on that path, because a banner
        // and a pulse together read as one event and are easier to catch than
        // either alone.
        setTimerLandedAt(landedAt)

        // And cleared again once it has played, which is not tidiness. The card
        // is unmounted every time the notch collapses to `hidden` and mounted
        // again on the way back, so a `landedAt` left standing would replay the
        // pulse on every single reopening for the rest of the session — a notch
        // that flashes at you each time you summon it, hours after the timer it
        // was reporting. Comfortably longer than the 1.15s animation.
        window.setTimeout(() => setTimerLandedAt(null), 1600)

        // Gated on `loaded` where the timer itself is not, and the asymmetry is
        // the point: the default is on, and a machine that has never made a
        // sound making one on the strength of an unread guess is exactly the
        // surprise the preference exists to prevent.
        if (loaded && settings.timerSound) playChime()
      },
      [announce, loaded, settings.timerSound],
    ),
  )

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
        battery={battery}
        performance={performance}
        weather={weather}
        reminders={reminders}
        screenshots={screenshots}
        screenshotsEnabled={screenshotsEnabled}
        timer={timer}
        timerLandedAt={timerLandedAt}
        modules={panels.visible}
        metrics={metrics}
        animationSpeed={settings.animationSpeed}
        // Gated on `loaded` for the same reason as the pill: the default is on,
        // and painting a mark on someone's wallpaper on the strength of a guess
        // is a mark they watch disappear a frame later.
        //
        // And gated on always-on-top being *off*, which is the fix for a real
        // bug: the hint draws at the top centre and the resting pill covers that
        // exact spot, so with the preference on the hint can never be seen. It
        // was still being *rendered* for the one commit between `loaded` flipping
        // true and the effect that raises the pill — long enough to fade in and
        // straight back out. From the outside that is a switch you turn on and
        // watch flicker, which reads as broken rather than as inapplicable.
        // Settings now says as much rather than leaving the switch looking dead.
        hotzoneHint={loaded && settings.hotzoneHint && !settings.alwaysOnTop}
      />

      {menu && <ContextMenu anchor={menu} onClose={closeMenu} />}
    </div>
  )
}
