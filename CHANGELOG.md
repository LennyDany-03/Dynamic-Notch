## 0.6.0 — 2026-08-14

**Three new panels, and the notch is yours to arrange.** Crest can now show you
what your machine is doing, what the weather is, and what is on today — and you
decide which of the seven panels you actually want and what order they sit in.
Pick the colour it is all drawn in while you are there. Updates install
themselves quietly in the background, and Crest starts with Windows in seconds
rather than minutes.

### New

- **System monitor** — CPU, memory, GPU and disk as live meters, with the
  temperature where your firmware reports one. Crest speaks up when something has
  been pinned at the top of its range long enough to mean it — not for the spike
  when an app launches, but for the machine that has been struggling for a while.
  Sleep, restart and shut down are on the same panel, each one asking for a second
  click before it does anything
- **Weather** — the temperature now, what it feels like, humidity, wind and the
  chance of rain, with the rest of the week beside it. Pick your town in Settings;
  Crest does not go looking for where you are, and the forecast comes from
  Open-Meteo, which needs no account
- **Calendar and reminders** — a month at a glance with a dot on every day that
  has something on it, and the day you have picked listed beside it. Add a
  reminder with a time and the notch tells you when it comes round, including one
  that fell due while your laptop was asleep
- **Choose your panels** — a new Panels page in Settings. Switch off the ones you
  do not use and drag the rest into the order you want. The arrows, the counter
  and the tray menu all follow
- **Accent colour** — eight colours, or type your own. Everything active is drawn
  in it: the scrub bar, the switches, a connected device, today's date. The notch,
  the tray menu and Settings all change at once
- **Read your notes anywhere** — a Notes page in Settings showing everything you
  have jotted down, as text, alongside the folder they are saved in
- **Updates that install themselves** — Crest checks shortly after it starts and
  again through the day. If there is something new it downloads and installs it on
  its own, showing a small loader in the notch. No installer window, no prompts,
  no wizard

### Improved

- **The file shelf and notes panel has been rebuilt.** Files wrap onto a second
  row instead of scrolling off the side, each one carries its type, and removing
  one is a button rather than a right-click you had to know about. Notes gained a
  switcher, so every note past the first is reachable — and a button that gives
  the note the whole card when you need the room
- **Settings is six pages now** — About, Panels, Appearance, Weather, Notes and
  Settings — rather than one long scroll with everything at the bottom of it
- **The music mark on the resting pill only appears while something is playing.**
  It used to sit there dimmed all day, which meant you stopped noticing it moved
- Updates no longer put Windows' installer on your screen while they apply

### Fixed

- **Crest starts with Windows in seconds rather than minutes.** It was queuing
  behind everything else set to launch at sign-in — on a machine with Docker,
  Steam and a couple of game launchers ahead of it, that meant waiting five
  minutes for the notch to appear. It now starts alongside them instead of after
  them, and no longer refuses to start at all when you are on battery
- **"Start with Windows" stays off when you turn it off.** It was being switched
  back on every time Crest launched, so the setting only lasted until your next
  reboot
- **"Show me where it is" no longer flickers on and off.** With "Always on top"
  switched on, the resting pill already sits exactly where that mark would go, so
  the setting had nothing to show and would flash for a moment at every launch.
  It now says so instead of appearing broken

## 0.5.0 — 2026-08-11

**Crest keeps an eye on your machine.** Plug the charger in and the notch drops
down to say so, with the charge you have left. Connect your headphones and it
names them. Move to another network and it tells you which one. And the battery
now lives on the notch itself, so what you have left is a glance up rather than a
trip to the tray.

### New

- **Charger alerts** — the moment a charger goes in or comes out, the notch says
  which, with the percentage and how much longer Windows expects the battery to
  last. The plug slides into place as it arrives, and is pulled back out when it
  goes
- **Bluetooth alerts** — a device connecting or dropping is announced by name,
  and drawn as the thing it is: headphones, a phone, a watch, a mouse, a laptop
- **Wi-Fi and network alerts** — connecting, moving to another network, or losing
  the connection altogether. Wi-Fi carries the network's name and as many bars as
  the signal is worth
- **The charge, always in view** — a battery and its percentage on the resting
  pill and in the top strip of every panel. It turns purple with a bolt while
  charging, and red once you are at a fifth or below
- **Charger, Bluetooth and Wi-Fi** — one setting, under a new "Your machine"
  group, for whether any of that is announced. Windows grants no permission for
  this and none is asked for: all three are things your tray already shows

Alerts are quiet by design. Something *going away* has to still be gone a moment
later before Crest mentions it, so a Wi-Fi blip or a headset switching between
its call and music modes no longer produces a "disconnected" banner chased by a
"connected" one. Waking your laptop shows one banner rather than one for every
change that piled up while it slept. And nothing drops down while your cursor is
already on the notch, or while a panel is open — you are looking at it already.

### Improved

- The resting pill is wider and laid out again from scratch. The clock sits dead
  centre with the music mark and the battery in matching chips either side,
  instead of the three crowding each other for the same 200 pixels

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
