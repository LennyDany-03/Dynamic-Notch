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
- `announce(announcement, ms)`: `→ announce`, a banner the notch puts up by itself to report something — music starting, a Windows notification arriving, or the machine's own state changing (a charger, a Bluetooth device, the network) — retracted after `ms`. Pinned like the tray's openings; the cursor arriving cancels the retract. A `media` announcement dwells through to the media card; `notification` and `system` have nothing to open into and are only held up to be read.

All feature components read `NotchState` and `activeModule` from context/hook — they don't independently decide whether to render or animate.

## Native Rust commands (Tauri)

| Command | Purpose | Windows API |
|---|---|---|
| `get_media_session` | Now-playing title/artist/art/position, play/pause/skip | `GlobalSystemMediaTransportControlsSessionManager` (via `windows` crate) |
| `list_installed_apps` | Populate launcher index | Start Menu shortcut scan + registry uninstall keys |
| `start_clipboard_listener` | Push new clipboard entries to frontend | `AddClipboardFormatListener` (via `windows` crate) or `arboard` for a simpler first pass |
| `begin_drag_out` | Let a File Shelf item be dragged into another app's window | `IDropSource` / `IDataObject` (via `windows-rs`) — no equivalent in the webview, must be native |
| `get_system_status` | One snapshot of charger, network and connected Bluetooth devices, for the system banners | `GetSystemPowerStatus` + `NetworkInformation` + `DeviceInformation` / `BluetoothDevice` (via `windows` crate) |

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

## Open decisions (fill in as they're made)

- [ ] Notes persistence: SQLite vs JSON — **TBD**
- [ ] Clipboard sensitive-content handling — **TBD**
- [ ] Whether idle pill shows persistently or only on hover (settings toggle vs fixed behavior) — **TBD**
- [ ] `Dynamic_Notch_v2_dc.html` is referenced above as the visual source of truth
      but is **not currently in the repo** — it has only been passed in as a chat
      attachment. Drop the original file at the repo root so future sessions can
      read it rather than working from a transcription.