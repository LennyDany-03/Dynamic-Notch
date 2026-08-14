# Dynamic Notch — Architecture

Save this at the repo root. It's the persistent context for any Claude Code session working on this project — read it before making structural changes.

## What this is

A Windows 11 system-level widget: a floating overlay pinned to top-center of the screen, always-on-top, click-through outside its own bounds. Built with Tauri (Rust backend, native OS access) + React/TypeScript (frontend, all UI). Design language: Fluent 2 (Mica material, Segoe UI Variable, violet accent used sparingly). Full visual spec lives in `Dynamic_Notch_v2_dc.html` at the repo root — treat it as the source of truth for colors/spacing/typography.

## Stack

- **Frontend**: React + TypeScript, Vite
- **Backend**: Tauri (Rust) — required for native Windows APIs (media session, clipboard listener, drag source, app indexing)
- **State**: a single notch-visibility state hook (`useNotchState`) — see State Machine below. Feature-level state (notes content, clipboard history, pinned apps) can use simple React state + Tauri-side persistence; no need for Redux/Zustand at this scale unless state sharing gets messy.
- **Styling**: plain CSS/inline styles matching the Mica recipe in the design HTML — no Tailwind/CSS-in-JS unless already in use.

## Directory structure (target)

```
src/
  components/
    NotchShell.tsx          — the outer window frame, Mica surface, hosts current state
    CollapsedPill.tsx        — 200x32 idle/peek state
    NavDots.tsx               — shared bottom nav between expanded states
    media/
      MediaControls.tsx
      ScrubBar.tsx
    launcher/
      QuickLauncher.tsx
      AppTile.tsx
    clipboard/
      ClipboardHistory.tsx
      ClipboardRow.tsx
    fileshelf/
      FileShelf.tsx
      FileTile.tsx
    notes/
      QuickNotes.tsx
  hooks/
    useNotchState.ts          — hidden | peek | expanded state machine + dwell timer
    useHotzone.ts              — detects cursor entering top-center trigger strip
    useMediaSession.ts         — calls Rust media command, polls/subscribes to now-playing
    useClipboardHistory.ts
    useAppLauncher.ts
  types/
    notch.ts                  — shared types (NotchState, MediaSession, ClipboardEntry, etc.)
  layout.ts                    — card sizes + cursor-interactive bounds, shared by the state
                                  machine (hit-testing) and the shell (rendering) so the two
                                  cannot drift apart
  tokens.ts                    — design tokens (colors, radii, durations) — already exists, extend, don't duplicate

src-tauri/
  src/
    main.rs
    commands/
      media.rs                — GlobalSystemMediaTransportControlsSessionManager bindings
      clipboard.rs             — AddClipboardFormatListener + read/write
      launcher.rs               — Start Menu / installed apps indexing
      drag_drop.rs               — IDropSource/IDataObject native drag source (File Shelf)
    lib.rs
  tauri.conf.json               — window config: always-on-top, transparent, decorations: false,
                                    skip_taskbar: true, click-through region management
```

## State machine

Single source of truth in `useNotchState.ts`:

```
type NotchState = 'hidden' | 'peek' | 'announce' | 'expanded'
```

- `hidden → peek`: cursor enters hotzone (via `useHotzone`), no delay.
- `peek → expanded`: cursor remains in hotzone/pill for 800ms continuous dwell (timer via `setTimeout`, cleared on `mouseleave`).
- `expanded → peek → hidden`: cursor leaves expanded bounds, ~300-500ms grace delay before each step down, timer cleared if cursor re-enters during the grace window.
- Which "page" is showing while `expanded` (Media / Launcher / Clipboard / Files+Notes) is a separate piece of state (`activeModule`), independent of `NotchState`, so switching modules doesn't retrigger the expand animation.
- `announce(announcement, ms)`: `→ announce`, a banner the notch puts up by itself to report something — music starting, a Windows notification arriving, the machine's own state changing (a charger, a Bluetooth device, the network), or a load metric pinned long enough to mean it — retracted after `ms`. Pinned like the tray's openings; the cursor arriving cancels the retract. `media` and `performance` dwell through to the card behind them (the media controls, the system monitor); `notification` and `system` have nothing to open into and are only held up to be read.

All feature components read `NotchState` and `activeModule` from context/hook — they don't independently decide whether to render or animate.

## Native Rust commands (Tauri)

