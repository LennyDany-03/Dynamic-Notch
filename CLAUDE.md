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
npm run tauri dev     # full app: Vite on :1420 + Rust backend
npm run dev           # Vite only — browser fallback, see below
npm run tauri build   # installers → src-tauri/target/release/bundle/
```

`npm run build` in `product/` is `vite build` only — no `tsc` step, so type errors do not fail the build. Type-check explicitly with `npx tsc --noEmit` from `product/`.

There is no test suite in either project. Prerequisites for the product: Rust toolchain, Node 18+, Tauri CLI v2.

### Browser fallback

`useHotzone` detects Tauri via `window.__TAURI_INTERNALS__` and falls back to DOM `mousemove` when absent. That means plain `npm run dev` in a browser exercises the whole state machine and all UI, with the viewport standing in for the screen — useful for layout/animation work without a Rust rebuild. Anything calling `invoke()` (media, launcher, clipboard, shelf, notes) will not work there.

## Product architecture

`product/Architecture.md` is the long-form design record, including the rationale for decisions that look wrong out of context. Read it before structural changes. The load-bearing invariants:

**The OS window is never resized.** The overlay is a fixed 560×420 transparent, always-on-top, `skipTaskbar` window pinned at `y: 0` and horizontally centered by `lib.rs` at startup. Cards animate *inside* that canvas. Spring-resizing a transparent always-on-top window on Windows makes `backdrop-filter` re-sample every frame and tears.

**Cursor position is polled from the OS, not read from DOM events.** The window sits in `setIgnoreCursorEvents(true)` whenever the cursor is not over card content, so the webview receives no mouse events at all. `useHotzone` polls `cursorPosition()` at ~60Hz, caches monitor/window geometry (refreshed every 2s), and converts physical screen px → window-local CSS px.

**`src/layout.ts` is the single source of geometry**, read by both the state machine (hit-testing) and `NotchShell` (rendering) so the visible card and the interactive bounds cannot drift apart. `contentRect` is exactly the card that is drawn, for every state and module. The rule it has to respect is that a rect must never shrink out from under a stationary cursor — switching from the launcher to a shorter module with a click would otherwise drop the cursor outside and collapse the notch mid-click — and that is enforced by the latch in `useNotchState.getContentRect`, which holds the previous rect for as long as the cursor is inside it and adopts the new one the moment it is not. This is why the getter handed to `useHotzone` takes the point being tested.

Do not go back to a constant rect sized to the largest card, which is what enforced the rule before. It left a permanent dead zone: the media card is 380×164 and the rect was 440×346, so a cursor parked ~180px below the visible card — over a browser tab strip — held the notch expanded and swallowed clicks with nothing under it to explain why. With always-on-top off, that reads as "the notch is stuck on screen".

**`src/tokens.ts` is a transcription of the design export** (`Dynamic Notch v2.dc.html`), not a place to make design decisions. The `spring` values are the one exception and are marked as such. `size` heights are design content height *plus* `NAV_STRIP_HEIGHT`.

**State machine** — `hooks/useNotchState.ts` owns visibility; no component decides its own:

```
hidden ──cursor in hotzone (no delay)──▶ peek ──600ms dwell──▶ expanded
       ◀──300ms grace──────────────────       ◀──300ms grace──
