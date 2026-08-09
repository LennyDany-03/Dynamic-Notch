## 0.4.1 — 2026-08-09

**"Always on top" is honoured from the moment Crest starts.** Turn it off, and
the notch stays out of the way on the next launch too.

### Fixed

- With "Always on top" switched off, the notch no longer came up resting on
  screen and in front of your windows anyway, and stayed there until you opened
  Settings. It could read the setting before Crest had finished loading it and
  fall back to the default — which is on — for the rest of the session
- Opening Settings now brings every window back in step with your saved
  preferences, rather than only the ones you change while it is open

## 0.4.0 — 2026-08-09

**Your notifications come to the notch.** Anything Windows would have popped in
the corner drops down from the top of your screen instead, carrying the app's own
icon — and if you want, Windows stops drawing its banners at all. Music does the
same: start a track and the notch tells you what is playing, then gets out of the
way.

### New

- **Notifications in the notch** — an arriving notification drops down for a few
  seconds and leaves on its own. Hover it to hold it there while you read.
  Windows needs "Let apps access your notifications" turned on for this
- **A notifications page** — a fourth panel listing what is in your notification
  centre. Open one to read it in full, dismiss it, or clear the lot
- **Mute Windows' own banners** — a setting that stops the pop-up in the
  bottom-right corner, so a notification appears in the notch and nowhere else.
  It still lands in the notification centre, and Windows gets its banners back
  the moment you turn this off or quit Crest
- **Now playing** — starting a track, skipping to another, or resuming drops the
  now-playing banner in for a few seconds. Hover it to keep it, and keep hovering
  to open the full player
- **Where the notch sits** — put it at the left, centre, or right of your top edge
- **Background opacity** — a slider for how much of what is behind the notch
  shows through it
- **A mark showing where the notch is** — a small strip on the top edge while the
  notch is hidden, so a new install can answer "where do I point?". Can be turned
  off once you know
- **Pin an app from a picker** — the empty launcher slot now opens a list of
  everything installed, instead of asking you to search for a name you already
  have to know

### Improved

- Settings has been rebuilt around a sidebar: "About this app" and "Settings" are
  separate pages now, so the switches are not at the bottom of the pitch
- The tray menu sizes itself to what is in it

### Fixed

- The scrub bar no longer jumps back to an older position while a track plays —
  Crest now accounts for how long ago the player last reported where it was,
  rather than trusting a number that can be seconds stale

## 0.3.1 — 2026-08-08

**The notch opens where you can see it.** However "Always on top" is set, a card
you reach for now comes up in front of whatever you are working in — and with
the preference off it drops back out of the way as soon as it closes.

### Fixed

- The notch no longer opens behind a maximised or full-screen window when
  "Always on top" is switched off
- With "Always on top" off, the overlay no longer stays in front once the notch
  has closed — it settles back behind your windows, so games and video can still
  go properly full-screen

## 0.3.0 — 2026-08-08

**Crest can stay on screen now.** A new Settings window lets you keep the notch
pinned above everything else instead of hiding when you move the cursor away.

### New

- **Settings window** — open it from the tray menu to change how Crest behaves
- **Always on top** — the pill rests on screen and stays above other windows,
  including full-screen apps

### Fixed

- Crest no longer slips behind other windows after a game or video goes
  full-screen — it re-asserts its position every time the notch opens
