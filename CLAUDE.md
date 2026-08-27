# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Two projects, one repo

This repository holds two independent applications that share nothing but a git history:

| Path | What | Stack |
|---|---|---|
| repo root (`app/`, `components/site/`, `lib/`) | Crest's marketing site | Next.js 16 App Router, React 19, Tailwind 4 |
| `product/` | **Crest** itself — a Windows 11 always-on-top notch overlay | Tauri 2 (Rust) + React 19 + Vite + Framer Motion |

They have separate `package.json`, `node_modules`, and `tsconfig.json`. Run `npm install` in each directory you intend to work in. The root project deliberately excludes the product from its tooling:

- `tsconfig.json` → `"exclude": ["**/node_modules", "product"]`
- `eslint.config.mjs` → `globalIgnores([... "product/**"])` (linting it drags in the minified `dist/` bundle and crashes ESLint's formatter)

So a root-level `npm run lint` or `tsc` says nothing about `product/`, and vice versa.

## Commands

Marketing site (from repo root):

```bash
npm run dev      # next dev, localhost:3000
npm run build
npm run lint     # eslint
```

Crest (from `product/`):

```bash
npm run tauri dev        # full app: Vite on :1420 + Rust backend
npm run dev              # Vite only — browser fallback, see below
npm run tauri build      # installers → src-tauri/target/release/bundle/
npm run tauri:nsis:build # the same thing, named — the shipping installer
npm run tauri:msix:build # the Store package → src-tauri/target/msix/
npm run tauri:msix:build:local # ↑ re-packed so it can be sideloaded, → target/msix-localtest/
```

The last two are the two distribution paths and they are named rather than
implied because there are now two of them; see [The Store build](#the-store-build-msix).

`npm run build` in `product/` is `vite build` only — no `tsc` step, so type errors do not fail the build. Type-check explicitly with `npx tsc --noEmit` from `product/`.

There is no test suite in either project. Prerequisites for the product: Rust toolchain, Node 18+, Tauri CLI v2.

### Browser fallback

`useHotzone` detects Tauri via `window.__TAURI_INTERNALS__` and falls back to DOM `mousemove` when absent. That means plain `npm run dev` in a browser exercises the whole state machine and all UI, with the viewport standing in for the screen — useful for layout/animation work without a Rust rebuild. Anything calling `invoke()` (media, launcher, clipboard, shelf, notes) will not work there.

## Product architecture

`product/Architecture.md` is the long-form design record, including the rationale for decisions that look wrong out of context. Read it before structural changes. The load-bearing invariants:

**The OS window is never resized.** The overlay is a fixed 560×420 transparent, always-on-top, `skipTaskbar` window pinned at `y: 0` and horizontally centered by `lib.rs` at startup. Cards animate *inside* that canvas. Spring-resizing a transparent always-on-top window on Windows makes `backdrop-filter` re-sample every frame and tears.

**Cursor position is polled from the OS, not read from DOM events.** The window sits in `setIgnoreCursorEvents(true)` whenever the cursor is not over card content, so the webview receives no mouse events at all. `useHotzone` polls `cursorPosition()` at ~60Hz, caches monitor/window geometry (refreshed every 2s), and converts physical screen px → window-local CSS px.

**`src/layout.ts` is the single source of geometry**, read by both the state machine (hit-testing) and `NotchShell` (rendering) so the visible card and the interactive bounds cannot drift apart. It now takes a `NotchMetrics` — the pill's size and the card-width scale, which are preferences — and that value is built once in `App` and handed to *both* readers. A component that read those preferences for itself would be a second input the two could disagree about for a frame, and a frame is long enough for a click to land on a card that has moved. `contentRect` is exactly the card that is drawn, for every state and module. The rule it has to respect is that a rect must never shrink out from under a stationary cursor — switching from the launcher to a shorter module with a click would otherwise drop the cursor outside and collapse the notch mid-click — and that is enforced by the latch in `useNotchState.getContentRect`, which holds the previous rect for as long as the cursor is inside it and adopts the new one the moment it is not. This is why the getter handed to `useHotzone` takes the point being tested.

Do not go back to a constant rect sized to the largest card, which is what enforced the rule before. It left a permanent dead zone: the media card is 380×164 and the rect was 440×346, so a cursor parked ~180px below the visible card — over a browser tab strip — held the notch expanded and swallowed clicks with nothing under it to explain why. With always-on-top off, that reads as "the notch is stuck on screen".

**`src/tokens.ts` is a transcription of the design export** (`Dynamic Notch v2.dc.html`), not a place to make design decisions. `size` heights are design content height *plus* `NAV_STRIP_HEIGHT`. Every deviation carries its reasoning at the value: the `spring` block (the export is static HTML and has no motion values), `color.load` (the one place colour carries meaning on its own rather than marking an active state — a meter has no state to be active in), every entry in `color` (all now `var()` names rather than literals, because the palette is a preference — see themes, below; the export's own literals moved to the `crest` block in `index.css`), `radius.shell` (a `var()` for the same reason: the corner radius is a preference too), and the `size` entries marked *NOT from the design export* — `announce`, `notifications`, `system`, `weather`, `calendar`, `quickAccess` and `screenshots`, which the export predates entirely; `peek`, which the export sized for a pill carrying one track title and which now carries three things; and `files`, which the export sized for a one-line note pane and which now holds a note list beside an editor. `files` also carries a correction worth reading before changing it again: it went to 346 first and that left a stripe of empty Mica in the shelf, which holds the notch open over nothing — the dead zone `contentRect` warns about, inside the visible card.

**The settings window is eight panes** — About, Panels, Theme, Appearance, Display, Weather, Notes, Settings — not the two it started as. Panels is the ordered tick-list of cards; Theme is the whole palette; Appearance is everything you adjust *from* a theme — Surface (opacity), Colour (accent), Shape (pill size, corner radius, card width), Motion (animation speed, auto-collapse delay) and the summon Shortcut, in that order because it is the order of the decisions rather than of the controls; Display is the machine's screens and which of them the notch is on; Weather is the location, which is not a preference but the one thing Crest has to be *told* before a feature works at all; Notes is where they are saved and a reader for them. Adding a preference means deciding which pane it belongs to, and "another group label at the bottom of Settings" is the answer that made the split necessary.

**Which cards the notch offers is a preference.** `panels` is an ordered list of `{ id, visible }`; `resolvePanels` in `types/notch.ts` turns it into the ring, and `MODULES` is now only the *default* order and the canonical set. Everything that used to read `MODULES` reads the resolved list instead — `cycleModule`, the tray popup's module rows, the tray-navigate guard, and `NavArrows`, which now reads only its length, to tell a ring of one (no arrows to draw) from a ring of several. The strip used to carry a position counter against it too — "2/3", not "4/7" — and no longer does: the chevrons already say there is more than one card, nobody navigates by which numbered slot a card sits in, and the counter's real cost was sitting inside the centred label and parking the module *name* left of centre. Four drift cases have to survive and all are handled in that one function: a module that shipped in an update is appended visible (a new card that silently never appeared would be indistinguishable from a bug), a removed one is dropped, duplicates take the first, and everything-switched-off falls back to all — the picker refuses to remove the last one, but the file is hand-editable and the running app must not depend on the picker having been the writer. Rust stores `id` as an opaque string and never interprets it, so adding a card touches no Rust.

**The settings notes row reads the notes; it does not reveal the file.** It used to open Explorer on `notes.json`, which answers the wrong question — someone asking where their notes are is asking to *read* them, and what they got was a storage format. `NotesViewer` renders them as text. `useSavedNotes` is a read-only second hook rather than a flag on `useQuickNotes`, because mounting the writer in the settings window would put two debounced autosaves on one file and the last render would win it. Anything else that "looks wrong" gets fixed in the design file first.

**State machine** — `hooks/useNotchState.ts` owns visibility; no component decides its own:

```
hidden ──cursor in hotzone (no delay)──▶ peek ──600ms dwell──▶ expanded
       ◀──300ms grace──────────────────       ◀──300ms grace──
```

`useNotchState({ alwaysVisible })` moves the **floor** of that machine from `hidden` to `peek` — the always-on-top preference means the pill rests on screen rather than collapsing away. It is a floor and not a second mode on purpose: every transition above it is unchanged, so there is no parallel set of rules to keep in step. Anything asking "did the notch just grow or shrink?" compares `STATE_RANK` rather than testing for `hidden`, which is no longer a state the notch necessarily reaches.

`activeModule` (`'media' | 'launcher' | 'files' | 'notifications' | 'system' | 'weather' | 'calendar' | 'quickAccess' | 'screenshots' | 'timer'`) is deliberately separate from `state`, so switching modules resizes the card without retriggering the expand animation. `showModule(m, { pin: true })` suppresses the grace-window collapse for openings the cursor did not cause (tray menu). The pin is released by the cursor arriving, by the window blurring, or by `timing.pinMs` running out — and the lease is the only one of the three that always fires. The overlay takes focus only when its card is clicked, so a window that was never focused never blurs; without the lease, a card opened from the tray and then ignored stayed pinned for the life of the process, expanded and topmost, because the step-down is guarded on the pin and `notch_settle` only runs on collapse. That was the "always on top is off and the notch is still on screen" bug. The pin is React state, not just a ref, precisely so releasing it re-runs the step-down effect.

**A caret in a field holds the notch open, and a draft outlives the card.** Typing is the one use of the notch the cursor stops reporting — the hand is off the mouse, the pointer sits wherever it was left, and if that is a few pixels past the card's edge the ordinary grace window collapsed the card mid-sentence and took the half-typed task with it. So `useNotchState` has a second hold beside the pin: `typing`, set from document-level `focusin`/`focusout`/`keydown` (the DOM already answers "is there a caret in this document", and per-component reporting would be one forgotten call site per card added), guarding the same step-down and leased for exactly the reason the pin is — released by the field blurring, by the window blurring, or by `timing.typingMs` since the last keystroke, and the lease is again the only one that always fires. It is React state, not a ref, so releasing it re-runs the step-down effect.

The hold is not enough on its own, because a card *may* still collapse under a draft (the lease expires, the user clicks another app), so the draft survives the unmount too: `useStickyState` is `useState` written through to a module-level store and read back by the next mount. Do **not** "fix" this by keeping the module mounted and hiding it with CSS. The card is not hidden at `peek`, it *shrinks* — `.mica` clips to a 264×34 pill and the panels cross-fade inside that box — so a 480px calendar parked in there would be a laid-out, animating subtree behind every collapse, for state that is a string. Two rules: keys are namespaced by card (`calendar.draft`), and state that decides *where* a draft lands has to be sticky alongside it — the calendar's `selected` and `cursor` are sticky because restoring "Dentist" onto a day that had snapped back to today would file it on the wrong day silently, which is worse than the lost text was. Notes need none of this for their bodies (already flushed to disk on unmount) but do for `activeId`, kept at module scope in `useQuickNotes`: without it the pane reopened on `notes[0]`, so someone typing into their third note came back to the first one's contents and read their own words as gone.

The banner borrows the selection and gives it back. `announce` points the dwell at the card behind what it is reporting (media → media, performance → system, and so on), which means it *moves a selection the user made* for a report they never asked for — a track changing while the notch was collapsed took someone off the card they had left open. `restoreModuleRef` holds the previous module and the retract puts it back, unless `clearAnnounce` has dropped it first, which is exactly the case where the user reached for the banner and adopted its card on purpose.

**A caret in a field holds the notch open, and a draft outlives the card.** Typing is the one use of the notch the cursor stops reporting — the hand is off the mouse, the pointer sits wherever it was left, and if that is a few pixels past the card's edge the ordinary grace window collapsed the card mid-sentence and took the half-typed task with it. So `useNotchState` has a second hold beside the pin: `typing`, set from document-level `focusin`/`focusout`/`keydown` (the DOM already answers "is there a caret in this document", and per-component reporting would be one forgotten call site per card added), guarding the same step-down and leased for exactly the reason the pin is — released by the field blurring, by the window blurring, or by `timing.typingMs` since the last keystroke, and the lease is again the only one that always fires. It is React state, not a ref, so releasing it re-runs the step-down effect.

The hold is not enough on its own, because a card *may* still collapse under a draft (the lease expires, the user clicks another app), so the draft survives the unmount too: `useStickyState` is `useState` written through to a module-level store and read back by the next mount. Do **not** "fix" this by keeping the module mounted and hiding it with CSS. The card is not hidden at `peek`, it *shrinks* — `.mica` clips to a 264×34 pill and the panels cross-fade inside that box — so a 480px calendar parked in there would be a laid-out, animating subtree behind every collapse, for state that is a string. Two rules: keys are namespaced by card (`calendar.draft`), and state that decides *where* a draft lands has to be sticky alongside it — the calendar's `selected` and `cursor` are sticky because restoring "Dentist" onto a day that had snapped back to today would file it on the wrong day silently, which is worse than the lost text was. Notes need none of this for their bodies (already flushed to disk on unmount) but do for `activeId`, kept at module scope in `useQuickNotes`: without it the pane reopened on `notes[0]`, so someone typing into their third note came back to the first one's contents and read their own words as gone.

The banner borrows the selection and gives it back. `announce` points the dwell at the card behind what it is reporting (media → media, performance → system, and so on), which means it *moves a selection the user made* for a report they never asked for — a track changing while the notch was collapsed took someone off the card they had left open. `restoreModuleRef` holds the previous module and the retract puts it back, unless `clearAnnounce` has dropped it first, which is exactly the case where the user reached for the banner and adopted its card on purpose.

Adding a module means five edits that have to agree: the `NotchModule` union and `MODULES` (nav order) in `types/notch.ts`, `MODULE_LABELS` beside them (one record, read by `NavArrows`, `ModulePlaceholder` and the settings panel picker — it used to be a copy per component), `size` in `tokens.ts`, the switch in `NotchShell`, and a tray row (whose height needs nothing — the popup measures itself, see below). `layout.ts` needs nothing: `cardSize` indexes `size` by module, so a new entry gets its hit rect for free. Append to `MODULES` rather than inserting: position is the only thing the arrows can be aimed by, and a user who knows the shelf is two right of media should not have that changed by a release. A new card should not exceed the largest existing card in either axis (currently 480 wide — the calendar — and 346 tall), or it widens the region that holds the notch open. That is a weaker rule than it was: the rect is per-module now, so a wide card only holds the notch open while *it* is the card on screen, which is what let the calendar go to 480 for a second pane it genuinely needed. It is still the number to justify against rather than round up. A module whose contents change size inside a fixed card — the notes expansion, the notification detail sheet — must swap *within* that card rather than growing it: anything drawn outside the card's own rect sits on a click-through region and takes no clicks.

**Scrolling over an open card steps the ring**, alongside the arrows rather than instead of them — `useWheelCycle`, calling the same `cycleModule`. It needs no hit-testing, and that is the click-through invariant paying for itself: the window is in `setIgnoreCursorEvents(true)` whenever the cursor is not over card content, so a wheel event can only arrive when the cursor is genuinely on the card. Three rules make it usable. It defers to any ancestor that scrolls *on the axis being scrolled* — vertical for the notification and reminder lists, horizontal for the notes switcher, and never falling through to the ring at the end of a list, since reading to the bottom of your notifications and landing on the weather is a worse surprise than a scroll that does nothing. It swallows everything for 320ms after a step, because a trackpad keeps delivering events for most of a second after the fingers lift and a flick would otherwise cross the whole ring. And it is deliberately not wired at `peek`: `cycleModule` expands as it steps, so a scroll over the resting pill would open the notch *and* move off whatever card it opened on.

There is a fourth state, `announce`, that the cursor never asks for: a 300×64 banner dropped in for `timing.announceMs` and retracted to the floor, reporting something the user did not go looking for. Seven sources so far — music starting (`useMediaAnnounce`, keyed on app + title + artist while playing), an arriving Windows notification (`useWindowsNotifications`, keyed on notification-centre ids), the machine's own state changing (`useSystemStatus`: charger, Bluetooth, network), the machine struggling (`usePerformance`: CPU, memory, GPU, disk, temperature), a reminder coming due (`useReminders`), a screenshot landing (`useScreenshots`), and a countdown finishing (`useTimer`). All go through `announce(announcement, ms)`, which carries a tagged `Announcement` rather than a module: media, performance, reminder and screenshot borrow a card, while a notification and a system event each carry the thing that happened, since the banner reports one specific arrival rather than opening a page. It is a state rather than a timed `expanded` so it gets its own hit rect from `layout.ts` and the ordinary dwell: hovering the *media*, *overload*, *reminder* or *screenshot* banner opens the card behind it — the transport controls, the other three meters and the power row, the day the reminder is on, or the grid the capture can be dragged from — while hovering a notification or system banner only holds it up to be read, since reading it is the whole action. `announce()` pins like the tray's openings and declines while the cursor is on the notch or a card is already open. One announce size, so the hit rect stays a function of `state` alone — which is also why a sixth source belongs on this banner and not in a new card.

**The notifications module is the same poll seen twice.** `useWindowsNotifications` reports arrivals (the banner) *and* returns the standing list (the module) from one 2s poll — a second poll would double the WinRT round trips for data this one already has. The arrival half baselines on its first poll; the list half deliberately does not, because the backlog is exactly what it is for. `NotificationDetail` is a sheet *inside* the card, not a floating popup: anything drawn outside the card's own rect sits on a click-through region, so a popup hanging below the card would take no clicks and the notch would collapse the moment the cursor moved onto it. The "notifications in the notch" preference gates the module as well as the banner — one switch for whether the notch reads the notification centre at all.

It is also **the one card sized to its contents**, because it is the one module whose contents are not fixed — the media card always holds a track, the launcher always the same grid, this holds however many notifications Windows has. `layout.notificationsCardHeight` grows it a 44px row at a time up to `size.notifications.height`, which is a ceiling and not the card, and past that the list scrolls on a half-cut row; an empty list is two rows tall because what fills it is a sentence. At the fixed 300 it drew a stripe of empty Mica under two notifications and held the notch open over it — the dead zone `contentRect` warns about, inside the visible card this time. Two things follow. Every box the arithmetic counts is pinned to an explicit height in `NotificationsModule`, including a header that looks like it does not need one (with an empty list there is no "Clear all" to set it); a row that measured itself would put the card and the hit rect out of step. And the detail sheet takes the full card, so *which row is open* is an input to the geometry and lives in `App` — which is also why `App` builds the feed before `useNotchState` and reaches `announce` through a ref, the state machine now needing to know what is in the list it hit-tests.

**The notification detail sheet acts on the text, never on the app.** There is still no "open in the app" button and there cannot be one — `UserNotificationListener` reads the centre, it cannot activate an entry. What the footer carries instead are the three things Crest can honestly do with a string it already has: copy it, snooze it, and open a link found in it. **Snooze is Crest's list only** — the notification is never touched in Windows' own centre, which is what makes it safe to offer, since the worst case of a snooze that never returns is a notification sitting exactly where Windows put it. It is in-memory and deliberately not persisted (a snooze surviving a relaunch would fire a banner for something last seen days ago), the snoozed ids and their timers are cleared **together** on teardown (clearing only the timers left every snoozed id in the set with nothing left to remove it, so toggling the notifications preference off and on hid those entries for the life of the process), and the re-announce is guarded on the id still being in the last poll — five minutes is long enough to have cleared the centre from Windows' own flyout. Snoozed ids stay in the arrival baseline while hidden, or the expiry would read as a fresh arrival and announce twice. Two things the footer must not do: **it does not wrap**, because a single flex row reflowed differently depending on whether the message happened to contain a link and moved Dismiss under the cursor between one notification and the next — it is two fixed rows; and it does not offer a Downloads button, which shipped briefly and was three bugs in one (`opener:default` does not include `allow-open-path`, so it was denied at runtime and the failure was swallowed; the trigger was the word "download" appearing anywhere in the message; and the folder it opened is not necessarily where the file went).

**Quick Access is the audio-endpoint card, and it stores nothing.** `audio.rs` lists the active render and capture endpoints from Core Audio and re-points a role at one; `useQuickAccessDevices` polls it while the card is mounted and `QuickAccessModule` draws two rows. The **Windows default is the setting** — `isDefault` is read back from `GetDefaultAudioEndpoint` and there is no Crest preference beside it, because a stored copy would disagree with the machine the moment the user changed the default from the volume flyout. That is also why `assign` re-reads rather than guessing optimistically: the invoke resolves only after Core Audio has accepted the change, so the next read is already right.

Four things there are load-bearing:

- **`IPolicyConfig` is the one interface in this app Microsoft does not publish**, and it has to be hand-declared because *there is no documented way to change the default endpoint at all* — the public surface can enumerate and read the default and cannot write it. What makes it shippable is that a COM IID **is** the contract: `CoCreateInstance` asks for `IID_IPolicyConfig` specifically, so it either returns an object with exactly this vtable or fails with `E_NOINTERFACE`. The slot index is the whole declaration — `SetDefaultEndpoint` is slot 13, three `IUnknown` slots plus the ten methods declared before it — so the preceding entries are retained rather than padded over. All three roles are set, `eCommunications` included: a card whose promise is "sound comes out of this now" that left voice chat on the old headset would be answering a question nobody asked.
- **The endpoint list is a full-card sheet, not a dropdown anchored to a row.** It shipped as a dropdown and the card was sized to leave room under the second row for it, which put fifty pixels of empty Mica inside the visible card whenever the picker was shut — the dead zone `layout.contentRect` warns about, held open over nothing nearly all the time. A dropdown cannot work here anyway: a machine with six endpoints needs more list than fits under the last row, and anything drawn past the card's own rect sits on a click-through region. The sheet is the `NotificationDetail` / `AppPicker` pattern, with the same scrim and click-away. The card is 420×186 and every box in that arithmetic is pinned in `QuickAccessModule`; do not re-reserve height for a menu.
- **A failed read and a failed switch are both said out loud.** The first version answered a refused enumeration with two rows reading "Default speakers" and "Default microphone", and swallowed the switch error entirely — so a card that could do nothing looked exactly like a card that was working, and a click on a headset that had gone to sleep did nothing with no explanation. The stand-in devices are now the browser fallback's alone, the card has a `loaded` flag so it says "Reading…" rather than showing a guess that gets snatched back, and Rust's error strings are kept short because they land in a one-line header slot.
- **One endpoint failing is not the list failing.** A device mid-way through removal answers `E_INVALIDARG`, and taking the whole card down over it meant an unplugged headset blanking the speaker list until Windows tidied up. Each role is read independently for the same reason — a desktop with no microphone must still get its speaker row.

Unlike `muteWindowsBanners`, this reaches outside the app and **does not put it back**: the default endpoint is a machine-wide Windows setting and stays where the user left it after Crest quits. That is correct — it is the same change the volume flyout makes, and silently reverting a device switch on exit would be the surprising behaviour — but it means this is the one command in the app whose effect outlives the process by design.

**The accent is one CSS variable, and that is the whole mechanism.** `accentColor` is a preference, and `tokens.ts` hands out `var(--accent)` rather than the export's `#7C3AED`; `useAccentColor` writes the variable onto each window's `:root`, exactly as `useSurfaceOpacity` writes `--mica-alpha`. Every existing `color.accent` reader picks the change up for free — inline styles take `var()` — so no component knows a preference exists. `--accent-bright` and the two washes (`--accent-wash`, `--accent-wash-soft`) are `color-mix`ed off it rather than stored separately, so a custom hue keeps the relationships the design export had instead of three values a user could put out of step. `color.load.warn`/`hot` are deliberately *not* reachable from this preference — they mean caution and stop, and a user with a red accent would otherwise have three reds saying different things.

**A theme is that same mechanism applied to the whole palette.** `theme` (`crest | glacier | ember | daylight | mono`) is a preference; `useTheme` writes it as `data-theme` on each window's `:root`, `index.css` keys a block of ~30 custom properties off it, and every colour in `tokens.ts` is now a `var()` name. So a theme touches no component, and the export's own literals survive as the `crest` block — still the default, so a user who never opens Settings gets the app as drawn.

Five things there are load-bearing:

- **Every block declares every variable**, all thirty. The selectors have equal specificity and source order decides, so an omission would silently inherit Crest's value — and a light theme quietly keeping one white-on-white hairline is a bug invisible to whoever shipped it.
- **The palette blocks are attribute selectors, not `:root`-only.** That is what makes the picker's previews real: `<div data-theme="ember">` gets Ember's whole palette for its subtree, so `ThemePicker` holds no colours at all and cannot be wrong about one. It is also why `--accent-bright` and the washes are re-declared under `[data-theme]` — a custom property substitutes `var()` where it is *declared*, so derivations pinned to `:root` would hand every preview the live accent.
- **`set_theme` sets the accent too**, from `Theme::accent()` in Rust. A theme is a palette drawn around one accent, and `useAccentColor` writes `--accent` *inline*, which beats the theme block's own value — so a theme whose accent lived only in CSS would be overridden by whatever accent was last set. One command, one write, one broadcast, so no window catches the pair half-applied. The accent stays independently settable afterwards; the frontend's optimistic half is `removeProperty('--accent')`, which falls back to exactly the value Rust is about to store and so needs no copy of the hex. Rust's table and the `--accent` in each CSS block have to agree.
- **`--on-accent` exists because `#fff` was only ever right by coincidence.** Glacier's ice blue, Ember's amber and Mono's near-white are surfaces in their own right, and every glyph drawn *on* the accent — a switch knob, a scrub handle, a selected day, the app mark — was white on white in three of the five themes. Anything new drawn on an accent fill takes `color.onAccent`.
- **`--load-warn` and `--danger` move per theme and never per preference.** Meaning is not legibility: amber-400 next to Ember's amber accent is two warnings that look alike, and on Daylight's white it is a warning nobody can read. Mono keeps them coloured despite "no colour at all", for the reason `color.load` already gives — a grayscale warning is not a quieter warning, it is no warning.

Three copies of the *default* have to agree, as before: `theme_default()`/`accent_color_default()` in Rust, `DEFAULTS` in `useSettings.ts`, and the `:root` block in `index.css`. Adding a theme means a CSS block, a `Theme` variant with its accent, the `ThemeId` union, and a `THEMES` row — and nothing else, because nothing else knows.

**Weather is the only thing that talks to a server the user did not point it at**, the updater aside. `weather.rs` fetches Open-Meteo (no API key exists to ship or leak), caches for ten minutes in-process, and is fetched in Rust rather than with `fetch` in the webview so the one piece of external I/O in the app is behind an `invoke` with a timeout and a user agent. **There is deliberately no automatic location**: an IP lookup hands a third party the user's approximate address at launch, and the Windows location capability is a permission prompt for a feature nobody asked for yet — so `weatherPlace` is a preference, set from a geocoder search in Settings, and nothing polls until it is. The stored place carries coordinates *and* the name they resolved from, because the API takes coordinates and there are thirty Springfields.

**The calendar is a store plus a clock.** `reminders.rs` is `notes.rs` again — a flat JSON file, written whole — and `useReminders` owns everything about time, because the machine's own clock is the only one that matters and Rust has no business having an opinion about it. Two things there are load-bearing: reminders are stored as an *instant* (Unix millis) rather than a wall-clock string, so there is no question about what happens when the zone changes; and `firedAt` is **persisted**, because an in-memory "already announced" set replays every overdue reminder on every launch and the notch relaunches on every update. The tick is 20s, not 1s, and anything more than 12 hours overdue is marked fired without a banner — a fortnight away should not throw up last Tuesday's dentist. The month grid always draws six week rows even when five would do, because a grid that changed height would change the card's height and the notch would resize as you paged through the year. `monthGrid` hands a raw day *offset* to the `Date` constructor and lets it normalise (`new Date(2026, 7, -5)` is 26 July); building the start date and reading `start.getDate()` off it is the obvious version and is wrong — it returns 26, and `new Date(2026, 7, 26 + i)` is 26 August, so the grid ran a month late with every weekday column misaligned.

**No native popup may be used in the overlay window.** `<input type="time">`, `<select>`, date and colour inputs and the default context menu all open a *real OS popup* that Chromium positions and sizes freely. On an ordinary page that is what you want; here the page is a transparent 560×420 overlay pinned to the top of the screen, so the popup opens across the desktop, paints over whatever is behind it, and — the part that actually breaks — sits entirely outside the rect `layout.contentRect` hit-tests, so the notch counts the cursor as away, starts its grace timer and collapses the card out from under a popup that is still on screen. `components/calendar/TimePicker.tsx` is the in-card replacement and the pattern to copy: a panel positioned inside the card's own coordinate space, opening in whichever direction has room, with a click-away backdrop. When the list is long enough that no direction has room — Quick Access's endpoints — the answer is the full-card sheet (`NotificationDetail`, `AppPicker`, `DevicePicker`) rather than a taller card, since the height it would need is empty Mica the rest of the time.

**The system monitor is the load half of "your machine", and it is a separate poll from the attached half.** `perf.rs` answers `get_performance` with CPU, memory, GPU, disk and temperature; `usePerformance` polls it and `SystemModule` draws it. It is not folded into `system.rs` because the two answer different shapes of question: that one is *what is attached*, where every field changes because the user did something and an event is an edge; this one is a set of rates that move continuously, where nothing but arithmetic makes a moment out of a level. Splitting them also keeps the cheap snapshot cheap — the battery badge polls `system.rs` for the life of the process and has no use for a PDH round trip.

Four of the five readings come from PDH, and the two that look like they should not are the reasons. CPU is `% Processor Utility`, which is Task Manager's CPU column and is *not* the same number as a `GetSystemTimes` diff (it is scaled by the frequency the cores actually ran at) — a notch that disagreed with Task Manager would simply be wrong. Temperature is `\Thermal Zone Information(*)` and not WMI's `MSAcpi_ThermalZoneTemperature`, which is the answer every search gives and which wants a COM apartment, a proxy blanket and an elevation the notch does not have. Disk is `% Idle Time` subtracted from 100, because `% Disk Time` sums per-request service times and reports 800% at a queue depth of eight. GPU sums `\GPU Engine(*)` within an engine type and takes the busiest type, again matching Task Manager. Counters are opened once and live for the process: three of the four are rates, PDH computes a rate between two collections, and a query opened and closed per call would answer "no data yet" forever — which is why CPU, GPU and disk are `None` on the first snapshot. There is deliberately no "have we collected yet" flag; each counter's own `CStatus` says so, and a flag would also suppress the thermal zone, which is instantaneous and right the first time it is asked.

**Turning a level into an event takes four rules**, all in `usePerformance`. *Sustain* (3 polls above the threshold) or the notch announces every app launch. *Hysteresis* (no re-arm until 15 points below it) or a machine sitting at 90.4% crosses its own line a dozen times a minute. *Cooldown* (5 min per metric) because a long build loads and unloads the CPU for half an hour and the first banner said everything. *Warm-up* (first 3 polls discarded) because Crest launching is itself a CPU spike. One alert per poll, as in `useSystemStatus`; the losers are marked reported rather than queued, since a struggling machine has all four meters up and they are all on the card the banner opens into. The banner's third line is always the *other* meters — "CPU at 97%" next to a disk at 4% is a build, and next to a disk at 99% it is a machine paging itself to death.

**The power row is armed before it fires.** Sleep, restart and shut down are on this card because the reason to reach for them is usually the reason you are reading the meters — but the notch expands on *hover*, so a live shutdown button is one stray click from taking the machine down. The first click turns the row into a question and the second answers it; the arming expires after 4s, which matters because the notch collapses on its own timer and a card reopened later must not still be primed. `power_action` calls `settings::shutdown` before handing over — the shell does not reliably give a hidden always-on-top overlay a clean exit, and rebooting into a silenced notification centre with nothing running to make up for it is the worst thing this app can leave behind. Both halves sit behind the existing `systemAlerts` preference: it answers one question ("does the notch tell me about my machine"), and as with the charge on the pill it gates the announcing, not the poll.

**The charger, Bluetooth and Wi-Fi are one snapshot, diffed on the frontend.** `system.rs` answers `get_system_status` with the battery (`GetSystemPowerStatus`), the internet connection profile and every connected Bluetooth device, and keeps no memory of its own; `useSystemStatus` polls it at 2s and owns what counts as an *event*, because the diff has to sit next to the thing that knows whether the notch is free to show a banner. Three subsystems in one call, since they are read together — a poll each would be three timers reconciling three different moments. Two rules in that hook are load-bearing: an arrival is reported on sight (a plug acknowledged four seconds later reads as a coincidence) while a *loss* has to survive a second poll first, because losses flap — Wi-Fi drops for a DHCP renew, a headset drops when it switches between handsfree and stereo profiles, and both are back within a poll; and only the first event of a poll is announced, or waking a laptop is three banners in a row. Every WinRT await goes through `await_op`, which polls `Status` to a deadline instead of blocking in `.get()` — on a 2s poll, one operation that is never signalled (see the logo trap below) would eat a worker thread every two seconds. The class of device is cached per device id, so a headset connected all day costs one lookup; a device whose lookup fails caches `Other` rather than being retried forever. The banner itself is `SystemAnnounce`, and the movement in `SystemGlyphs` is the message — the glyphs are stroke-only so they can be *drawn*, and a disconnection gets no ring of its own on purpose. The same poll answers what the charge *is*: `useSystemStatus` returns the standing `BatteryStatus`, which `BatteryBadge` draws on both resting surfaces — the collapsed pill and the nav strip of every expanded card (mirrored by a spacer there, so the chevrons stay symmetric about the card's centre). State is only set when a *drawn* field moves, or every surface showing the charge would re-render on a 2s timer.

**The pill is a three-column grid, and that is what keeps the clock centred.** It carries a music mark, the clock and the charge, so it is 264×34 rather than the export's 200×32 — and the two outer columns are the *same fixed width*, which is what puts the time on the pill's centre line. The export's row centred the clock by absolutely positioning it across the whole pill, which meant the marks either side had a width budget measured against the time's own rendered width; the battery badge landed a pixel or two from the clock, which is the crowding the redesign fixed. With equal columns a mark can grow to fill its column and nothing moves. The two marks are matched chips (same height, radius and `.tile` surface) so they read as one kind of thing; the battery chip tints for charging and for low, and both need `overflow: hidden` because `.tile::after` is a full-width hairline that would otherwise hang past a pill radius at each end. The old right-hand playing dot is gone — it said exactly what the equalizer says, and the symmetry it bought is the grid's job now.

**The temperature is the notch's second standing readout, and `WeatherBadge` is `BatteryBadge` with a different reading.** Deliberately so: the two answer the questions asked most often of a status strip, they sit opposite each other on *both* resting surfaces — the collapsed pill and the nav strip of every expanded card — and so they take the same shape, the same two sizes and the same `chip` prop selecting between them. If one grows a third size, so does the other. The reading costs nothing: `useWeather` already polls whether or not the weather card is open, so both surfaces draw a value the app had anyway, and nothing at all until the user has named a place. Both take the *reading*, never the `WeatherFeed` — a fetch that failed or is in flight is the card's to explain, and a mark reporting a network error out of the corner of the eye asks for attention it cannot then be given.

Four things there are load-bearing:

- **On the pill, music displaces the weather rather than joining it.** The left column holds one mark at a time. The design reason is the better one: music is *news* — it changes on its own, it is the only thing on the pill that does, and putting it beside a temperature that has not moved in ten minutes makes the eye read the two as one crowded lump instead of noticing the one that is moving. The weather is one hover away in its own card and returns the moment playback stops. The arithmetic agrees: the eq chip is ~28 and the weather chip 59, which with a gap is over 90 against a column that is 80, and `columnWidth`'s columns are equal by construction — so the right one would have to grow to match and the clock would lose the difference twice over, with nothing left to lose at the minimum pill width. Either mark alone fits with room.
- **Both marks are chips, on both surfaces — 22 on the pill, 18 in the strip.** The strip's 18 leaves 4 above and below in a 26px strip and reads as a tag; a 22 there would fill it edge to edge and read as a button squeezed into a title bar, which is why the size is picked from the chip's own *height* in both badges rather than from a second prop. The charge used to be drawn bare in the strip, on the reasoning that a battery outline is legible as a mark anywhere while a glyph beside a number needs a surface to say the two are one thing. True, and beside the point: it left the two corners of one strip as a filled tag on the left and a naked outline on the right — the first thing a screenshot of the old strip showed. The fill is the one place they still differ, and it carries meaning both times: the weather is always `accentWash`, the charge is neutral until it is charging or low. **Matching the chip then made the drawing the last thing unmatched**, so the battery is line work now: `WeatherGlyphs` are `fill: 'none'` strokes with round caps, and the charge answered with an outlined shell wrapped round a solid slab — two chips of the same height and material carrying two different kinds of picture. The terminal is a round-capped stroke rather than a solid nub, and `BAR` is 4.6 units tall in a shell whose inner height is 10, where it used to be 7. It is still unmistakably a gauge — a bar of colour whose length is the reading, over a `hover` track — just drawn at the weight of the cloud opposite. The charging bolt stays filled, and the accent outline it already carried for overhang is why: at 4.6 the bar no longer covers it, so what was the edge case is now the ordinary one. The temperature goes in the left column, which the grid was *already* reserving as an empty spacer to balance the badge opposite — so the mark costs no layout and the module name stays centred whether it is drawn or not.
- **The strip's label is not `sectionLabel`, and the clock is a point larger than the marks beside it.** That token — 10px uppercase at .14em — is for headings *inside* a card, above the content they name. On the strip it made the loudest thing on the surface the name of the card you are already looking at, shouting over the card underneath, and wide-tracked capitals clipped "File shelf and notes" into an ellipsis that sentence case at 11.5 fits with room. Same argument on the pill from the other end: the marks are set at 12, so a 13px clock was within a pixel of the things it is meant to be read past — three items of near-equal weight with nothing saying which one the pill is for. 14 puts the time first and lets the readouts be ambient, which is what they are. `CLOCK_MIN` in `CollapsedPill` has to follow that type size, or the clock starts clipping a preference or two before the columns begin giving way.
- **The whole badge is the accent** — glyph, number and an `accentWash` background, every value a `var()` off the one custom property, so it follows whatever accent or theme the user picked with no component knowing a preference exists. This is a deliberate exception to `WeatherGlyphs`' own rule that only precipitation is accented, which is why `tone` is a prop and the card keeps the default: on a card carrying text and a forecast strip an all-accent glyph would be the loudest thing on it, whereas the badge is one mark alone in a corner. The base takes `accent` and precipitation `accentBright`, so rain stays a step hotter than the cloud and wet still reads differently from dry.
- **`strokeWidth` is a prop because stroke weight is in viewBox units and therefore scales with `size`.** The card's 1.5 at 24px is 1.5 on screen; the same value at the badge's 15 and 14 strokes 0.94 and 0.88, against a `BatteryBadge` beside it drawn at 1.27 and 1.04. That is not a stylistic difference at that size — it is a weather mark that looks faded next to the charge for no reason a reader can see. The badge's 2 and 1.8 land on 1.25 and 1.05.

**The timer is the third standing readout, and it displaces the other two.** The
priority on both resting surfaces is **timer › music › weather**, one rule applied
twice rather than a nav strip that keeps showing the temperature after the pill has
moved on. The timer wins because it is the only one of the three with a *deadline*:
the temperature has not moved in ten minutes and the track has a card one arrow
away, while a countdown's entire value is being visible without being asked for.
`TimerBadge` is `WeatherBadge` with a ring instead of a glyph — same `Chip` prop,
same two sizes off its height, same `accentWash` surface — and it is drawn while
**paused** as well as running, because a paused timer that vanished from the pill is
one you find at nine minutes left the next morning. `formatCompact` has two shapes
(`m:ss` under an hour, `Hh MMm` at or over one) because the pill's outer columns
are 80px at the default width and floor at 72, and a plain `1:05:00` would push
the chip into the clock. Measured, the chip is 69px under an hour and 76.6px over
one.

Six things about the card are load-bearing:

- **The digits are the input.** No field, no picker, no stepper — clicking the
  readout starts editing and typed digits fill `HHMMSS` from the right, phone-timer
  style. That is what lets the card be six numerals at 58px and nothing else; the
  alternative is a control panel on screen for the whole life of a timer to be
  useful for the four seconds before one starts. Presets **set** rather than start,
  because a mis-clicked preset that started immediately costs a running timer.
- **The height never changes.** `size.timer` is 26 nav + 14 padding + 96 readout + 8
  + 32 band + 14 padding = 190, every box pinned in `TimerModule`, and all three
  modes fill the same band. A card that grew when you pressed Start would resize the
  notch under a cursor that has just clicked and is therefore not moving.
- **The progress is a perimeter trace, not a ring, and that is arithmetic.** The
  readout is ~280×70; a circle behind it is either a 70px disc lost behind the
  middle digits or a 280px one needing a card taller than any in the app. The path
  is written out rather than drawn as an SVG `<rect>`, because a rect's path starts
  at its top-*left* corner and a dial filling from anywhere but twelve o'clock reads
  as broken; its length is `getTotalLength()` rather than derived, so it cannot
  disagree with a shape `panelScale` widened.
- **A 1s tick is enough because the sweep interpolates in CSS.** The trace and the
  ring carry `transition: stroke-dashoffset 1s linear`, so the eye sees continuous
  motion out of a once-a-second sample; a faster tick would cost a wake per frame
  for the life of every timer and look identical. The tick runs only while running.
- **Time is stored as an instant** — `endsAt` in Unix millis, `reminders.rs`'s rule
  for the same reason. It is on disk at all because Crest installs updates silently
  and restarts, and a pomodoro dying to an update is the app losing something the
  user was relying on. **`write_timer` broadcasts** where `write_reminders` does not:
  every notch window mounts `useTimer`, so mirroring would otherwise give each
  screen its own timer. `isLeadNotch` is the other half — only the lead window
  writes the completion and chimes, while every window still *draws* it.
- **The chime's AudioContext is built on a user gesture.** WebView2 applies
  Chromium's autoplay policy, so one constructed anywhere else starts `suspended`
  and every `start()` is silently dropped — no error, nothing to debug.
  `armChime()` rides the click that starts the timer, the one gesture guaranteed to
  precede a chime. It is synthesised, so there is no asset and no licence.
  `timerSound` gates it: an app that has never made a noise acquiring one without a
  switch is a new kind of presence nobody asked for.

The flash (`.timer-flash`) is what is left when `announce` declines — which it does
while a card is open or the cursor is on the notch, i.e. exactly when someone is
looking. It touches **only background and opacity**, never width or height, because
those are the geometry the state machine hit-tests against.

That is why the `systemAlerts` preference gates the announcing rather than the poll, unlike the notifications one: the badge needs the data whether or not anything is ever announced, and a readout that vanished because you turned banners off would be a second, unasked-for answer to a question about banners. What it does gate is the expensive half — the `bluetooth` argument tells `get_system_status` whether to enumerate devices at all, which is ~50ms of a snapshot that is otherwise microseconds and feeds nothing but the banner. While it is off no baseline is kept, so switching it back on re-baselines instead of announcing every device that was connected the whole time. The preference has nothing for `settings::apply` to do and no Windows permission behind it — all three reads are of state the shell already draws in the tray.

**Windows' media `Position` is a snapshot, not a clock.** `GetTimelineProperties().Position()` is the position as of `LastUpdatedTime()`, and the shell only refreshes it when the player pushes a timeline update — every few seconds for Spotify, only on seek/play/pause for some players. `media.rs` therefore returns `Position + (now − LastUpdatedTime)` while playing, and `useMediaSession` interpolates on top of that between polls. The two halves fix different things: without the first, polling once a second re-anchors to the same stale number and the scrub bar sits still; without the second, it steps once a second. Duration and position are both taken relative to `StartTime` (non-zero for a stream), and a non-positive span is left unclamped — clamping to a zero ceiling pinned every unknown-duration track at 0.

The notification app icon comes from `icons::app_icon` on `shell:AppsFolder\<AUMID>`, not from `AppInfo.DisplayInfo.GetLogo` — that WinRT call never completes off an STA pump (3s timeout, `None` every time) and cannot see unpackaged apps at all. `AppLogo` fetches it itself via `useNotificationLogo`, so a slow icon costs an icon and never the notification; the hook caches by AUMID, which is what makes a list of twenty rows each mounting their own copy cost four calls rather than twenty.

Both watchers must keep running while nothing is on screen — hidden is exactly when a banner earns its keep — so `useMediaSession` drops to a 2s watch rate instead of stopping, and the notification poll is unconditional at 2s. Each takes its first poll as a baseline: without that, launching Crest replays the notification backlog and announces whatever was already playing.

**The tray popup is the card list plus three rows about the app**, and it deliberately has no "Show notch". That row sat at the top doing strictly less than the seven under it — every module row opens the notch, on the card it names — and it was the third way to do one thing: left-clicking the tray icon still calls `tray::show_notch`, which is the gesture people actually reach for. `tray_show_notch` and the `tray-show` event both stay registered, because that left-click is what fires them. The preferences row is labelled **Preferences**, not Settings: a row reading "Settings" directly under "Start with Windows" reads like a shortcut into Windows' own panel.

**The tray popup measures itself.** `tray.rs` positions it from `outer_size()` at show time, so its size *is* its anchor — and the visible card is not the window: the webview leaves a 12px transparent gutter for the shadow, so Rust subtracts `CARD_MARGIN` to find the card and anchors that against the work area. Get either wrong and the popup slides down over the taskbar. The height therefore comes from `useFitWindow` in `TrayMenu.tsx`, which reads the card's **offset** box (not `getBoundingClientRect()` — the card enters at `scale: 0.96` and the bounding rect would shrink the window a little more on every open) and sets the window to it plus the gutter. The `tray-menu` height in `tauri.conf.json` is only the size the window is born at. This replaced a hand-kept arithmetic comment that had to be edited in step with the config every time a row was added.

**Three windows share one bundle.** `main.tsx` switches on `getCurrentWindow().label` and mounts `TrayMenu` for `tray-menu`, `SettingsWindow` for `settings`, and `App` for everything else (the default arm also covers the browser fallback, which has no label). The tray carries no native menu at all — a Win32 menu can't be Mica-styled — so `tray.rs` positions and shows a pre-built borderless window instead. Settings is likewise built at startup and only hidden, so `lib.rs` intercepts its `CloseRequested` to hide rather than destroy the webview. Each window has its own capability file in `src-tauri/capabilities/`; adding a `@tauri-apps/api` call usually means adding a permission there.

**One preference reaches outside the app.** `muteWindowsBanners` silences Windows' own corner pop-up by writing `ShowBanner = 0` **per app** under `HKCU\...\Notifications\Settings\<AUMID>` — the value behind the per-app "Show notification banners" checkbox, which the shell reads as each notification arrives. The global `NOC_GLOBAL_SETTING_TOASTS_ENABLED` is written too but does nothing on Windows 11 26200 (verified: set to 0, banners kept coming), so it is a bonus for builds that honour it, not the mechanism. Never `Enabled` or `PushNotifications\ToastEnabled` — those stop delivery, so the notification would never reach the notification centre and the notch would have nothing to announce either.

`notifications.rs` owns the whole mechanism and its own restore memo (`notification-banners.json` in app-data, not `settings.json`: it is a record of changes made outside the app, sized to the user's installed software). Muting sweeps every registered app; an app that registers later silences itself at the first notification it raises (`mute_app_on_sight`, off the poll), one banner late. An app already at `0` is left out of the memo, so a user who had turned that app's banner off themselves keeps it off. Four guards: refused unless notch notifications are on *and* `UserNotificationListener` access is granted; turning notch notifications off un-mutes; revoked access un-mutes on the next apply; and `settings::shutdown` (hooked to `RunEvent::Exit`, which is why `lib.rs` calls `.build().run(…)` rather than `.run()`) hands every banner back on the way out — a muted shell plus a notch that is not running is a machine with no notifications at all.

**Preferences go through `settings.rs`.** Stored as a flat `settings.json` in the app-data dir, same shape as `notes.rs`; the running app answers from `settings::Current`, an in-memory copy seeded at startup. `settings::apply` is the single place that maps a preference onto window state and runs at startup, on every change, and on every appearance, so nothing can be honoured live but lost on relaunch.

`Current` holds an `Option` and is seeded *before* `apply`, never after, and never falls back to `Settings::default()` — it loads the file instead. Both halves matter because `setup` is not a quiet stretch of time: `apply` reaches WinRT (the notification listener) and sweeps the registry, and those pump the message loop, so WebView2 can dispatch the notch's first `read_settings` in the middle of startup. Answering that from an unseeded `Current` handed the notch a default saying always-on-top is on, and the notch reads the preferences exactly once, at mount — so a preference the user had turned off came back for the whole session, with the pill resting on screen until opening Settings re-ran `apply` and dropped the window out of the topmost band. That is why `settings_open` also broadcasts `settings-changed`: it is the one moment the app knows someone is looking at the preferences, and it costs one emit to put every window back in step. Fields need `#[serde(default = ...)]` or the first launch after a new preference ships fails the parse and resets the rest. A default that mirrors a value in `tauri.conf.json` (`alwaysOnTop`) has to agree with it — the window is built from the config and only corrected afterwards.

Every accepted change is broadcast as a `settings-changed` event. No window is ever rebuilt, so a preference set in Settings would otherwise not reach the notch — which reads the same `useSettings` hook — until the next relaunch. Frontend consumers whose behaviour is *visible* must gate on that hook's `loaded` flag: `DEFAULTS` is a guess, and acting on it puts a pill on screen that gets snatched back a frame later for everyone who had the preference off.

**Always-on-top means two things.** Above other windows *while idle* **and** resting on screen — one switch, a z-order half owned by Rust and a visibility half owned by `useNotchState`'s floor. The name is the user's, so both halves live behind it.

The z-order half is not one call, and it does not track the preference alone — it tracks **whether the notch is on screen**. `notch_raise` promotes unconditionally and `notch_settle` returns the window to the band the preference selects; they only make sense as a pair. A card the user reached for and cannot see is a broken notch however the switch is set, and with the preference off the window sits below every focused window, so the notch would expand behind whatever app is in front. `useNotchState` raises on two rising edges — the notch growing (`STATE_RANK` increases) and the cursor arriving (`inside`) — and settles when it shrinks back to `hidden`. Growth rather than leaving `hidden`, because a notch whose pill rests on screen leaves `hidden` exactly once, at startup, and a band lost hours later would never be reclaimed; the cursor edge because a pill already resting at `peek` has no growth to key on.

`apply_topmost` sets `false` before `true` on purpose: tao's `apply_diff` returns early when the requested `ALWAYS_ON_TOP` matches its cached flag, so re-asserting "on" on a window it already thinks is on top emits no `SetWindowPos` at all — even after a fullscreen app has pushed it out of the topmost band behind tao's back. Collapsing any of this back into a plain `set_always_on_top`, or into a raise that reads the preference, reintroduces "always on top stops working" / "the notch doesn't show over my apps".

**Two preferences move the window, and `display.rs` owns both.** `notchPosition` (`left | center | right`) is which *end* of a screen's top edge, and `notchDisplay` is which screen; `display::place` applies them together, setting the overlay's origin along the free span between that monitor's edges. The card is always centred in its 560px canvas, so every frontend reader — `layout.ts`, the hotzone hit-test, the hint — lays out from `window.innerWidth / 2` and follows for free. Do not move the card inside the canvas instead: the widest card is 440, so the entire travel would be 60px. This is why `lib.rs` no longer centres the window at startup. Two things do *not* follow for free, both in `useHotzone`'s cached geometry: the window origin, and the scale factor — which is now read off the *window* rather than `primaryMonitor()`, because a 150% laptop panel beside a 100% external monitor would otherwise convert every cursor position by the wrong factor the moment the notch was sent to the other one. Both invalidate on the `settings-changed` broadcast, twice, 250ms apart, since `set_position` can still be in flight when Rust emits.

The physical width `place` positions against is derived (`560 × scale_factor`) rather than read back with `outer_size`, and that is not an optimisation. Windows rescales a window when it crosses onto a display with a different DPI, so a size read *before* the move is in the old screen's pixels and one read after needs the move to have landed — which means positioning twice and watching the notch jump from the left edge to wherever it belongs, on every preference change and not just on a screen change.

**Which screen the notch is on is a preference; how many screens there are is not.** `notchDisplay` is a monitor id (`\\.\DISPLAY2`) or `None` for "follow whichever screen Windows calls the main one" — and `None` is a real answer rather than "unset", because a laptop that changes docks wants to follow the primary and a user who pinned one panel does not. **A stored id that matches no connected screen falls back to the primary and is never rewritten.** That is the whole of the disconnect behaviour and the reason it is a fallback rather than a reset: clearing it would have a docked laptop forget its monitor every evening and need re-picking every morning. `display::start_watcher` polls the monitor set every 3s (a poll, because `WM_DISPLAYCHANGE` would mean subclassing a window procedure tao owns), and on any change re-runs `settings::apply` and emits `displays-changed` for the Settings map.

**`notchAllDisplays` is the only preference in the app that builds windows.** Mirroring is real windows and not one window stretched — there is no single rectangle that is the top edge of two monitors — so each extra screen gets `notch-widget-2`, `-3`, … loading the same bundle and mounting the same `App`. `main.tsx`'s default arm already covers them, deliberately: it is a catch-all rather than a `notch-widget` case, so nothing has to be widened per screen. Four things follow, and all four are the same rule — *the overlay is now a set, and anything that meant "the overlay" has to walk it*:

- `notch-widget` itself is never destroyed and is always target zero, with the target list ordered primary-first. Other modules look it up by name and the app quits with it.
- `apply_topmost`, `tray::reveal_notch` and the updater's pre-install hide all go through `display::notch_windows`. `notch_raise`/`notch_settle` deliberately do **not**: they take the *calling* window, because promoting every screen's notch because one grew would put a notch in front of a fullscreen video playing on the other one.
- The capability file matches `notch-widget-*` as well as `notch-widget`. A mirror missing a permission is a notch that works on one monitor and not the next.
- Anything that acts on the machine's behalf must run once, not once per screen. Today that is exactly one thing: `App` gates `useAutoUpdate` on being the lead window, or three monitors would be three downloads of the same installer and whichever finished first would restart the app out from under the other two. Everything the notch *draws* is duplicated, which is the point.

**No command may build a window, and `settings::apply_detached` is why.** `WebviewWindowBuilder::build()` **deadlocks on Windows when called from a synchronous command handler** — a documented WebView2/wry problem (wry#583), and Tauri's own guidance is to build windows from async commands or separate threads. `display::apply` builds one whenever a screen has just gained a notch, so every command that can reach it goes through `apply_detached`, which is a thread. The first version did not, and the symptom pointed nowhere near the cause: flipping "show the notch on every display" froze the whole app mid-command, so `save` never ran and the preference was back off at the next launch — a switch that appeared simply not to save, with a Settings window that had stopped answering `list_displays` and so showed the map and the radio disagreeing. Do not "simplify" a command back to calling `apply` directly.

Two things fall out of that. `display::apply` is split from `display::place_all`, which positions the windows that already exist and builds nothing — that half is safe anywhere, and `settings::init` calls it synchronously so the notch reaches its final origin before the first frame rather than sliding there. And the two new setters store and save *before* applying, because the apply is no longer something they can sequence against: it is on another thread, so it can no longer be what gates the write. `APPLYING` is a plain mutex serialising applies, so flipping the switch twice quickly cannot have two threads reconciling the window set from two different answers.

`hotzoneHint` is the position preference's companion and pure frontend: an 80×4 mark at the top edge, the exact width of the trigger strip, drawn only while `state === 'hidden'` **and always-on-top is off**. It has no behaviour — it sits in the click-through canvas with pointer events off, and hovering it is the ordinary hotzone entry.

That second condition is a fix, not a nicety. The mark draws at the top centre and the resting pill covers that exact spot, so with always-on-top on the hint can never actually be seen — but it was still being *rendered* for the one commit between `loaded` flipping true and the effect that raises the pill, which is long enough to fade in and straight back out. A switch you turn on and watch flicker reads as broken rather than as inapplicable, so the hint is suppressed outright and the Settings row is disabled with a line saying why. Do not "fix" this by drawing the hint under the pill.

**Four preferences are pure CSS**, and they work identically — `theme` and `accentColor` (above), `backgroundOpacity` and `cornerRadius`. None has anything for `settings::apply` to do; each is one property on each window's `:root`, written by a one-line hook, and each keeps three copies of its default in step. `cornerRadius` is `--radius-shell`, written by `useCornerRadius`, and it reaches every Mica shell in the app — the notch's cards, the tray popup, the settings window — because that is what the other three do and because "corner radius" is not a question anyone wants asked once per window. The inner radii (`radius.tile`, `.small`, `.pill`) are deliberately *not* reachable from it: they are the radius of a tile inside a card, and a square-cornered notch square-cornering its own list rows is not what the preference means. **Six more preferences move geometry and motion, and none of them resizes the window.** `notchWidth`/`notchHeight` (the resting pill), `panelScale` (expanded card *widths*), `animationSpeed`, `collapseDelay` and `cornerRadius` are the Appearance pane's Shape and Motion groups. Four things there are load-bearing:

- **The window is still a fixed 560×420 transparent canvas.** Every one of these moves the card drawn *inside* it, for the reason at the top of `layout.ts` — spring-resizing a transparent always-on-top window on Windows makes `backdrop-filter` re-sample every frame and tears. `layout.CARD_MAX_WIDTH` is what stops a scaled card outgrowing that canvas, which is why `panelScale`'s range can be generous: the calendar (480 wide) stops growing partway up the slider while the media card keeps going, and a range picked so the *widest* card could use all of it would barely move any of the others.
- **Width scales, height never does.** Card heights are the one thing in `tokens.ts` that is arithmetic rather than judgement — `system` is "26 nav + 16 padding + 16 header + … = 266" with every box pinned in the component — so scaling them would put the card and its hit rect out of step and leave exactly the stripe of empty Mica `layout.contentRect` exists to warn about.
- **`scaleSpring` scales stiffness by the square and damping by the factor**, which is the whole reason it is a function rather than a multiplication at the call site. A spring's character is its damping ratio ζ = c/2√(km); scaling stiffness alone drops ζ, so a "faster" notch would also start overshooting and wobbling — a different animation rather than the same one in less time. Applied in `NotchShell` only, to the card's spring and the panel cross-fade: a hover wash that took 200ms to appear is not what anyone means by slowing the notch down.
- **Only the grace window is adjustable, not the dwell.** They read like a pair and are not one. The dwell is how long you have to mean it before the notch opens — a guard against opening by accident, with a right answer. `collapseDelay` is how long it stays after you have finished with it, which is taste, and is the one users complain about in both directions.

`CollapsedPill` is the one component that had to change for this: its outer columns were two fixed 80s, which at the minimum pill width left 16px for the clock — the pill's one piece of content elided to nothing while the two decorations kept their full size. The columns give way first now.

**The summon shortcut is an OS registration, not a `keydown` listener.** `hotkey` is a preference and `hotkey.rs` owns it: `settings::apply` registers it with Windows through `tauri-plugin-global-shortcut`, the handler emits `hotkey-toggle`, and `App` turns that into `useNotchState`'s `toggle`. A webview listener could not work at all — the notch never takes focus, which is the whole click-through design, so it would only fire while the user was already interacting with the card they were trying to summon. Four things follow:

- **It is the one preference `apply` can fail at**, because Windows hands a global shortcut to exactly one process. So `set_hotkey` registers *before* it stores (the shape `set_mute_windows_banners` has) and puts the old shortcut back on failure — `hotkey::apply` clears the whole registration before trying the new one, so a refused rebind would otherwise cost the user the working shortcut they already had as the price of having tried a different one. `apply` itself ignores the error: at startup the clashing app may not even be running yet, and a shortcut another app holds is not a reason to fail an apply that has already moved windows.
- **A shortcut without a modifier is refused**, in the picker *and* in `hotkey::parse`, because `settings.json` is hand-editable. A bare `KeyN` is registered system-wide, i.e. no text field anywhere on Windows sees the letter again — and the user who did it cannot type the `n` needed to fix it.
- **The key half is stored as a `KeyboardEvent.code`** (`"Ctrl+Shift+KeyN"`): it names the physical key, so a shortcut set on QWERTY is the same key on AZERTY, and it is unaffected by the modifiers themselves, where `key` for Ctrl+Shift+2 is `"@"` on one layout and `"2"` on another. `formatHotkey` prettifies it; nothing else interprets it.
- **It toggles rather than shows.** It is the only way into the notch that does not involve the cursor, and so the only one with no way *out* — every other opening is dismissed by moving a mouse the user is moving anyway.

**The screenshots card stores nothing and copies nothing.** `screenshots.rs` scans the folders Windows saves captures to (`Pictures\Screenshots` and `Videos\Captures`, resolved through Tauri's path resolver because Pictures is the first known folder OneDrive redirects, plus the OneDrive env vars for a partial redirection), sorts by modified time and returns the newest 24. That is the whole model, and it is the `shelf.rs` rule again: a screenshot is already a file the user owns in a folder they know, and duplicating it into a cache would double the disk cost of every capture and then have to answer for the two copies disagreeing. It is "temporary" in the sense the feature wants — the window *rolls* — without anything being deleted. Which is also why the card offers open, drag-out and reveal-in-folder and no delete: there is nothing to remove *from*, and the only way to make a tile leave would be deleting a user's file from a surface that appears under their cursor when they reach for the top of the screen.

**A drag Crest started is not a file arriving, and the shelf has to be told which it is looking at.** `SHDoDragDrop` runs a real OS drag out of this very window, so the first thing the cursor crosses on its way out is the notch — which reaches `useFileShelf` as an ordinary `enter`/`over` and is indistinguishable from an incoming file. Untreated that was two bugs at once: dragging a screenshot lit the shelf's drop highlight and jumped the card to the shelf, off the grid being dragged from; and because the drop then lands in *another* app, the `leave` that would have put the highlight back never arrived, so the shelf sat inviting a drop that had finished, for the life of the process and across every later visit to the card. The guard is the `native-file-drag` window event both drag sources already dispatch for `useHotzone` — it is reused rather than a custom `dataTransfer` type because Tauri intercepts HTML5 drag-and-drop at the webview level and there is no `DragEvent` here to hang a type on. Ignore *every* payload type while it is set, the drop included, and clear `dragging` on both edges: a tile dragged out and released back on the notch is a cancelled drag, not a request to shelve what was already shelved.

**The guard has to outlive the drag by `DRAG_SETTLE_MS`, and that is the half that is easy to get wrong.** `SHDoDragDrop` blocks Tauri's event loop for the whole drag — deliberately, because OLE only tracks a drag on the thread owning the source window — so the `enter`/`over` Windows raises as the cursor crosses the notch cannot be dispatched while they happen. They queue, and the loop resumes only once the modal loop returns; `file-drag-ended` is emitted from *inside* that closure, so it reaches the webview first and the drag events land a moment later on a guard that has already been cleared. Symptom: the notch jumps to the shelf a fraction of a second **after** the file was dropped into another app, which reads as the notch switching cards on its own. A guard cleared on the `file-drag-ended` edge alone fixes the during-drag half and leaves this one, so do not "simplify" the settle timer away.

Three things there are load-bearing. The 2s poll is affordable because `list_screenshots` caches on the *directories'* own modified times — Windows bumps those on any add, remove or rename, so the steady state is two stat calls rather than a few thousand, and a Screenshots folder is somewhere people accumulate things. The unseen-path test alone is **not** enough to call something an arrival: the list is capped, so deleting one promotes the twenty-fifth, and `FRESH_MS` in `useScreenshots` is what stops the notch announcing a screenshot from last week because a folder was tidied. And thumbnails go through `icons::thumbnail`, which is `icons::extract` with `SIIGBF_ICONONLY` dropped — the shell already owns decoders for everything Windows can preview, so a grid of 4K PNGs at tile size costs no image crate.

The card itself carries two corrections worth reading before changing it. It has **no header of its own**: it shipped with a `Screenshots` section label directly under a nav strip already reading `‹ SCREENSHOTS ›`, and the 26px went to the tiles rather than the card shrinking. And the grid is `repeat(3, 1fr)` rather than fixed-width tiles wrapping in a flex row — the old four-across arithmetic came to *exactly* the 396 of content width, so rounding wrapped the fourth tile and the card drew three columns anyway. Three is also the right answer: a screenshot is 16:9, and at four the tile is squarer than the picture in it. A layout that depends on a rounding mode is one that will differ between displays, and `1fr` cannot disagree with a card `panelScale` has widened.

`backgroundOpacity` is the base alpha of the `.mica` fill, exposed as the `--mica-alpha` custom property and written onto each window's `:root` by `useSurfaceOpacity`. It goes through `settings.rs` anyway so it is stored, clamped and broadcast in one place, and the notch and the tray popup read it through the same `useSettings`.

**The settings window deliberately does not.** It calls `useSurfaceOpacity(100)` — a literal, because the CSS fallback is the *default* (0.92) and not 1 — and that is a fix for two things at once. It is the one window in the app made of body copy, and reading two hundred words through a wallpaper is the complaint the preference exists to answer rather than a look to offer. It also made the control lie: it was the only surface visibly responding to the drag, so the slider appeared to adjust *itself* and do nothing to the notch it names. The corner radius still applies here, because that is a shape question rather than a legibility one and a settings window with different corners from the notch looks like a different app.

**The floor is 25, and it was 60.** At 60 the preference had no visible range at all on the desktops this app actually runs on: Crest's Mica base is `rgb(32,32,32)` and a dark editor behind it is about `rgb(31,31,31)`, so compositing one over the other at 60% gives 31.6 against 32 at full — less than half a value out of 255. The old floor's stated reasoning ("an overlay nobody can see or find, set from a window that is itself invisible at that point") turned out to be wrong on both halves: `--mica-alpha` governs the surface fill only, so the text, tiles, hairline and drop shadow stay fully opaque and a notch at 25% is a legible card on a faint wash; and the window setting it is now always solid. The Appearance row carries a line saying the effect is hardest to see over a dark window, because that is the one thing the slider cannot demonstrate about itself. Three copies of the default have to agree — `background_opacity_default()`, `DEFAULTS` in `useSettings.ts`, and the `--mica-alpha` fallback in `index.css` — because the last two are what paint before the file is read. The default is above the design export's `.80` deliberately; that value reads as glass over a plain wallpaper and as noise over a text editor. Do not put the alpha back into `.mica` as a literal, and do not stack a second scrim on top of it (the settings window used to have one) — the slider can only reach what the variable controls.

**Starting with Windows is a scheduled task, not the Run key.** `tauri-plugin-autostart` writes `HKCU\…\Run`, which is a *queue*: Explorer delays it ~10s and then walks the entries with a stagger. On a machine with Docker Desktop, Steam, Epic, Riot and Google Drive also in that list, Crest was tenth and appeared about five minutes after login. No amount of making Crest faster moves it up that list. `autostart.rs` registers a logon-triggered task instead, which Task Scheduler starts independently of that walk. Three XML settings are load-bearing and all three defaults are wrong: `DisallowStartIfOnBatteries` defaults to **true** (a laptop would silently never start it — the single most common way a scheduled task "does not work"), the logon `Delay` is pinned to `PT0S`, and `Priority` defaults to 7 (below-normal) where 5 is normal. It runs `LeastPrivilege`/`InteractiveToken`, so no elevation and no UAC — which is what makes it viable at all. The Run key stays as the fallback, and turning startup off clears both.

None of that applies inside an MSIX, which uses the manifest's own startup task
instead — `autostart.rs` branches at runtime on `is_packaged()`, and writing a
scheduled task from inside a package would outlive the package. See
[The Store build](#the-store-build-msix).

Related bug, now fixed: `setup` used to call `autolaunch().enable()` **unconditionally on every launch**, so turning the tray toggle off lasted until the next boot. `autostart::migrate` replaces it, and `settings.autostart_configured` is what lets it tell "off on purpose" from "never set up" — without that flag it cannot avoid re-enabling on every start.

**Only an installed build may enrol itself**, and the task is repointed at whatever installed build is running. The task records `current_exe()`, so the first `npm run tauri dev` on a machine that had never configured startup registered `target\debug\…exe` — a binary that loads Vite's dev URL rather than the bundled frontend and, since `windows_subsystem = "windows"` is release-only, opens a console. That is a console window and a webview reading "localhost refused to connect" at every login, and it *survived installing the real app*, because `task_exists()` was true from then on and `migrate` had nothing that would repoint it. `is_installed_build` refuses both the debug build and a release binary sitting in `target\release` (running what `tauri build` produced is no more a request for startup than the other), and it gates `set_enabled` rather than `create_task`, or the Run-key fallback would write the same dev path by the slower mechanism. In that state `migrate` must also return **false**, leaving `autostart_configured` unwritten — a dev session recording a choice nobody made would read as "off on purpose" to the first installed launch, which would then never start up. The repoint is the self-healing half: an installed build that finds the task aimed elsewhere re-creates it, which fixes a moved install and this bug alike, one launch after the app is installed. `task_targets` substring-matches the path rather than parsing the XML, through a `decode` that handles `schtasks` answering in UTF-16 on some machines and the console codepage on others — read the wrong way the path never matches and the task is rewritten on every launch.

**Updates install themselves, silently, with the notch as the only UI.** `installMode` is `"quiet"` in `tauri.conf.json`, so NSIS runs with `/S` and draws nothing — no setup window, no progress dialog, no completion page. `useAutoUpdate` checks 25s after launch (not immediately: launch is the busiest moment on the machine and Crest now starts *early*) and every 6h after, then downloads and installs without asking. Quiet mode only works because the bundle is a per-user install needing no elevation; a per-machine build would fail silently where `"passive"` would at least raise UAC. The loader is `UpdateAnnounce` on the ordinary announce banner, **held up by re-announcing on every progress tick** rather than by a new state — that reuses the existing hit rect and pin lease and gives the banner the right lifetime for free (up while bytes arrive, gone by itself if they stop). Its cross-fade key is constant, or fifty progress ticks would remount the loader and reset the ring.

**Rust ↔ frontend.** Every native command is registered in the `invoke_handler!` list in `src-tauri/src/lib.rs`; one module per feature area (`media`, `launcher`, `clipboard`, `shelf`, `screenshots`, `notes`, `reminders`, `timer`, `notifications`, `system`, `perf`, `audio`, `weather`, `icons`, `autostart`, `display`, `hotkey`, `tray`, `updater`). Frontend hooks in `src/hooks/` are the only callers of `invoke`; components take state as props. A Windows named mutex in `lib.rs` enforces a single instance — two overlays blend their cards and misdirect native drags.

Note: the Rust crate is named `windows_dynamic_noich` (typo in the original scaffold). It is referenced from `Cargo.toml`'s `[lib]` and `main.rs`; leave it alone unless renaming all references.

## Releasing

Tag-triggered, never push-triggered — every run of `.github/workflows/release.yml` is an update prompt on a user's machine.

1. Bump `version` in `product/src-tauri/tauri.conf.json` — **this is the only number the updater compares**. (The two `package.json` versions are not the release version.)
2. Bump `version` in `lib/site.ts` to match; the site's download URL is built from it, so a mismatch is a 404 on the download button.
3. Add a `## <version>` section to `CHANGELOG.md`. The workflow extracts that section as the release body and *fails the build* if it is missing or empty.
4. `git commit`, then `git tag vX.Y.Z && git push origin main --tags`.

The workflow builds from `product/`, signs with `TAURI_SIGNING_PRIVATE_KEY`, and publishes the NSIS installer, its `.sig`, and `latest.json`. There is intentionally no `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret — the key has no password and GitHub cannot store an empty secret, so the empty reference is correct.

**This ships the NSIS path only.** The Store package is not built, signed or
uploaded by the workflow — it is `npm run tauri:msix:build` and a manual Partner
Center submission, off the same `tauri.conf.json` version. So a release that
matters to Store users is two steps, and skipping the second leaves the Store on
the previous version with nothing anywhere saying so. See
[The Store build](#the-store-build-msix).

## The Store build (MSIX)

Two distribution paths, one binary. Direct downloads get the NSIS installer from
GitHub Releases; the Microsoft Store gets an MSIX built by
`@choochmeque/tauri-windows-bundle` from `src-tauri/gen/windows/`. The Store path
exists because the Win32 submission was rejected under policy 10.2.9 — every PE
file must be signed by a cert chaining to the Microsoft Trusted Root Program, and
Azure Trusted Signing is not available in India for an individual or for Ascendry
as an org. The Store re-signs MSIX packages itself, at no cost, which is the whole
reason for the second path. **The MSIX is left unsigned on purpose** — a signing
cert is the thing this whole path exists to avoid.

**That unsigned package cannot be sideloaded, which is why there are two of them.**
`Add-AppxPackage -AllowUnsigned` is not a flag that waives the requirement; it
only accepts a package whose *identity* says being unsigned was deliberate, by
carrying the marker OID `2.25.311729368913984317654407730594956997722=1` inside
the Publisher string. Partner Center pins Publisher to the exact value it reserved
(`CN=4E27AC9C-…`) and anything appended stops matching, so "installable locally"
and "acceptable to the Store" are mutually exclusive properties of one package.
Hence `npm run tauri:msix:build:local`, which produces a second package that is
the first one with that single attribute changed, into `target/msix-localtest/`.
Everything else — the exe, the assets, the capabilities, the startup task — is
byte-identical, so a bug found in the test package is a bug that would have
shipped and cannot hide behind a differently-configured build.

`scripts/build-msix-local.mjs` gets there by copying what the real build already
staged in `target/appx/x64` and rewriting `<Identity Publisher>` in the copy. It
**never writes to `gen/windows/bundle.config.json`**. The obvious implementation —
swap in a test config, build, swap back — leaves a window in which the committed
Store identity is replaced on disk by a test one, and a build interrupted in that
window poisons the repo in exactly the way the `tauri.windows.conf.json` trap
below describes, only harder to spot because the file is still named correctly.
Nothing in that script opens a real-identity file for writing, so the upload path
cannot be affected by anything it does.

The two are separate installs to Windows: same `Name`, different `Publisher`, so
different package identities. Both can be present at once and both show up as
"Crest", which is worth knowing before wondering which one is running —
`Get-AppxPackage *CrestNotch*` tells them apart by publisher, and pipes to
`Remove-AppxPackage`.

**Never create `product/src-tauri/tauri.windows.conf.json`.** The name looks like
exactly the right place for Windows-only overrides and it is poisoned for this
repo specifically. Tauri v2 auto-merges `tauri.<platform>.conf.json` into the main
config — it is in Tauri's own config schema, alongside the `linux`/`macos`/`android`/`ios`
variants — so that file applies to **every** Windows build, which here means the
NSIS installer that ships to everyone not on the Store. The trap is that
`tauri-windows-bundle` *also* reads that filename and its docs point you at it, so
the tool's convention and Tauri's convention collide, and they only collide in a
repo that has two Windows distribution paths. Following the tool's instructions
puts the Store identity into the shipping installer: `identifier` changes, and with
it `app_data_dir()`, so every existing user's notes, reminders, timer and
`settings.json` silently move and the app comes up empty — months after the commit
that did it, on a release nobody connected to the Store work. Store-only values go
in `gen/windows/bundle.config.json`, which nothing but the MSIX path reads.
`tauri.store.conf.json` (the offline-WebView2 NSIS variant) is the pattern to copy
if a Tauri-level override is ever genuinely needed: it only applies when passed
explicitly with `--config`, so it cannot leak into a build that did not ask for it.

**Capabilities are declared from what the code does, and `DeviceCapability` goes
last.** Five are declared: `runFullTrust` (automatic — `Windows.FullTrustApplication`
requires it, and it is also what keeps PDH, `IPolicyConfig`, `ExitWindowsEx`, the
`shell:AppsFolder` walk and ordinary Win32 file access working, none of which
survive an app container), `internetClient` for `weather.rs`, `bluetooth` for
`system.rs`, `userNotificationListener` for `notifications.rs`, and
`unvirtualizedResources` — the one restricted capability here that is not
automatic, paired with `RegistryWriteVirtualization` and explained below. There is
deliberately **no screen-capture capability**: `screenshots.rs` scans the folders
Windows saves captures to and never captures anything, so the module the name
suggests would need one is the one that does not.

Two ordering rules, both from the foundation schema, which models `Capabilities` as
any number of `Capability` and foreign-namespace capabilities followed by
`DeviceCapability`. `userNotificationListener` is a `uap3` capability the bundler's
whitelist has no bucket for, so it is hand-written in `AppxManifest.xml.template`
**above** the generated block; below it, packaging fails outright with MakeAppx
`C00CE014`. And for the same reason the bundler's `restricted` array cannot be
combined with its `device` array at all — it emits restricted capabilities *after*
the device ones — so a restricted capability, if one is ever justified, is
hand-written in the template too.

**Which build is running is asked at runtime, not compiled in.**
`autostart::is_packaged()` calls `GetCurrentPackageFullName`, and `is_enabled`,
`set_enabled` and `migrate` each branch on it: a package uses the manifest's
`windows.startupTask` extension, everything else keeps the scheduled task and the
Run-key fallback. A Cargo feature was the obvious alternative and is worse — it
decides at build time, so a release built with the wrong flag is a Crest that
either never starts with Windows or writes a scheduled task from inside a package,
and both look fine until someone logs in. Writing a task from a package is the
worse half: the package uninstalls and the task stays, so every login afterwards
launches a path that no longer exists. Two things follow. `MSIX_TASK_ID` in
`autostart.rs` must match `extensions.startupTask.taskId` in `bundle.config.json`
— one value in two files, with nothing at compile time that would notice them
drifting. And `StartupTaskState::DisabledByUser` is not recoverable from inside the
app: once someone switches Crest off in Task Manager's Startup tab
`RequestEnableAsync` returns that state and changes nothing, which is Windows'
rule and not a gap, so `set_enabled` reports the state actually reached and the
tray switch snaps back rather than showing an on that never took.

**The updater stands down when packaged, on both paths.** `updater_auto_allowed`
is false and `updater_check`/`updater_install` return an error, which is stricter
than the source-tree rule above them — there, a developer asking explicitly is a
legitimate ask; here no version of the ask ends well. The payload is an NSIS
installer and it cannot service an MSIX: at best it writes a second, unpackaged
Crest into `%LOCALAPPDATA%`, leaving two installs whose single-instance mutex means
whichever wins the boot silently suppresses the other, with the Store still
reporting the package as up to date.

`scripts/stage-msix-exe.mjs` exists because cargo names the binary after the
package — `windows_dynamic_noich`, the scaffold typo — while the bundler derives
`Crest.exe` from `productName`, and `--no-bundle` leaves no rename step between
them. It copies rather than renames (the bundler runs its own `tauri build`
afterwards and cargo checks freshness by the name it knows). Renaming the crate or
adding a `[[bin]]` would both fix it by changing what *every* build emits, the
NSIS one included, which is the one thing this path must not do.

Identity has to match Partner Center byte for byte or the upload is rejected:
`LennyDanyDerek.CrestNotch`, `CN=4E27AC9C-84B1-422E-A39E-F5722FC51CD9`, product ID
`068e2226-c083-4fff-a601-4c7bd97336e4`. Outputs are version-stamped —
`Crest_<version>_x64.msix` and `Crest_<version>.msixbundle`; the bundle is what
Partner Center takes. x64 only for now.

**`muteWindowsBanners` needs two manifest entries to work in the package, and
without them it fails silently.** The mechanism is a registry write the shell
reads back, and a packaged app's HKCU writes are redirected by default into a
private hive. Measured on 0.7.1 by sideloading, both ways: with the default, all
46 `ShowBanner` values went to
`%LOCALAPPDATA%\Packages\<PFN>\SystemAppData\Helium\User.dat` and the real
`…\Notifications\Settings` had **none**; with the opt-out, the same sweep put all
46 into the **real** hive and Windows stopped drawing banners. Nothing errors in
the broken case — the sweep reports success and the memo records 46 apps it
believes it muted — which is what makes this worth a paragraph rather than a
line.

The opt-out is a pair, and neither half does anything alone:
`<desktop6:RegistryWriteVirtualization>disabled` in `<Properties>`, and the
`unvirtualizedResources` restricted capability. It also forces
`MinVersion 10.0.19041.0`, which is why the npm script passes a min-windows flag —
the bundler's 17763 default was never reachable for a Windows 11 app anyway.
File-system virtualization is deliberately left **on**: `%APPDATA%` writes already
reach the real location, so there is nothing to buy and turning it off would widen
what has to be justified.

**The Store grants `unvirtualizedResources` case by case, so the submission has to
justify it** — and that is now the one thing standing between this build and the
Store rather than a detail. The justification is what the app is for: Crest
replaces Windows' banner with its own, and per-app `ShowBanner` is the only
mechanism Windows exposes for suppressing the one it draws, so without it the
notch shows a notification *beside* the banner it was meant to replace, which is
the feature inverted rather than missing.

If it is ever declined, `notifications::banner_muting_supported()` is the seam and
the change is one line — return `!crate::autostart::is_packaged()`. That gates
`apply_banners` (the sweep stops running, and the restore path cleans up a memo an
earlier build wrote), refuses `set_mute_windows_banners` with a message naming the
Store, and dims the Settings row with a line underneath, the same answer "Show me
where it is" gives. All of that is written and currently inert, kept because the
alternative is finding four call sites under a resubmission deadline. **The
preference itself is never touched by that path**: it stays stored and correct for
the NSIS build, so a profile moving between the two keeps its choice.

Two things fall out of that measurement and are worth keeping. **File writes are
*not* virtualized**: the packaged build reads and writes the real
`%APPDATA%\com.lenny.crest`, the same `notes.json`, `reminders.json` and
`settings.json` the NSIS build uses, so moving a user from one to the other
carries their data across for free. Registry and filesystem virtualization behave
differently here, so neither answer can be assumed from the other. And **the NSIS
build's uninstaller does not remove the `Crest` scheduled task** — it is left
Ready, pointing at a deleted `…\AppData\Local\Crest\windows_dynamic_noich.exe`,
firing and failing at every login. Harmless to the packaged build, which branches
on `is_packaged()` and never consults the scheduler, but every NSIS→Store migrator
inherits it, and `schtasks /Delete /TN Crest /F` is what clears it.

## Styling

The two projects have different styling models and the product's is not Tailwind-first:

- **Product**: inline styles + tokens from `src/tokens.ts`, plus the `.mica` recipe in `src/index.css` (base surface + SVG noise + top-only hairline). Tailwind is installed via `@tailwindcss/vite` but the Mica surfaces are hand-written CSS ported from the design file. `vite.config.js` sets an inline empty `css.postcss` on purpose — otherwise Vite walks up and finds the site's root `postcss.config.mjs`, which needs a root-only dependency that a `product/`-only CI install never has.
- **Site**: Tailwind 4 with tokens in `app/globals.css`, dark-only by design (it borrows the product's palette; a light theme would misrepresent the app). All copy, URLs, and the version live in `lib/site.ts`.