```

`useNotchState({ alwaysVisible })` moves the **floor** of that machine from `hidden` to `peek` — the always-on-top preference means the pill rests on screen rather than collapsing away. It is a floor and not a second mode on purpose: every transition above it is unchanged, so there is no parallel set of rules to keep in step. Anything asking "did the notch just grow or shrink?" compares `STATE_RANK` rather than testing for `hidden`, which is no longer a state the notch necessarily reaches.

`activeModule` (`'media' | 'launcher' | 'files' | 'notifications'`) is deliberately separate from `state`, so switching modules resizes the card without retriggering the expand animation. `showModule(m, { pin: true })` suppresses the grace-window collapse for openings the cursor did not cause (tray menu). The pin is released by the cursor arriving, by the window blurring, or by `timing.pinMs` running out — and the lease is the only one of the three that always fires. The overlay takes focus only when its card is clicked, so a window that was never focused never blurs; without the lease, a card opened from the tray and then ignored stayed pinned for the life of the process, expanded and topmost, because the step-down is guarded on the pin and `notch_settle` only runs on collapse. That was the "always on top is off and the notch is still on screen" bug. The pin is React state, not just a ref, precisely so releasing it re-runs the step-down effect.

Adding a module means five edits that have to agree: `MODULES` (nav order), `size` in `tokens.ts`, the `LABELS` records in `NavArrows` and `ModulePlaceholder`, the switch in `NotchShell`, and a tray row — whose group height is written into both the arithmetic comment in `TrayMenu.tsx` and the `tray-menu` height in `tauri.conf.json`. A new card must not exceed the largest existing card in either axis, or it grows `EXPANDED_BOUNDS` in `layout.ts` — the one interactive rect every module shares — and widens the region that holds the notch open for modules that do not need it.

There is a fourth state, `announce`, that the cursor never asks for: a 300×64 banner dropped in for `timing.announceMs` and retracted to the floor, reporting something the user did not go looking for. Two sources so far — music starting (`useMediaAnnounce`, keyed on app + title + artist while playing) and an arriving Windows notification (`useWindowsNotifications`, keyed on notification-centre ids). Both go through `announce(announcement, ms)`, which carries a tagged `Announcement` rather than a module: media borrows the media card, and a notification carries the notification itself, since the banner reports one specific arrival rather than opening a page. It is a state rather than a timed `expanded` so it gets its own hit rect from `layout.ts` and the ordinary dwell: hovering the *media* banner opens the media card, where the transport controls live (the banner deliberately has none), while hovering a notification banner only holds it up to be read — reading it is the whole action, and the notifications module is where it can be gone back to afterwards. `announce()` pins like the tray's openings and declines while the cursor is on the notch or a card is already open. One announce size, so the hit rect stays a function of `state` alone.

**The notifications module is the same poll seen twice.** `useWindowsNotifications` reports arrivals (the banner) *and* returns the standing list (the module) from one 2s poll — a second poll would double the WinRT round trips for data this one already has. The arrival half baselines on its first poll; the list half deliberately does not, because the backlog is exactly what it is for. `NotificationDetail` is a sheet *inside* the card, not a floating popup: anything drawn outside `EXPANDED_BOUNDS` sits on a click-through region, so a popup hanging below the card would take no clicks and the notch would collapse the moment the cursor moved onto it. The "notifications in the notch" preference gates the module as well as the banner — one switch for whether the notch reads the notification centre at all.

The notification app icon comes from `icons::app_icon` on `shell:AppsFolder\<AUMID>`, not from `AppInfo.DisplayInfo.GetLogo` — that WinRT call never completes off an STA pump (3s timeout, `None` every time) and cannot see unpackaged apps at all. `AppLogo` fetches it itself via `useNotificationLogo`, so a slow icon costs an icon and never the notification; the hook caches by AUMID, which is what makes a list of twenty rows each mounting their own copy cost four calls rather than twenty.

Both watchers must keep running while nothing is on screen — hidden is exactly when a banner earns its keep — so `useMediaSession` drops to a 2s watch rate instead of stopping, and the notification poll is unconditional at 2s. Each takes its first poll as a baseline: without that, launching Crest replays the notification backlog and announces whatever was already playing.

**Three windows share one bundle.** `main.tsx` switches on `getCurrentWindow().label` and mounts `TrayMenu` for `tray-menu`, `SettingsWindow` for `settings`, and `App` for everything else (the default arm also covers the browser fallback, which has no label). The tray carries no native menu at all — a Win32 menu can't be Mica-styled — so `tray.rs` positions and shows a pre-built borderless window instead. Settings is likewise built at startup and only hidden, so `lib.rs` intercepts its `CloseRequested` to hide rather than destroy the webview. Each window has its own capability file in `src-tauri/capabilities/`; adding a `@tauri-apps/api` call usually means adding a permission there.

**One preference reaches outside the app.** `muteWindowsBanners` silences Windows' own corner pop-up by writing `ShowBanner = 0` **per app** under `HKCU\...\Notifications\Settings\<AUMID>` — the value behind the per-app "Show notification banners" checkbox, which the shell reads as each notification arrives. The global `NOC_GLOBAL_SETTING_TOASTS_ENABLED` is written too but does nothing on Windows 11 26200 (verified: set to 0, banners kept coming), so it is a bonus for builds that honour it, not the mechanism. Never `Enabled` or `PushNotifications\ToastEnabled` — those stop delivery, so the notification would never reach the notification centre and the notch would have nothing to announce either.

`notifications.rs` owns the whole mechanism and its own restore memo (`notification-banners.json` in app-data, not `settings.json`: it is a record of changes made outside the app, sized to the user's installed software). Muting sweeps every registered app; an app that registers later silences itself at the first notification it raises (`mute_app_on_sight`, off the poll), one banner late. An app already at `0` is left out of the memo, so a user who had turned that app's banner off themselves keeps it off. Four guards: refused unless notch notifications are on *and* `UserNotificationListener` access is granted; turning notch notifications off un-mutes; revoked access un-mutes on the next apply; and `settings::shutdown` (hooked to `RunEvent::Exit`, which is why `lib.rs` calls `.build().run(…)` rather than `.run()`) hands every banner back on the way out — a muted shell plus a notch that is not running is a machine with no notifications at all.

**Preferences go through `settings.rs`.** Stored as a flat `settings.json` in the app-data dir, same shape as `notes.rs`; the running app answers from `settings::Current`, an in-memory copy seeded at startup. `settings::apply` is the single place that maps a preference onto window state and runs at startup, on every change, and on every appearance, so nothing can be honoured live but lost on relaunch. Fields need `#[serde(default = ...)]` or the first launch after a new preference ships fails the parse and resets the rest. A default that mirrors a value in `tauri.conf.json` (`alwaysOnTop`) has to agree with it — the window is built from the config and only corrected afterwards.

