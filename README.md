<div align="center">

<img src="src-tauri/icons/icon.png" width="120" alt="Crest Logo" />

# Crest

**A Dynamic Notch experience for Windows**

*Live music · Notifications · Calendar · 4 Themes*

[![Release](https://img.shields.io/github/v/release/LennyDany-03/Dynamic-Notch?style=flat-square&color=0ea5e9)](https://github.com/LennyDany-03/Dynamic-Notch/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue?style=flat-square)](https://github.com/LennyDany-03/Dynamic-Notch/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-FFC131?style=flat-square)](https://tauri.app)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

---

## Demo

<a href="https://youtu.be/FET55w-s7z0">
  <img src="https://img.youtube.com/vi/FET55w-s7z0/maxresdefault.jpg" alt="Crest Demo" width="100%" />
</a>

---

</div>

## What is Crest?

Crest brings a macOS-style dynamic notch to Windows. It sits invisibly at the top-center of your screen and expands on hover — showing your currently playing music, live notifications, and a full calendar. It runs as a transparent, always-on-top overlay with zero taskbar presence.

---

## Themes

| Theme | Style |
|---|---|
| **Dynamic Island** | Apple iOS pill — spring physics animations |
| **Cyberpunk OS** | Neon HUD overlay — sci-fi aesthetic |
| **Glassmorphism** | Liquid frosted glass — aurora glow, animated bars |
| **Windows 11 Native** | Mica material — acrylic blur, Fluent design |

Switch between themes instantly from the settings gear — saved automatically.

---

## Features

- 🎵 **Live Music** — album art, track info, playback controls via Windows Media Session API
- 🔔 **Notifications** — reads live Windows notifications, badge count, toast pop-ups on new alerts
- 📅 **Calendar** — full monthly calendar with event dots and month navigation
- 🎨 **4 Themes** — each with a unique collapsed pill and expanded panel design
- 🚀 **Auto-start** — registers with Windows on first launch, starts automatically on login
- 🖱️ **System Tray** — right-click for quick navigation to Music / Notifications / Calendar
- 👻 **Transparent overlay** — zero visual footprint when collapsed, click-through when idle

---

## Installation

1. Download `Crest_0.1.0_x64-setup.exe` from [Releases](https://github.com/LennyDany-03/Dynamic-Notch/releases)
2. Run the installer
3. Crest starts automatically — look for the notch at the top-center of your screen
4. Hover over it to expand, move mouse away to collapse

**Requirements:** Windows 10 or Windows 11 (x64)

---

## Usage

| Action | Result |
|---|---|
| Hover top-center of screen | Expands the notch |
| Move mouse away | Collapses back to pill |
| Click collapsed pill | Opens music panel |
| Click ⚙ gear icon | Opens theme switcher |
| Right-click tray icon | Quick navigation menu |

---

## Build from Source

**Prerequisites:** [Rust](https://rustup.rs) · [Node.js 18+](https://nodejs.org) · [Tauri CLI v2](https://tauri.app/start/prerequisites/)

```bash
# Clone
git clone https://github.com/LennyDany-03/Dynamic-Notch.git
cd Dynamic-Notch

# Install dependencies
npm install

# Dev mode
npm run tauri dev

# Production build
npm run tauri build
```

Installers will be output to `src-tauri/target/release/bundle/`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri 2](https://tauri.app) |
| UI | React 19 + TypeScript |
| Animations | Framer Motion |
| Backend | Rust |
| Windows APIs | Windows Media Session, Windows Notifications |
| Auto-start | tauri-plugin-autostart |

---

## Project Structure

```
src/
├── components/
│   ├── AppleNotch.tsx       # Dynamic Island theme
│   ├── NotchWidget.tsx      # Cyberpunk theme
│   ├── GlassNotch.tsx       # Glassmorphism theme
│   └── Win11Notch.tsx       # Windows 11 theme
├── hooks/
│   ├── useMediaSession.ts   # Music playback state
│   └── useHotzone.ts        # Hover detection
├── tokens.ts                # Design system tokens
└── App.tsx                  # Root + theme switcher

src-tauri/src/
├── media.rs                 # Windows Media Session API
├── notifications.rs         # Windows notification API
└── lib.rs                   # Tauri setup, tray, autostart
```

---

## Contributing

Pull requests are welcome. For major changes please open an issue first.

---

<div align="center">

Made with ❤️ by [LennyDany-03](https://github.com/LennyDany-03)

</div>
