# Changelog

Release notes for Crest. The release workflow reads the section matching the tag
it was given — tagging `v0.3.0` publishes the `## 0.3.0` section below, verbatim.

**Write the section before you tag.** A tag with no matching section fails the
build on purpose, so a release can never go out with empty notes.

## 0.2.0 — 2026-08-06

**Crest can now update itself.** This is the last version you'll need to install
by hand — from here on, new versions arrive through **tray icon → Check for updates**.

### New

- **In-app updater** — check, download and install new versions from the tray menu
- **Tray menu** — a custom Mica popup in place of the native Windows one
- **Quick Notes** — jot notes in the notch, saved as you type
- **Quick Launcher** — search and launch installed apps, with real app icons
- **File Shelf** — drag files in, drag them back out into any app
- **Clipboard history** — with password-manager exclusion
- **Clock** in the collapsed pill
- **Right-click menu** on the notch

### Fixed

- Notch opens faster — dwell time cut from 1.5s to 800ms
- Smoother panel transitions
- Quick Launcher no longer comes up empty

### Install

Download `Crest_0.2.0_x64-setup.exe` below and run it.

Windows SmartScreen will warn that the publisher is unknown — the app isn't
code-signed yet. Click **More info → Run anyway**.

## 0.1.0

Initial public release.
