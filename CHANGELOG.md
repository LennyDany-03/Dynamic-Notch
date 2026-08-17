## 0.6.7 — 2026-08-17

**The screenshot you just took, already in your hand.** Take a screenshot and the
usual next move is to go and find it — open the folder, sort by date, hope it is
the top one. Crest watches the folders Windows saves them to, drops the
thumbnail down the moment one lands, and keeps the last two dozen on a card you
can drag straight into whatever you needed it for. There is a keyboard shortcut
to summon the notch now, too, and a set of controls for how big it is, how round
its corners are and how fast it moves — the notch can be your size rather than
the one it shipped at.

### New

- **A Screenshots panel.** The last two dozen captures, newest first, from the
  folders Windows already puts them in — `Pictures\Screenshots` and
  `Videos\Captures`, wherever OneDrive has moved them to. Drag one into another
  app, click to open it, right-click to show it in its folder. Crest only reads
  them: nothing is copied, moved or deleted, so the panel simply rolls forward as
  you take more
- **The capture drops down as you take it.** A thumbnail on the banner, so you
  know it worked without leaving what you were doing — and hovering it opens the
  panel, which is usually one drag away from being finished with it
- **A keyboard shortcut that summons the notch.** Set it in Appearance: click the
  box, press the keys. It opens the notch wherever you are and closes it again if
  it is already open — the one way in that does not involve the mouse. It needs
  Ctrl, Alt, Shift or Win with it, because a shortcut without one would take that
  key away from every text field on your PC
- **The notch can be your size.** Four new sliders under Appearance → Shape: the
  resting pill's width and height, the corner radius of every surface Crest
  draws, and the width of the expanded panels. Nothing here resizes a window or
  moves a panel's contents around — it is the same notch, drawn at the size you
  want it
- **And your speed.** Animation speed, from half to double, and how long the
  notch waits after your cursor leaves before it collapses — the one number
  people ask for in both directions

### Improved

- **The background opacity slider does something now.** It stopped at 60%, and
  60% over a dark desktop is a change of less than half a shade out of 255 — the
  control had no visible range at all on the machines this app actually runs on.
  It goes down to 25% now, where the notch is still a legible card (the text,
  tiles and edges never fade) on a much fainter wash
- **The settings window itself is always solid.** It was the only surface visibly
  responding to that slider, so dragging it appeared to adjust the window you
  were looking at rather than the notch it names — and it is the one window in
  Crest made of paragraphs, which is the exact thing a wallpaper showing through
  makes harder to read

## 0.6.6 — 2026-08-17

**Where your sound goes, without going looking for it.** Moving from your
speakers to your headset is four clicks deep in a flyout that closes if you look
at it wrong, and the microphone is somewhere else entirely. There is a Quick
Access panel now: your speakers and your microphone, one row each, showing what
Windows is actually using — click one, pick another, done. Notifications learned
a few manners in the same release, and can now be copied, put off for five
minutes, or opened if there was a link in them.

### New

- **A Quick Access panel — your speakers and your microphone.** Each row shows
  the device Windows is really using right now, not a setting of Crest's, so it
  stays right when you change it from anywhere else. Click a row for everything
  else that is plugged in, and pick one. Switching moves your calls too, rather
  than leaving voice chat on the device you just left
- **Plug something in while the panel is open and it appears.** The list is live —
  a headset waking up, a monitor's speakers arriving with the cable — so you are
  never choosing from a list that was true a minute ago
- **Notifications you can do something with.** Open one in the notch and there
  are three buttons under it: **Copy** takes the whole message, **Snooze 5m**
  puts it away and brings it back in five minutes, and **Open link** appears when
  there is a link in the message and opens it in your browser. Snoozing only
  hides it from Crest — it stays exactly where it is in Windows' own notification
  centre the whole time, so nothing can be lost this way

### Fixed

- **The notification buttons no longer move under your cursor.** Which buttons a
  message had depended on whether it contained a link, and the row reflowed around
  that — so Dismiss sat somewhere slightly different from one notification to the
  next
- **A link at the end of a sentence opens the link.** The full stop after it was
  being taken as part of the address, which reliably opened a page that wasn't
  there

## 0.6.5 — 2026-08-14

**Crest knows about your other screens.** Until now the notch lived on the main
display and nowhere else, which is fine right up until the monitor you actually
work on is the one to the left. There is a Display page in Settings now: it shows
the screens you have, laid out the way they sit on your desk, and lets you send
the notch to whichever one you want — or put one on every screen and stop
choosing. Unplug a monitor and the notch comes home on its own. Elsewhere, the
panels answer to a scroll, and the calendar has room for what you typed into it.