| Command | Purpose | Windows API |
|---|---|---|
| `get_media_session` | Now-playing title/artist/art/position, play/pause/skip | `GlobalSystemMediaTransportControlsSessionManager` (via `windows` crate) |
| `list_installed_apps` | Populate launcher index | Start Menu shortcut scan + registry uninstall keys |
| `start_clipboard_listener` | Push new clipboard entries to frontend | `AddClipboardFormatListener` (via `windows` crate) or `arboard` for a simpler first pass |
| `begin_drag_out` | Let a File Shelf item be dragged into another app's window | `IDropSource` / `IDataObject` (via `windows-rs`) — no equivalent in the webview, must be native |
| `get_system_status` | One snapshot of charger, network and connected Bluetooth devices, for the system banners | `GetSystemPowerStatus` + `NetworkInformation` + `DeviceInformation` / `BluetoothDevice` (via `windows` crate) |
| `get_performance` | One snapshot of CPU, memory, GPU, disk and temperature, for the system monitor and its overload banner | PDH (`\Processor Information`, `\PhysicalDisk`, `\GPU Engine`, `\Thermal Zone Information`) + `GlobalMemoryStatusEx` |
| `power_action` | Sleep, restart or shut down, from the system monitor's power row | `SetSuspendState` / `ExitWindowsEx` with `SeShutdownPrivilege` enabled on the process token |
| `get_weather` / `search_places` | Conditions, a seven-day forecast, and the geocoder behind the location picker | Open-Meteo over `reqwest` — no OS API, and the only outbound request in the app besides the updater |
| `read_reminders` / `write_reminders` | The calendar's reminder store | Flat JSON in the app-data dir, same shape as `notes.rs` |
| `notes_location` | Where Quick Notes are written, for Settings to show and reveal | `app_data_dir` + `revealItemInDir` on the frontend |

Each command should be added only when its corresponding feature is being built (see build order in the master prompt) — don't scaffold all four upfront.

## Persistence

- Quick Notes: pick one of (a) `tauri-plugin-sql` with a local SQLite file, or (b) a flat JSON file in the Tauri app-data dir. Document the choice in this file once made — don't leave it ambiguous across sessions.
- Pinned launcher apps: JSON config in app-data dir.
- Clipboard history: capped list (e.g. last 15 entries), in-memory is fine for v1, persisted to disk only if you decide history should survive app restarts.

## Build order (do not reorder without discussion)

1. Quick Notes (validates state machine + window resize animation)
2. Media Controls (single well-documented WinRT API)
3. Quick Launcher (no OS hooks beyond a one-time scan)
4. Clipboard History (needs a listener + a privacy decision on sensitive content)
5. File Shelf (hardest — native drag source, do last)

## Decisions made

- **The OS window is never resized; cards animate inside a fixed canvas.** The
  overlay is a fixed 560×420 transparent window pinned top-center at y=0, and each
  state's card is animated within it. Spring-resizing a transparent always-on-top
  window on Windows forces the `backdrop-filter` to re-sample every frame, which
  tears. Switching modules still morphs the card A→B directly rather than
  collapsing first, which is the behaviour the spec asks for. Revisit only if the
  canvas turns out to be too small for a future module.
- **Cursor position is polled from the OS, not read from DOM events.** While the
  window is click-through (`setIgnoreCursorEvents(true)`) the webview receives no
  mouse events at all, so `mousemove` cannot drive the state machine. `useHotzone`
  polls at ~60Hz and caches monitor/window geometry, refreshing it every 2s.
- **Nav lives inside the Mica card, and is arrows rather than dots.** The design
  export draws a dot row on bare wallpaper below the card, but that is an artefact
  of each mockup being framed in its own preview box — the gap runs 96px to 128px
  across the three states with no consistent rule. Rendered literally the dots
  landed a couple of hundred pixels below a short card, in the middle of the
  desktop, where they were invisible and every module except media was
  unreachable. Dots also answered neither "which panel am I on" nor "how do I
  move", so the bottom strip now carries a chevron either side of the panel name
  and position.
- **Card heights are the design's content height plus the nav strip.** Media is
  the exception: design state 02 draws a 124px card whose own contents measure
  ~104px against 96px of available space, so the export overflows itself and clips
  the transport row. Its content height is 138.
- **The notifications card is sized to its list; every other card is fixed.** Every
  other module's contents are fixed too — the media card always holds one track,
  the launcher always the same grid — but this one holds however many notifications
  Windows is sitting on. At a fixed 300 it drew a stripe of empty Mica under two
  notifications and held the notch open over it, which is the dead-zone problem
  from the hit rect, this time inside the visible card.
  `layout.notificationsCardHeight` grows it one 44px row at a time up to the 300 in
  `tokens.ts`, which is now a ceiling rather than the card, and past that the list
  scrolls on a half-cut row. Two consequences worth knowing: every box the
  arithmetic counts is pinned to an explicit height in `NotificationsModule` (a row
  that measured itself would drift from the hit rect), and the open detail sheet is
  an input to the height — so which row is open lives in `App`, not in the module.
