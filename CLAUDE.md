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

**Three windows share one bundle.** `main.tsx` switches on `getCurrentWindow().label` and mounts `TrayMenu` for `tray-menu`, `SettingsWindow` for `settings`, and `App` for everything else (the default arm also covers the browser fallback, which has no label). The tray carries no native menu at all — a Win32 menu can't be Mica-styled — so `tray.rs` positions and shows a pre-built borderless window instead. Settings is likewise built at startup and only hidden, so `lib.rs` intercepts its `CloseRequested` to hide rather than destroy the webview. Each window has its own capability file in `src-tauri/capabilities/`; adding a `@tauri-apps/api` call usually means adding a permission there.

**Preferences go through `settings.rs`.** Stored as a flat `settings.json` in the app-data dir, same shape as `notes.rs`; the running app answers from `settings::Current`, an in-memory copy seeded at startup. `settings::apply` is the single place that maps a preference onto window state and runs at startup, on every change, and on every appearance, so nothing can be honoured live but lost on relaunch. Fields need `#[serde(default = ...)]` or the first launch after a new preference ships fails the parse and resets the rest. A default that mirrors a value in `tauri.conf.json` (`alwaysOnTop`) has to agree with it — the window is built from the config and only corrected afterwards.

Every accepted change is broadcast as a `settings-changed` event. No window is ever rebuilt, so a preference set in Settings would otherwise not reach the notch — which reads the same `useSettings` hook — until the next relaunch. Frontend consumers whose behaviour is *visible* must gate on that hook's `loaded` flag: `DEFAULTS` is a guess, and acting on it puts a pill on screen that gets snatched back a frame later for everyone who had the preference off.

**Always-on-top means two things.** Above other windows *and* resting on screen — one switch, a z-order half owned by Rust and a visibility half owned by `useNotchState`'s floor. The name is the user's, so both halves live behind it.

The z-order half is not one call. `apply` sets `false` before `true` on purpose: tao's `apply_diff` returns early when the requested `ALWAYS_ON_TOP` matches its cached flag, so re-asserting "on" on a window it already thinks is on top emits no `SetWindowPos` at all — even after a fullscreen app has pushed it out of the topmost band behind tao's back. And because the overlay never takes focus, being in that band once is not staying at the top of it, so `useNotchState` calls `notch_raise` every time the notch *grows* (`STATE_RANK` increases). Keyed on growth rather than on leaving `hidden`, because a notch whose pill rests on screen leaves `hidden` exactly once — at startup — and a band lost hours later would never be reclaimed. `notch_raise` applies whichever band the preference selects; it is a request to match the setting, not to rise. Collapsing any of this back into a plain `set_always_on_top` reintroduces "always on top stops working".

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
