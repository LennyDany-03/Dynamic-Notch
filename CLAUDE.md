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

**`src/layout.ts` is the single source of geometry**, read by both the state machine (hit-testing) and `NotchShell` (rendering) so the visible card and the interactive bounds cannot drift apart. Interactive bounds while expanded are constant across modules (the largest card in each axis) — a rect that shrank under a stationary cursor would collapse the notch mid-click.

**`src/tokens.ts` is a transcription of the design export** (`Dynamic Notch v2.dc.html`), not a place to make design decisions. The `spring` values are the one exception and are marked as such. `size` heights are design content height *plus* `NAV_STRIP_HEIGHT`.

**State machine** — `hooks/useNotchState.ts` owns visibility; no component decides its own:

```
hidden ──cursor in hotzone (no delay)──▶ peek ──600ms dwell──▶ expanded
       ◀──300ms grace──────────────────       ◀──300ms grace──
```

`useNotchState({ alwaysVisible })` moves the **floor** of that machine from `hidden` to `peek` — the always-on-top preference means the pill rests on screen rather than collapsing away. It is a floor and not a second mode on purpose: every transition above it is unchanged, so there is no parallel set of rules to keep in step. Anything asking "did the notch just grow or shrink?" compares `STATE_RANK` rather than testing for `hidden`, which is no longer a state the notch necessarily reaches.

`activeModule` (`'media' | 'launcher' | 'files'`) is deliberately separate from `state`, so switching modules resizes the card without retriggering the expand animation. `showModule(m, { pin: true })` suppresses the grace-window collapse for openings the cursor did not cause (tray menu) until the cursor arrives or the window blurs.

There is a fourth state, `announce`, that the cursor never asks for: a 300×64 banner dropped in for `timing.announceMs` and retracted to the floor, reporting something the user did not go looking for. Two sources so far — music starting (`useMediaAnnounce`, keyed on app + title + artist while playing) and an arriving Windows notification (`useWindowsNotifications`, keyed on notification-centre ids). Both go through `announce(announcement, ms)`, which carries a tagged `Announcement` rather than a module, because a notification has no card behind it. It is a state rather than a timed `expanded` so it gets its own hit rect from `layout.ts` and the ordinary dwell: hovering the *media* banner opens the media card, where the transport controls live (the banner deliberately has none), while hovering a notification banner only holds it up to be read. `announce()` pins like the tray's openings and declines while the cursor is on the notch or a card is already open. One announce size, so the hit rect stays a function of `state` alone.

The notification banner's app icon comes from `icons::app_icon` on `shell:AppsFolder\<AUMID>`, not from `AppInfo.DisplayInfo.GetLogo` — that WinRT call never completes off an STA pump (3s timeout, `None` every time) and cannot see unpackaged apps at all. The banner fetches it itself via `useNotificationLogo`, so a slow icon costs an icon and never the notification.

Both watchers must keep running while nothing is on screen — hidden is exactly when a banner earns its keep — so `useMediaSession` drops to a 2s watch rate instead of stopping, and the notification poll is unconditional at 2s. Each takes its first poll as a baseline: without that, launching Crest replays the notification backlog and announces whatever was already playing.

**Three windows share one bundle.** `main.tsx` switches on `getCurrentWindow().label` and mounts `TrayMenu` for `tray-menu`, `SettingsWindow` for `settings`, and `App` for everything else (the default arm also covers the browser fallback, which has no label). The tray carries no native menu at all — a Win32 menu can't be Mica-styled — so `tray.rs` positions and shows a pre-built borderless window instead. Settings is likewise built at startup and only hidden, so `lib.rs` intercepts its `CloseRequested` to hide rather than destroy the webview. Each window has its own capability file in `src-tauri/capabilities/`; adding a `@tauri-apps/api` call usually means adding a permission there.

**One preference reaches outside the app.** `muteWindowsBanners` silences Windows' own corner pop-up by writing `ShowBanner = 0` **per app** under `HKCU\...\Notifications\Settings\<AUMID>` — the value behind the per-app "Show notification banners" checkbox, which the shell reads as each notification arrives. The global `NOC_GLOBAL_SETTING_TOASTS_ENABLED` is written too but does nothing on Windows 11 26200 (verified: set to 0, banners kept coming), so it is a bonus for builds that honour it, not the mechanism. Never `Enabled` or `PushNotifications\ToastEnabled` — those stop delivery, so the notification would never reach the notification centre and the notch would have nothing to announce either.

`notifications.rs` owns the whole mechanism and its own restore memo (`notification-banners.json` in app-data, not `settings.json`: it is a record of changes made outside the app, sized to the user's installed software). Muting sweeps every registered app; an app that registers later silences itself at the first notification it raises (`mute_app_on_sight`, off the poll), one banner late. An app already at `0` is left out of the memo, so a user who had turned that app's banner off themselves keeps it off. Four guards: refused unless notch notifications are on *and* `UserNotificationListener` access is granted; turning notch notifications off un-mutes; revoked access un-mutes on the next apply; and `settings::shutdown` (hooked to `RunEvent::Exit`, which is why `lib.rs` calls `.build().run(…)` rather than `.run()`) hands every banner back on the way out — a muted shell plus a notch that is not running is a machine with no notifications at all.

**Preferences go through `settings.rs`.** Stored as a flat `settings.json` in the app-data dir, same shape as `notes.rs`; the running app answers from `settings::Current`, an in-memory copy seeded at startup. `settings::apply` is the single place that maps a preference onto window state and runs at startup, on every change, and on every appearance, so nothing can be honoured live but lost on relaunch. Fields need `#[serde(default = ...)]` or the first launch after a new preference ships fails the parse and resets the rest. A default that mirrors a value in `tauri.conf.json` (`alwaysOnTop`) has to agree with it — the window is built from the config and only corrected afterwards.

Every accepted change is broadcast as a `settings-changed` event. No window is ever rebuilt, so a preference set in Settings would otherwise not reach the notch — which reads the same `useSettings` hook — until the next relaunch. Frontend consumers whose behaviour is *visible* must gate on that hook's `loaded` flag: `DEFAULTS` is a guess, and acting on it puts a pill on screen that gets snatched back a frame later for everyone who had the preference off.

**Always-on-top means two things.** Above other windows *while idle* **and** resting on screen — one switch, a z-order half owned by Rust and a visibility half owned by `useNotchState`'s floor. The name is the user's, so both halves live behind it.

The z-order half is not one call, and it does not track the preference alone — it tracks **whether the notch is on screen**. `notch_raise` promotes unconditionally and `notch_settle` returns the window to the band the preference selects; they only make sense as a pair. A card the user reached for and cannot see is a broken notch however the switch is set, and with the preference off the window sits below every focused window, so the notch would expand behind whatever app is in front. `useNotchState` raises on two rising edges — the notch growing (`STATE_RANK` increases) and the cursor arriving (`inside`) — and settles when it shrinks back to `hidden`. Growth rather than leaving `hidden`, because a notch whose pill rests on screen leaves `hidden` exactly once, at startup, and a band lost hours later would never be reclaimed; the cursor edge because a pill already resting at `peek` has no growth to key on.

`apply_topmost` sets `false` before `true` on purpose: tao's `apply_diff` returns early when the requested `ALWAYS_ON_TOP` matches its cached flag, so re-asserting "on" on a window it already thinks is on top emits no `SetWindowPos` at all — even after a fullscreen app has pushed it out of the topmost band behind tao's back. Collapsing any of this back into a plain `set_always_on_top`, or into a raise that reads the preference, reintroduces "always on top stops working" / "the notch doesn't show over my apps".

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