- **Interactive bounds while expanded are constant across modules** (the largest
  card's width and height, plus the nav row) for the same reason — a hit rect that
  shrinks under a stationary cursor collapses the notch mid-interaction.
- **Settings is its own window, not a fourth module.** The notch collapses as soon
  as the cursor leaves it, which is exactly wrong for a surface you read rather
  than operate; About copy would be unreadable in a card that vanishes. It is
  built at startup and hidden, never rebuilt — same reasoning as the tray popup,
  and `CloseRequested` is intercepted in `lib.rs` so Alt+F4 hides rather than
  destroys the webview. It is the one surface that paints a scrim over `.mica`:
  every other card is a few short rows, this one is a wall of body copy, and at
  the design's .80 alpha the window behind reads straight through it.
- **Always-on-top has to be bounced through `false`, and re-asserted on show.**
  Two separate traps, both verified against tao 0.35.3. First, `WindowState::
  apply_diff` returns early when the requested `ALWAYS_ON_TOP` equals its cached
  value, so `set_always_on_top(true)` on a window tao already believes is on top
  emits no `SetWindowPos` whatsoever — and that cache says nothing about the real
  z-order, which a fullscreen app or another overlay can change behind tao's back.
  Once that happens every re-assert is a silent no-op. `settings::apply` therefore
  sets `false` first when the target is `true`, forcing a genuine z-order write.
  Second, WS_EX_TOPMOST only buys a place in the topmost *band*; the overlay never
  takes focus, so anything else that goes topmost lands above it and stays. The
  frontend calls `notch_raise` on the hidden → visible edge to reclaim the
  position at the one moment it matters. Do not "simplify" either of these back
  into a single `set_always_on_top` call.

  `notch_raise` promotes unconditionally, and `notch_settle` puts the window back
  in whichever band the switch selects. The pair is the point: the band follows
  *whether the notch is on screen*, not the preference alone. A card the user
  reached for and cannot see is a broken notch however the switch is set, and with
  the preference off the window is otherwise below every focused window — click on
  anything, reach for the notch, and it expands behind the app you are using, or
  behind a fullscreen video, with nothing to show for the reach.

  Two earlier versions each got half of this. Promoting unconditionally *without*
  `notch_settle` left a switched-off notch permanently topmost after the first
  hover, which made the switch unobservable. Matching the preference on the way up
  instead — reading `Current` in `notch_raise` — made the switch observable by
  making the notch useless. Scoping promotion to the moments a card is drawn is
  what satisfies both: the switch still decides where the window rests, which is
  also what keeps a transparent click-through window out of the topmost band while
  idle, where Windows would weigh it when deciding whether an app may take
  exclusive fullscreen.

  The frontend raises on two rising edges, both in `useNotchState`. The notch
  *growing* — keyed on `STATE_RANK` rather than on leaving `hidden`, because with
  the pill resting on screen the notch leaves `hidden` exactly once, at startup,
  so an edge-triggered reclaim would never run again and a band lost to a
  fullscreen app hours later would stay lost. And the *cursor arriving*, because a
  pill already resting at `peek` has no growth to key on, and waiting for the
  dwell would leave the user hovering a buried pill with no feedback for 600ms.
  `notch_settle` fires on the opposite edge, when the notch shrinks back to
  `hidden`.

  What none of this reaches is a game in genuine exclusive fullscreen, which owns
  the display outright: no window is composited over it, topmost or otherwise.
  Borderless-fullscreen apps and fullscreen video, which are ordinary topmost
  windows, are covered.
- **"Always on top" is a visibility preference as well as a z-order one.**
  Users read the name as "the notch is always there", not "the notch wins a
  z-order comparison during the moments it happens to be drawn" — an overlay that
  is topmost but invisible looks identical to one that is off. So the switch also
  moves the floor of the visibility machine from `hidden` to `peek`, and the pill
  stays put. Implemented as a floor rather than a mode: every transition above it
  is untouched, so there is no second set of rules to drift out of step with the
  first. The consequences are that `STATE_RANK` — not a test for `hidden` — is how
  anything asks whether the notch grew or shrank, and that Rust has to broadcast
  `settings-changed`, since the switch lives in a window that is not the notch and
  neither window is ever rebuilt.
- **Music starting announces itself on its own surface, not the media card.**
  A track beginning drops a 300×64 banner — art, title, artist, equalizer — for
  `timing.announceMs` (3s) and retracts it. It is a fourth `NotchState` rather
  than a timed `expanded`,
  because opening the player is the wrong event: the full card is 380 wide with a
  scrub bar and three transport buttons the user has no time to aim at, and every
  track change would look like the app opening itself. As a state it also gets
  the two things a card-shaped hack does not — its own hit rect from `layout.ts`
  (so the window is interactive over exactly what is drawn) and the ordinary
  dwell, which carries a hover through to the real media card where the controls
  live. `announce()` is pinned like the tray's openings, since the cursor is off
  wherever the user was working; it declines while the cursor is on the notch or
  a card is already open, on the grounds that the notch is up and nothing is
  being missed.

  Detecting the start is `useMediaAnnounce`, keyed on app + title + artist while
  playing, off the poll everything else reads. The consequence is that
  `useMediaSession` can no longer stop polling while hidden — hidden is precisely
  when this has to fire — so it drops to a 2s watch rate instead of stopping, and
  keeps the 1s rate only while something is on screen to interpolate for. The
  first settled poll is a baseline and never announces: music already playing
  when the overlay launches is not something the user just started.
- **Windows notifications use the same banner, and can replace Windows' own.**
  `useWindowsNotifications` polls `UserNotificationListener` every 2s and
  announces ids the previous poll did not have (first poll is a baseline, or
  launching Crest replays the whole notification centre; the seen set is pruned
  to what the centre still holds so it cannot grow all day). Polled rather than
  subscribed because the WinRT change event is not raised for unpackaged desktop
  apps. A burst announces one banner, not ten — the API does not order its
  results, so there is no "newest" to pick, and the rest are in the notification
  centre regardless.

  The banner carries the raising app's icon, resolved through the launcher's
  `icons::app_icon` on `shell:AppsFolder\<AUMID>` — the same shell imaging call
  that puts icons on launcher tiles. **Not** `AppInfo.DisplayInfo.GetLogo`, which
  is a trap twice over: `OpenReadAsync().get()` on the stream it returns never
  completes on a worker thread (the operation is created and never signalled, in
  either apartment — measured: every icon cost a 3s timeout and came back
  `None`), and `AppInfo::GetFromAppUserModelId` cannot see unpackaged apps at all
  ("element not found" for Discord, i.e. most of what notifies you). The shell
  route answers in ~250ms cold and from cache thereafter. It is fetched by the
  banner itself, not handed to it, so an icon can never delay or block the
  notification; and per announcement rather than with the poll, since an icon for
  every entry in the centre re-serialised every two seconds is a lot of base64 to
  draw one of them. What no route reaches is the picture inside the toast, the
  contact photo on a message: `NotificationBinding` exposes text elements and
  nothing else.

  The banner is read-only, unlike Windows' own: clicking a toast button activates
  the notification in the app that raised it, and the listener API cannot do that
  — a button that only looked like Windows' would be worse than no button.

  `muteWindowsBanners` is the other half, and the mechanism took two attempts.
  `NOC_GLOBAL_SETTING_TOASTS_ENABLED = 0` under
  `HKCU\...\CurrentVersion\Notifications\Settings` is widely described as the
  global "show notification banners" switch, and on Windows 11 26200 it simply
  does not work — verified: the value read back as `0` while banners kept
  arriving. What does work is the *per-app* `ShowBanner = 0` under that key's
  `<AUMID>` subkeys, the value behind the per-app checkbox in Settings, which the
  shell reads as each notification arrives (so it takes effect immediately, with
  no sign-out). Muting is therefore a sweep over every app the shell knows about;
  the global value is still written for the builds that honour it, but nothing
  depends on it. Never `Enabled` (per-app) or `PushNotifications\ToastEnabled`
  (global): both stop delivery, which would silence the notch along with the
  shell.

  An app that registers after a sweep is caught at the first notification it
  raises — `mute_app_on_sight`, off the poll that was reading the centre anyway —
  so it costs one banner rather than waiting for the next restart.

  This is the one preference that changes something outside the app, so it is
  fenced on all sides: refused unless the notch's own half is on *and* the
  listener has access (either way the user would end up with no notification
  anywhere); un-muted when the notch's half is switched off, and on the next
  apply if access is revoked; and undone by `settings::shutdown` on
  `RunEvent::Exit`, since a muted shell outliving the app that stood in for it is
  nobody's preference. The memo of what to put back lives in
  `notification-banners.json` in the app-data dir rather than in `settings.json`
  — it is a record of changes made outside the app, it is the size of the user's
  installed software, and the settings window has no business reading it. An app
  whose banner was already off is deliberately left out of it: giving that one
  back later would hand the user a setting they never had.
- **Preferences live in `settings.json`, applied through one function.**
  `settings::apply` is the only place that maps a stored preference onto window
  state, and it runs at startup, on every change, and on every appearance — so a
  preference cannot be honoured live but forgotten on relaunch. The running app
  answers from `settings::Current`, an in-memory copy seeded at startup, because
  `notch_settle` is on a hot path and has no business reading a file. Every field is
  `#[serde(default = ...)]`-ed: the first launch after any new preference ships
  reads a file that predates it, and a bare derive would fail the whole parse and
  reset every other preference with it. The always-on-top default must agree with
  `alwaysOnTop` in `tauri.conf.json`, since the window is built from that config
  and only corrected afterwards.
- **The position preference moves the window, not the card.** `notchPosition`
  (`left | center | right`) is applied by `settings::apply_position`, which sets
  the overlay's origin along the free span between the two edges of the primary
  monitor — the window is never resized, so its origin is the only thing to
  decide. Everything on the frontend lays out from `window.innerWidth / 2` and
  follows for free; nothing there reads the preference except the picker that
  edits it. Offsetting the card *inside* the 560px canvas was the alternative and
  is not a position change: the widest card is 440, so the whole travel would be
  60px. This is also why `lib.rs` no longer centres the window at startup —
  `apply` places it, so the stored position is honoured on the first frame rather
  than as a visible correction afterwards.

  The one thing that does not follow for free is `useHotzone`'s cached window
  origin: it refreshes on a 2s cadence, and a stale origin means the notch
  hit-tests where it used to be. It invalidates on the `settings-changed`
  broadcast — twice, 250ms apart, because `set_position` is queued onto the window
  thread and can still be in flight when Rust emits.
- **`hotzoneHint` is a hint, not a surface.** A 80×4 mark at the top edge, exactly
  the width of the trigger strip, drawn only while `state === 'hidden'`: the notch
  is invisible until the cursor finds it, and where to send the cursor is the one
  question a new install cannot answer for itself. It needs no behaviour — it sits
  in the shell's click-through canvas with pointer events off, and hovering it is
  just the ordinary hotzone entry. Nothing is drawn once the pill rests on screen
  (always-on-top), because then there is nothing left to point at.
- **The machine's own state is a banner, not a module.** Charger, Bluetooth and
  Wi-Fi come in through `announce` as a third kind of `Announcement`, drawn by
  `SystemAnnounce` on the same 300×64 surface as the other two — so they cost no
  new geometry at all: the announce hit rect stays a function of `state` alone,
  and no card grows `EXPANDED_BOUNDS`. A page was the obvious alternative and is
  the wrong shape for this. Windows already keeps all three in its tray, a click
  away, so a card would be a worse copy of something that exists; what it cannot
  do is *tell* you, at the instant it happens, that the charger you thought you
  plugged in is not charging. None of the three has anything actionable on it
  either — the cable is in your hand.

  The charge itself *is* a standing value, and that half is a badge rather than a
  banner: `BatteryBadge` draws it on the collapsed pill and in the nav strip of
  every expanded card, which between them are what is on screen whenever anything
  is. The pill was re-laid out around it — 264×34 and a three-column grid with
  equal outer columns, so the clock sits on the centre line by construction rather
  than by being absolutely positioned across the pill and kept clear by arithmetic.
  The marks either side are matched chips: the same height, radius and surface, so
  a wordless music indicator and a number read as the same kind of thing. The
  right-hand playing dot went with it, being a second copy of what the equalizer
  already says. It hangs off the end of the nav strip with its own width mirrored on the
  other side, so the chevrons stay symmetric about the card's centre; nothing
  about the card's geometry changes. This is also why the preference gates the
  *announcing* and not the poll — the badge needs the data either way — and why
  `get_system_status` takes a `bluetooth` flag: the device enumeration is ~50ms of
  a snapshot that is otherwise microseconds, and it feeds nothing but the banner.
  With it off no baseline is kept, so turning the preference back on re-baselines
  rather than announcing every device that was connected all along.

  `system.rs` answers one command with one snapshot and keeps no memory of its
  own; `useSystemStatus` polls it at 2s and owns the whole notion of what counts
  as an event. That split is deliberate: the diff has to live next to the thing
  that knows whether the notch is free to show a banner, and the three
  subsystems are polled together because they are read together — one timer, one
  bridge round trip, one consistent moment.

  Two rules in that hook are load-bearing, and both come from the difference
  between an arrival and a loss. Arrivals are reported on sight, because the
  latency is the whole point: a plug that is acknowledged four seconds later
  reads as a coincidence. Losses have to survive a second poll first, because
  losses flap — Wi-Fi drops for a DHCP renew, a headset drops for a moment when
  it switches between its handsfree and stereo profiles, and both come back
  within a poll. Without that, a user who did nothing and noticed nothing gets a
  "disconnected" banner followed by a "connected" one. And only the first event
  of a poll is announced: waking a laptop finds the charger out, the network
  changed and the headset gone at once, and three banners in a row is a notch
  that will not go away.

  Everything WinRT here goes through `system::await_op` rather than `.get()`.
  The poll runs every two seconds on a Tauri worker; one operation that is
  created and never signalled — see the logo trap in `notifications.rs` — would
  take a thread with it every time. A bounded wait costs a missing field
  instead. The class of device is cached per device id for the same reason in
  miniature: a headset connected all day is one lookup, not one per poll, and a
  device that fails the lookup caches `Other` rather than being retried forever.
- **The system banner's animation is the message.** `SystemGlyphs` draws the plug
  sliding into the battery, the charge running out to the level Windows reports,
  the arcs coming in from the Wi-Fi dot, the rings going out from a device that
  just connected. The words underneath are the detail you read only if the
  movement was not what you expected — which is why the glyphs are stroke-only
  (a stroked path can be *drawn*; a filled one can only appear) and why a loss
  gets no ring of its own: inventing a movement for it would give the two events
  equal weight. A connected Bluetooth device is drawn as the thing it is —
  headphones, a phone, a watch — from the class of device in the snapshot,
  because a picture of the object is recognised before a name is read, and three
  seconds is all there is.
- **The system monitor is a fifth module, and the overload banner is a fourth
  announcement.** `perf.rs` answers one snapshot of CPU, memory, GPU, disk and
  temperature; `usePerformance` polls it, `SystemModule` draws it, and the same
  poll decides when the machine has been struggling long enough to say so.

  It is deliberately *not* folded into `system.rs`. That module answers "what is
  attached" — every field in it is a state that changes because the user did
  something with their hands, so an event is an edge and there is exactly one
  moment to report. Load is a set of rates that move continuously, and nothing
  but arithmetic can turn a level into a moment. Keeping them apart also keeps
  the cheap snapshot cheap: the battery badge on the pill polls `system.rs` for
  the life of the process and has no use for a PDH round trip.

  **Almost everything is read through PDH rather than a Win32 call**, and the two
  cases where that looks like the wrong choice are the reasons. CPU could be
  `GetSystemTimes` diffed by hand; `% Processor Utility` is what Task Manager's
  CPU column shows, and it is a *different number* — scaled by the frequency the
  cores actually ran at — so a user comparing the notch against Task Manager
  would find the notch wrong. Temperature could be WMI's
  `MSAcpi_ThermalZoneTemperature`, which is the answer every search gives and
  which needs a COM apartment, a proxy blanket and an elevation the notch does
  not have; `\Thermal Zone Information(*)` is the same ACPI reading through a
  handle the file already owns. Disk is `% Idle Time` subtracted from 100 and not
  `% Disk Time`, which sums per-request service times and reports 800% at a queue
  depth of eight. GPU sums `\GPU Engine(*)` within an engine type and takes the
  busiest type, which is again what Task Manager does.

  The counters are opened once and live for the process, because three of the
  four are rates and PDH computes a rate between two collections — a query opened
  and closed per call would answer "no data yet" forever. That is why CPU, GPU and
  disk are `None` on the first snapshot, and why there is no "have we collected
  yet" flag: each counter's own `CStatus` reports it, and a flag would wrongly
  suppress the thermal zone, which is an instantaneous reading.

  **Turning a level into an event takes four rules**, all in `usePerformance` and
  all load-bearing. *Sustain*: three consecutive polls above the threshold, or the
  notch announces every application launch. *Hysteresis*: no re-arm until the
  metric has fallen 15 points below its threshold, or a machine sitting at 90.4%
  crosses its own line a dozen times a minute. *Cooldown*: five minutes between
  alerts about the same metric, because a long build genuinely does load and
  unload the CPU for half an hour and the user learned what they needed from the
  first banner. *Warm-up*: the first three polls are discarded, because Crest
  launching is itself a CPU spike. One alert per poll, as in `useSystemStatus` —
  a machine that is genuinely struggling has all four meters up.

  The banner's third line is always the *other* meters, never a restatement of
  the one that tripped. "CPU at 97%" alone is not actionable; next to a disk at
  4% it is a build, and next to a disk at 99% it is a machine paging itself to
  death, and those want different responses.

  **The power row is armed before it fires.** Sleep, restart and shut down live
  on this card because the reason to reach for them is usually the reason you are
  looking at the meters — but the notch expands on *hover*, so a live shutdown
  button is one stray click from taking the machine down. The first click turns
  the row into a question and the second answers it, and the arming expires by
  itself after four seconds, which matters because the notch collapses on its own
  timer and a card reopened later must not still be primed. `power_action`
  restores Windows' notification banners before handing over: the shell does not
  reliably give a hidden always-on-top overlay a clean exit, and rebooting into a
  silenced notification centre with nothing running to make up for it is the
  worst thing this app could leave behind.

  Both halves sit behind the existing `systemAlerts` preference rather than a new
  one. It answers a single question — does the notch tell me about my machine —
  and a second switch would ask the user to answer it twice. As with the charge
  on the pill, the preference gates the *announcing* and not the poll: the meters
  are drawn whether or not anything is ever announced.
- **The accent is a preference, delivered as one CSS variable.** `tokens.ts` hands
  out `var(--accent)` instead of the export's `#7C3AED`, and `useAccentColor`
  writes the variable onto each window's `:root` — the same mechanism
  `useSurfaceOpacity` uses for `--mica-alpha`, and for the same reason: the accent
  is read by around twenty components across three windows, and threading a hex
  through all of them would put a preference into every component that happens to
  draw something active. Inline styles take `var()`, so every existing
  `color.accent` reader followed for free and the change touched three hardcoded
  `rgba(124,58,237,…)` literals and nothing else.

  `--accent-bright` and the two washes are `color-mix`ed off `--accent` in CSS
  rather than stored as their own preferences. A user cannot then put them out of
  step with each other: pick any hue and the equalizer bar stays the lighter
  relative of the scrub bar. `color.load.warn` and `.hot` are deliberately outside
  this — they mean caution and stop, and someone with a red accent would otherwise
  have three reds meaning three different things.

  Rust validates rather than clamps, unlike the opacity slider. The two controls
  are a swatch (which can only send something valid) and a text field (where a
  half-typed `#7C3` is a value nobody has finished choosing); coercing it would
  paint the app a shade nobody asked for mid-keystroke. The normalised value is
  returned so `7c3aed` pasted out of a design tool tidies itself up in the field.
- **Weather reaches outside the machine, so the user points it there first.**
  Open-Meteo, because no API key exists to ship in a public binary or ask a user
  to register for. Fetched in Rust rather than with `fetch` in the webview — the
  CSP is open and it would have worked, but then the one piece of external I/O in
  the app would be the one piece not behind an `invoke`, with no timeout, no
  bounded cache and no stated user agent.

  **There is deliberately no automatic location.** Every way of guessing reaches
  outside: an IP lookup hands a third party the user's approximate address the
  moment the app launches, and the Windows location capability is a permission
  prompt for a feature nobody has asked for yet. This is the same rule
  `notifications.rs` follows for `mute_windows_banners`. So `weatherPlace` is a
  preference, set by searching the geocoder in Settings, and `useWeather` does not
  poll at all until it is set — the module says as much rather than sitting empty.

  The stored place keeps coordinates *and* the resolved name: the forecast API
  takes coordinates, a name is ambiguous (there are some thirty Springfields), and
  re-geocoding on every poll would be a second request to answer a question the
  user already answered by picking a row. Rust caches ten minutes, the hook asks
  every five and on every card open, so the card is instant and Open-Meteo sees
  roughly one request per install per ten minutes.
- **The calendar is a store plus a clock, and the clock is entirely on the
  frontend.** `reminders.rs` is `notes.rs` again — flat JSON, written whole, no
  schema to migrate. Everything about *time* lives in `useReminders`, because the
  only clock that matters is the machine's own and Rust has no business having an
  opinion about it.

  Reminders are stored as an instant (Unix millis), not a wall-clock string. A
  string would mean deciding what a 6pm reminder does when the machine's zone
  changes, and a sticky note does not have an answer to that either. `firedAt` is
  **persisted**, which is the part that is easy to get wrong: an in-memory
  "already announced" set replays every overdue reminder on every launch, and the
  notch relaunches on every update. It also means a reminder that came due while
  Crest was closed is announced once, on the next launch, rather than never or
  forever — bounded at twelve hours, so a fortnight away does not throw up last
  Tuesday's dentist.

  The tick is 20 seconds. A reminder that fires fourteen seconds late is on time
  by any standard a sticky note is held to, and a per-second timer in an
  always-running overlay is a per-second wake for the life of the process.

  The month grid always draws six week rows, even in a month that needs five. A
  grid that changed height would change the card's height, and the notch would
  visibly resize as the user paged through the year.

  **`monthGrid` carries the start as a day offset, not as a Date.** The version
  that shipped first built the start date and then read `start.getDate()` off it,
  which is wrong in a way that hides: for August 2026 the grid starts on 26 July,
  `getDate()` returns 26, and `new Date(2026, 7, 26 + i)` is 26 *August* — so the
  whole grid ran a month late with every weekday column misaligned, and it only
  looked plausible because the first row's numbers happened to be right. Handing
  the raw offset to the `Date` constructor (`new Date(2026, 7, -5)` is 26 July)
  lets it do the normalising, and there is no intermediate value to misread.
- **The time picker is ours because `<input type="time">` cannot be.** Its picker
  is a *native popup* — a real OS window, positioned by Chromium and free to
  extend past the page. On an ordinary page that is what you want. Here the page
  is a 560×420 transparent overlay pinned to the top of the screen, so the popup
  opened downward across the desktop, painted over whatever was behind it, and sat
  entirely outside the rect `layout.contentRect` hit-tests — which meant the notch
  counted the cursor as away, started its grace timer, and collapsed the card out
  from under a popup that was still on screen.

  So `TimePicker` draws a panel inside the card, in the card's own coordinate
  space, opening upward and rightward from a trigger at the bottom of the day
  pane — the one direction with room left. Minutes are in five-minute steps
  because a reminder is not a stopwatch and sixty rows in a 130px column is a
  scroll nobody wants; a value that is not on the grid highlights nothing rather
  than snapping to a neighbour that would misreport it. The value stays 24-hour
  `HH:MM`, the same string the native input produced, so nothing downstream
  changed.

  The general rule this is an instance of: **any native popup is out of bounds in
  the overlay window.** Selects, date inputs, colour inputs and context menus all
  have the same problem, and all of them need an in-card equivalent.
- **The notes pane uses a different control at each size, and that is the point.**
  The export drew one borderless textarea, which had two faults that only showed
  in use: it was four lines tall, and every note past the first was *unreachable*
  — `+` created them and the pane only ever drew `notes[0]`.

  The first fix was a list rail down the left of the pane, and it was worse than
  the problem. The inline pane is 210px wide, so the rail got 62 of them: titles
  like "flip-bottle-of-water" wrapped to two clipped lines, the active row's faint
  accent wash was indistinguishable from the tile behind it, and the editor was
  left with 138px to type in. The mistake was using one shape at both sizes.

  So the two views are now different controls over the same notes. **Inline**, the
  editor gets the whole pane (194px, up from 138) and switching is a horizontal
  strip of chips above it — titles run along the axis they are actually written
  on, the strip scrolls, and it only exists when there is more than one note.
  **Expanded**, there is room for a real list beside the editor: title, when it was
  last touched, and a visible delete instead of a right-click nobody could
  discover. The active chip takes a *filled* accent rather than a wash, because at
  20px a wash reads as no selection at all.

  Titles come from each note's own first line (`noteTitle`) — asking someone to
  name a thought before they can write it down is the friction this module exists
  to remove — and `addNote` is a no-op when the open note is already blank, or "+"
  on an empty note makes a second empty note and the switcher fills with identical
  "Untitled" chips.

  The expansion is a swap *inside* the fixed card, not a bigger card. Same
  constraint as `NotificationDetail`: anything drawn outside the card's own rect
  sits on a click-through region and would take no clicks. It also means the state
  machine never has to know the expansion exists.

  The card went to 346 — the launcher's height, the tallest there is — and that
  overshot. A shelf holding two files drew a dashed box with 150px of nothing in
  it, which is the dead zone `contentRect` warns about, self-inflicted and inside
  the visible card: it holds the notch open over emptiness. It is 260 now, which
  fits two rows of tiles with the box actually filled and nine lines of note
  inline, and the answer to "I need more room" is the expansion rather than a card
  permanently sized for the longest note anyone might write.
- **Which cards the notch offers is a preference, not a literal.** `MODULES` was
  the ring; it is now only the default order and the canonical set of modules
  that exist. `panels` — an ordered list of `{ id, visible }` — is what the arrows
  cycle, resolved by `resolvePanels`. Seven cards is past the point where a ring
  is comfortable to walk, and the sequence was whatever suited whoever added the
  last one.

  Everything that read `MODULES` reads the resolved list: the nav counter (so it
  says "2/3" and not "4/7"), `cycleModule`, the tray popup's module rows, and the
  `tray-navigate` guard. `useNotchState` also corrects `activeModule` when the
  card on screen is switched off — without it the notch keeps drawing a card the
  arrows can no longer reach, because `cycleModule` steps from a position in the
  ring that no longer contains it.

  All the difficulty is in reconciliation, and it is in one function. Four ways
  the stored value and the code can disagree, all of which have to survive: a
  module that shipped in an update is **appended visible** (silently never
  appearing is indistinguishable from a bug), a removed one is dropped,
  duplicates take the first, and everything-switched-off falls back to all. The
  picker refuses to remove the last visible card, but the file is hand-editable
  and the running app must not depend on the picker having been the writer.

  Rust stores `id` as an opaque string and never interprets it. Which modules
  exist is a frontend fact — a component, a size token and a switch arm — so
  teaching `settings.rs` the set would mean editing Rust to add a card, and it
  could not know what to do about an id from a newer build anyway.

  The reorder is `framer-motion`'s `Reorder`, with one non-obvious bit:
  `onReorder` fires on every swap *during* the gesture, not on drop. Writing each
  of those straight through would round-trip via Rust and come back as a
  freshly-parsed array, changing every item's `value` identity underneath the
  drag — and Framer matches items by that identity, so the gesture dies on the
  spot. The drag therefore moves local state and commits once, on release.
- **The hotzone hint is suppressed while always-on-top is on.** The mark draws at
  the top centre and the resting pill covers that exact spot, so with the
  preference on it can never be seen — but it was still being *rendered* for the
  one commit between `loaded` flipping true and the effect that raises the pill,
  which is long enough to fade in and back out. A switch you turn on and watch
  flicker reads as broken rather than as inapplicable. It is gated off outright
  now and the Settings row is disabled with a line explaining that the pill is
  already sitting where the mark would go. Drawing it under the pill is not a fix.
- **The notes row in Settings reads the notes; it does not reveal the file.** It
  opened Explorer on `notes.json`, which answers the wrong question: someone
  asking where their notes are is asking to *read* them, and following the button
  got them a file Windows has nothing registered for — and, in an editor,
  `[{"id":"a3f…","body":"lost-in-space\nbgmi"}]`. That is the storage format, not
  the notes. `NotesViewer` renders the same content as text, with newlines intact
  and the body selectable. `useSavedNotes` is a separate read-only hook rather
  than a flag on `useQuickNotes`: mounting the writer in the settings window would
  put two debounced autosaves on one file, and whichever rendered last would win.
- **The settings window is six panes, not two.** A single "Settings" pane had
  grown past a screenful, and several things in it were worse than merely long.
  *Appearance* — the accent and the opacity — is the pair people come back to and
  adjust, and buried under the first heading of a long scroller they were findable
  only by remembering they were there. *Weather* is not a preference at all: it is
  the one thing Crest has to be **told** before a feature works, and sitting three
  groups down among switches it read as an option for something you already had.
  *Panels* and *Notes* followed for the same reason — neither is a switch, and
  both are things people go looking for rather than adjust in passing. What is
  left under "Settings" is switches about behaviour, which is what the word means.
- **The equalizer is drawn only while audio is playing.** It used to be permanent
  — dimmed with no session, frozen low when paused — on the reasoning that a
  stable pill is a calm one. In use it was the opposite: the pill rests on screen
  all day for anyone with always-on-top set, so three grey bars became something
  you stopped seeing, and then the equalizer *moving* stopped being news. Nothing
  takes its place and the clock does not shift, because the pill's outer columns
  are fixed width — which is what the three-column grid was for.

## Open decisions (fill in as they're made)

- [ ] Notes persistence: SQLite vs JSON — **TBD**
- [ ] Clipboard sensitive-content handling — **TBD**
- [ ] Whether idle pill shows persistently or only on hover (settings toggle vs fixed behavior) — **TBD**
- [ ] `Dynamic_Notch_v2_dc.html` is referenced above as the visual source of truth
      but is **not currently in the repo** — it has only been passed in as a chat
      attachment. Drop the original file at the repo root so future sessions can
      read it rather than working from a transcription.