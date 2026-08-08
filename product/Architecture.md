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
type NotchState = 'hidden' | 'peek' | 'expanded'
```

- `hidden → peek`: cursor enters hotzone (via `useHotzone`), no delay.
- `peek → expanded`: cursor remains in hotzone/pill for 800ms continuous dwell (timer via `setTimeout`, cleared on `mouseleave`).
- `expanded → peek → hidden`: cursor leaves expanded bounds, ~300-500ms grace delay before each step down, timer cleared if cursor re-enters during the grace window.
- Which "page" is showing while `expanded` (Media / Launcher / Clipboard / Files+Notes) is a separate piece of state (`activeModule`), independent of `NotchState`, so switching modules doesn't retrigger the expand animation.

All feature components read `NotchState` and `activeModule` from context/hook — they don't independently decide whether to render or animate.

## Native Rust commands (Tauri)

| Command | Purpose | Windows API |
|---|---|---|
| `get_media_session` | Now-playing title/artist/art/position, play/pause/skip | `GlobalSystemMediaTransportControlsSessionManager` (via `windows` crate) |
| `list_installed_apps` | Populate launcher index | Start Menu shortcut scan + registry uninstall keys |
| `start_clipboard_listener` | Push new clipboard entries to frontend | `AddClipboardFormatListener` (via `windows` crate) or `arboard` for a simpler first pass |
| `begin_drag_out` | Let a File Shelf item be dragged into another app's window | `IDropSource` / `IDataObject` (via `windows-rs`) — no equivalent in the webview, must be native |

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

  `notch_raise` asks Rust to *match the stored preference*, not to rise: it reads
  `Current` and applies whichever band the switch selects. It once promoted
  unconditionally, on the theory that a switched-off notch could still be topmost
  for the moments it was on screen — which made the switch unobservable, since the
  hover that revealed the notch also undid the demotion the switch had just
  performed. The band tracks the preference at all times now, which is also why
  there is no counterpart on the way down: nothing to undo.

  It fires whenever the notch *grows* rather than when it leaves `hidden`. With
  the pill resting on screen the notch leaves `hidden` exactly once, at startup,
  so an edge-triggered reclaim would never run again and a band lost to a
  fullscreen app hours later would stay lost.
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
- **Preferences live in `settings.json`, applied through one function.**
  `settings::apply` is the only place that maps a stored preference onto window
  state, and it runs at startup, on every change, and on every appearance — so a
  preference cannot be honoured live but forgotten on relaunch. The running app
  answers from `settings::Current`, an in-memory copy seeded at startup, because
  `notch_raise` is on a hot path and has no business reading a file. Every field is
  `#[serde(default = ...)]`-ed: the first launch after any new preference ships
  reads a file that predates it, and a bare derive would fail the whole parse and
  reset every other preference with it. The always-on-top default must agree with
  `alwaysOnTop` in `tauri.conf.json`, since the window is built from that config
  and only corrected afterwards.

## Open decisions (fill in as they're made)

- [ ] Notes persistence: SQLite vs JSON — **TBD**
- [ ] Clipboard sensitive-content handling — **TBD**
- [ ] Whether idle pill shows persistently or only on hover (settings toggle vs fixed behavior) — **TBD**
- [ ] `Dynamic_Notch_v2_dc.html` is referenced above as the visual source of truth
      but is **not currently in the repo** — it has only been passed in as a chat
      attachment. Drop the original file at the repo root so future sessions can
      read it rather than working from a transcription.