### New

- **A Display page in Settings.** Your screens are drawn the way they are
  arranged, at the sizes they really are, numbered to match Windows' own display
  settings — so the one you want is the one you can point at. The mark on a
  screen's top edge is the notch itself; click a screen to send it there
- **Put the notch on every display.** One switch, and each screen gets its own —
  same panels, same banners — so it is always on the monitor you are looking at.
  They come and go with the screens themselves, with nothing to set up
- **Unplug a monitor and the notch comes home.** If the screen you sent it to
  isn't there, it moves to your main display until that screen is back. You never
  have to pick it again: Crest remembers where you wanted it and puts it back the
  moment the cable is in, which is the difference between docking a laptop and
  reconfiguring one
- **Scroll over an open panel to move between panels**, alongside the arrows at
  the top. Your notifications and your reminders still scroll on their own, and
  reading to the bottom of one does not tip you into the next panel

### Improved

- **The calendar has room for what you actually typed.** At its old width the
  month took more than half the card and a reminder's title was left about eleven
  characters a line, so anything with a real name in it broke mid-word. The card
  is wider, and the time a reminder is due now sits under its title rather than
  squeezing it — which also means it is always shown, instead of appearing only
  for something due in the next day
- **The panel's name sits in the middle of the strip at the top of each card.**
  The "2 of 7" counter beside it is gone: the arrows already say there is more
  than one panel, nobody navigates by which numbered slot a card is in, and it was
  pushing the name off centre to say so
- **The battery is sized to the surface it's drawn on** — full size on the resting
  pill, where there is room to read it properly, and a step down in the strip at
  the top of each panel, where 0.6.2's larger badge had started competing with the
  panel name instead of sitting quietly in the corner

## 0.6.2 — 2026-08-14

**A charge you can actually read.** The battery on the resting pill and in the
top strip of every panel was the smallest thing Crest drew — a bar a few pixels
long, and a number set below every other piece of type on screen. It is bigger
now, and the part of the battery you have already used is drawn in behind it, so
what is left is a shape you can take in rather than a mark you have to measure.

### Improved

- **The battery is drawn about a fifth larger**, with its percentage set to match
  the rest of the notch instead of a size below it
- **The empty part of the battery is drawn in.** At a third full you are now
  reading a gauge, rather than a short grey mark with nothing behind it to read
  it against
- The resting pill has been rebalanced around the bigger badge, so the clock
  still sits dead centre and neither chip is crowded

### Fixed

- **Crest starts with Windows again after being moved or reinstalled.** If the
  startup entry was left pointing at a copy of Crest that is no longer there, it
  would quietly do nothing at sign-in. Crest now points startup back at itself
  the next time it runs
- **Nothing but an installed copy of Crest can put itself in your startup.** On a
  machine that had ever run Crest from its source, sign-in opened a console
  window and a page reading "localhost refused to connect" instead of the notch —
  and installing Crest properly did not clear it

## 0.6.1 — 2026-08-14

**Crest comes in five looks now.** Until now there was one — near-black with a
violet accent — and the only thing you could change about it was that accent.
There is a Theme page in Settings with five palettes on it, including the first
light one, and picking one repaints the notch, the tray menu and Settings
together.

### New

- **Five themes**, on a new Theme page in Settings. **Crest** is the near-black
  and violet the app has always been, and stays the one you get out of the box.
  **Glacier** is cool slate and ice, quiet and technical. **Ember** is warm black
  and amber, closer to lamplight than to a screen. **Daylight** is the first light
  theme, for a bright desktop and a light taskbar. **Mono** has no colour in it at
  all — what is active is simply brighter
- **Every theme brings its own accent**, so choosing a look is one decision rather
  than two. If you want a different colour on top of the theme you picked, the
  accent picker under Appearance still does exactly what it did — set one and it
  stays until you change theme again
- **The Theme page shows you what you are choosing.** Each entry draws a small
  notch in that theme's own colours, with its palette laid out underneath, so the
  difference between two of them is something you can see rather than guess at

### Improved

- **Everything Crest draws follows the theme**, down to the hairlines between
  rows, the dashed outline on the file shelf, the well behind a search field and
  the shadow under a sheet. Nothing is left painted for the dark theme it was
  drawn in
- **A warning still reads as a warning in every theme.** The load meters shift
  their amber and red so they stay legible against a light surface, and so the
  caution step does not end up sitting next to Ember's amber accent saying
  something different. Mono keeps them coloured for the same reason — a grey
  warning is not a quieter warning, it is no warning at all

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