Every accepted change is broadcast as a `settings-changed` event. No window is ever rebuilt, so a preference set in Settings would otherwise not reach the notch — which reads the same `useSettings` hook — until the next relaunch. Frontend consumers whose behaviour is *visible* must gate on that hook's `loaded` flag: `DEFAULTS` is a guess, and acting on it puts a pill on screen that gets snatched back a frame later for everyone who had the preference off.

**Always-on-top means two things.** Above other windows *while idle* **and** resting on screen — one switch, a z-order half owned by Rust and a visibility half owned by `useNotchState`'s floor. The name is the user's, so both halves live behind it.

The z-order half is not one call, and it does not track the preference alone — it tracks **whether the notch is on screen**. `notch_raise` promotes unconditionally and `notch_settle` returns the window to the band the preference selects; they only make sense as a pair. A card the user reached for and cannot see is a broken notch however the switch is set, and with the preference off the window sits below every focused window, so the notch would expand behind whatever app is in front. `useNotchState` raises on two rising edges — the notch growing (`STATE_RANK` increases) and the cursor arriving (`inside`) — and settles when it shrinks back to `hidden`. Growth rather than leaving `hidden`, because a notch whose pill rests on screen leaves `hidden` exactly once, at startup, and a band lost hours later would never be reclaimed; the cursor edge because a pill already resting at `peek` has no growth to key on.

`apply_topmost` sets `false` before `true` on purpose: tao's `apply_diff` returns early when the requested `ALWAYS_ON_TOP` matches its cached flag, so re-asserting "on" on a window it already thinks is on top emits no `SetWindowPos` at all — even after a fullscreen app has pushed it out of the topmost band behind tao's back. Collapsing any of this back into a plain `set_always_on_top`, or into a raise that reads the preference, reintroduces "always on top stops working" / "the notch doesn't show over my apps".

**One preference is pure CSS.** `backgroundOpacity` has nothing for `settings::apply` to do — it is the base alpha of the `.mica` fill, exposed as the `--mica-alpha` custom property and written onto each window's `:root` by `useSurfaceOpacity`. It goes through `settings.rs` anyway so it is stored, clamped and broadcast in one place, and every window (notch, tray popup, settings) reads it through the same `useSettings`. Three copies of the default have to agree — `background_opacity_default()`, `DEFAULTS` in `useSettings.ts`, and the `--mica-alpha` fallback in `index.css` — because the last two are what paint before the file is read. The default is above the design export's `.80` deliberately; that value reads as glass over a plain wallpaper and as noise over a text editor. Do not put the alpha back into `.mica` as a literal, and do not stack a second scrim on top of it (the settings window used to have one) — the slider can only reach what the variable controls.

**Rust ↔ frontend.** Every native command is registered in the `invoke_handler!` list in `src-tauri/src/lib.rs`; one module per feature area (`media`, `launcher`, `clipboard`, `shelf`, `notes`, `notifications`, `icons`, `tray`, `updater`). Frontend hooks in `src/hooks/` are the only callers of `invoke`; components take state as props. A Windows named mutex in `lib.rs` enforces a single instance — two overlays blend their cards and misdirect native drags.

Note: the Rust crate is named `windows_dynamic_noich` (typo in the original scaffold). It is referenced from `Cargo.toml`'s `[lib]` and `main.rs`; leave it alone unless renaming all references.

## Releasing

Tag-triggered, never push-triggered — every run of `.github/workflows/release.yml` is an update prompt on a user's machine.

1. Bump `version` in `product/src-tauri/tauri.conf.json` — **this is the only number the updater compares**. (The two `package.json` versions are not the release version.)
2. Bump `version` in `lib/site.ts` to match; the site's download URL is built from it, so a mismatch is a 404 on the download button.
3. Add a `## <version>` section to `CHANGELOG.md`. The workflow extracts that section as the release body and *fails the build* if it is missing or empty.
4. `git commit`, then `git tag vX.Y.Z && git push origin main --tags`.

The workflow builds from `product/`, signs with `TAURI_SIGNING_PRIVATE_KEY`, and publishes the NSIS installer, its `.sig`, and `latest.json`. There is intentionally no `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret — the key has no password and GitHub cannot store an empty secret, so the empty reference is correct.

## Styling

The two projects have different styling models and the product's is not Tailwind-first:

- **Product**: inline styles + tokens from `src/tokens.ts`, plus the `.mica` recipe in `src/index.css` (base surface + SVG noise + top-only hairline). Tailwind is installed via `@tailwindcss/vite` but the Mica surfaces are hand-written CSS ported from the design file. `vite.config.js` sets an inline empty `css.postcss` on purpose — otherwise Vite walks up and finds the site's root `postcss.config.mjs`, which needs a root-only dependency that a `product/`-only CI install never has.
- **Site**: Tailwind 4 with tokens in `app/globals.css`, dark-only by design (it borrows the product's palette; a light theme would misrepresent the app). All copy, URLs, and the version live in `lib/site.ts`.
