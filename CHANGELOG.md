## 0.7.2 — 2026-08-28

**A packaging release — like 0.7.1, nothing inside the app has changed.** If you
installed Crest from GitHub, this version behaves exactly as 0.7.1 did. Every
panel, preference, animation and keystroke is untouched, and the update that is
about to install itself quietly is one you will not be able to see afterwards.

What it adds is a second way to *distribute* Crest: a Microsoft Store package,
built from the same source and stamped with the same version as the installer.
The two are one binary in two wrappers, so most of the work was teaching Crest to
notice which wrapper it is running inside and use the right mechanism for it.

### New

- **A Microsoft Store package.** Built off the same `tauri.conf.json` version the
  installer uses, so the two distribution paths can never drift into describing
  themselves as different releases. The Store listing is not live yet — this is
  the build path being finished, not an announcement
- **Crest asks Windows how it was installed rather than being told when it is
  built.** A compile-time flag would decide this at build time, so a release built
  with the wrong one would be a Crest that either never starts with Windows or
  writes a startup entry that outlives its own uninstall — both of which look fine
  until someone logs in. Asked at runtime, it cannot be got wrong by a build
- **A privacy policy at [crest-beta.vercel.app/privacy](https://crest-beta.vercel.app/privacy).**
  A plain account of what Crest touches, what it keeps on your machine, and the
  only two services it ever talks to — Open-Meteo for the forecast of a place you
  typed in yourself, and GitHub to see whether there is a newer version. There is
  no third one, and the source is there to check it against

### Improved

- **Starting with Windows uses the mechanism each build is supposed to use.** The
  installer keeps the scheduled task it has always used, because Explorer's own
  startup queue runs ten deep on a normal machine and put Crest on screen minutes
  after login. A packaged build uses the startup task its manifest declares, which
  is the one Windows expects and the one the Startup tab in Task Manager can
  switch off
- **The Store build leaves updating to the Store.** Crest updates itself silently,
  and what it downloads is an installer — which cannot service a packaged app, and
  would at best leave a second Crest on the machine, the two of them suppressing
  each other at boot while the Store still reported everything up to date. So a
  packaged build does not check, does not install, and drops the tray's update row
  rather than offering an action that cannot succeed. **Nothing changes for the
  installer**, which still checks shortly after launch and every six hours, as it
  always has

### Fixed

- **The site's sitemap pointed at `localhost`.** It was built from an environment
  variable nobody had set on the host, so the live sitemap advertised
  `http://localhost:3000` for every page on it — including the privacy policy,
  which is the one URL that has to stay findable. It reads the real domain now,
  and only falls back to localhost where that is genuinely where it is running

## 0.7.1 — 2026-08-27

**A packaging release — nothing inside the app has changed.** Crest looks and
behaves exactly as it did in 0.7.0. What moved is the information Windows keeps
*about* Crest, which was wrong in a way you would only ever notice in the places
Windows shows it back to you.

### Fixed

- **Windows now knows who made Crest.** The installer and the app carry a proper
  publisher name and copyright line, so the entry in Add or remove programs and
  the Details tab of the file properties read `Lenny Dany Derek` rather than a
  fragment of the app's internal identifier. Nothing about how Crest runs depends
  on this — it is the label, not the thing
- **Two build dependencies carrying security advisories were updated.** Neither
  ships inside Crest — they are part of what builds it — so there is nothing to
  see here, and it is written down because a changelog that quietly omits
  security updates is not worth reading

## 0.7.0 — 2026-08-24

**A timer, and you can see it without opening anything.** The reason to set a
countdown is almost never that you want to watch it — it is that you want to stop
thinking about it — so the number goes where the temperature and the battery
already are: on the resting pill, and in the top strip of whatever panel you have
open. Set it by typing the digits the way you would on a phone, or take one of the
four presets. When it lands the notch drops a banner and plays a short chime, and
if you happen to be reading a panel at that moment the card flashes instead, so
nothing interrupts what you were doing to tell you something you already asked to
be told.

### New

- **The Timer panel.** Click the readout and type — digits fill from the right,
  phone-timer style, so 5-3-0 is five minutes thirty. Four presets sit under it —
  1m, 5m, 10m, 25m — and they *set* the time rather than starting it, because a
  mis-clicked preset that ran immediately would cost you the timer already going.
  Start, then Pause, Resume and Reset in the same band. It is the last panel in
  the ring and it appears on its own; hide it under Settings → Panels like any
  other
- **The countdown on the resting pill.** In the slot the temperature usually has,
  as a ring that empties beside the time remaining — under an hour it reads
  `4:37`, over one it reads `1h 05m`. It takes that slot from the music and the
  weather both, for as long as there is a timer: the track has a panel one arrow
  away and the temperature has not moved in ten minutes, while a countdown is the
  one readout whose whole value is being visible without being asked for
- **And in the strip of every panel you open.** Which is the half that matters
  more than it sounds — a panel being open is exactly when the pill is *not* on
  screen, so without it the countdown would vanish for as long as you were reading
  anything else
- **A banner and a chime when it lands.** The banner turns an hourglass over and
  says how long the timer ran; hovering it opens the panel, where the same
  duration is already loaded and one click from running again. The chime is two
  short notes, synthesised rather than a sound file — it is the only noise Crest
  makes
- **A switch for the chime**, under Settings → Settings → Timer. With it off the
  banner and the flash still happen, so you are still told, just not out loud
- **The card flashes when the banner cannot.** A banner is declined while you have
  a panel open or the cursor on the notch — i.e. exactly when you are looking — so
  the card pulses in your accent colour three times instead. It touches nothing
  but colour: the panel does not resize under a cursor that is about to click
- **A paused timer stays on the pill.** Paused is a state you can forget you are
  in, and a countdown that disappeared when you paused it is one you find at nine
  minutes left the next morning

### Improved

- **A timer survives a restart.** It is stored as the instant it ends rather than
  as a number of minutes left, so nothing is lost to an update installing itself
  — which Crest does silently, and a pomodoro dying to one would be the app losing
  something you were relying on
- **One timer, on every screen.** With the notch mirrored across displays it is
  the same countdown on each rather than a private one per monitor, and only the
  lead notch chimes

### Fixed

- **A Crest run from source no longer replaces itself with the released build.**
  Updates install quietly by design, so a development build sitting behind the
  current release would download it, install over the top and restart — into the
  shipped app, with no dialog and no error. Only an installed Crest updates itself
  unasked now; the tray's own update row still works everywhere, because that is
  someone asking
- **`npm run dev` mounts again in a plain browser.** Reading the window label
  threw where there is no Tauri to ask, which left an empty page and one console
  error — and that fallback is how the notch's layout and animation are worked on
  without a Rust rebuild

## 0.6.9 — 2026-08-18

**The notch stops taking your work away.** Writing a task into the calendar or a
note into the shelf meant holding the mouse perfectly still: drift a few pixels
off the card and the notch collapsed, taking the half-written sentence with it.
It stays open while there is a caret in it now, and if it does close — you clicked
into something else, you walked away — whatever you had typed is still there when
you come back. Dragging a screenshot out no longer leaves the notch sitting on a
panel you never asked for, and the temperature and the battery have been redrawn
so they finally look like two of the same thing.

### Fixed

- **Typing no longer collapses the notch.** A caret in a field holds it open for
  as long as you are typing, plus fifteen seconds after the last keystroke, so
  the pointer can sit wherever you left it. Moving the mouse back, clicking into
  another app or simply stopping all hand it back to the usual collapse
- **Your half-written task survives a collapse anyway.** If the notch does close
  under a draft, the text is waiting in the field the next time you open it — and
  so are the day and the time it was for, which matters more than the words: a
  task restored onto a calendar that had snapped back to today would have been
  filed on the wrong day without saying so
- **Notes reopen on the note you were writing in.** They always reopened on the
  first one, so anyone typing into their third note came back to a different
  note's contents and read their own words as gone. They were never gone — they
  were simply not the note on screen
- **Dragging a screenshot out no longer sends the notch to the File Shelf.** The
  notch is the first thing your cursor crosses on the way out of it, which Crest
  was reading as a file arriving rather than as one leaving — so a moment after
  you dropped the image into another app, the panel changed under you
- **And the shelf stops inviting a drop that already finished.** "Drop files
  here" lit up at the start of that drag and had nothing to switch it off again,
  because the file was released in another application entirely. It stayed lit
  for the rest of the session
- **A banner no longer moves you off the panel you had open.** Music starting or
  a screenshot landing points its banner at the panel behind it, so hovering the
  banner opens the right thing — but when the banner retracted untouched it left
  your selection where it had put it. It puts it back now

### Improved

- **The battery and the temperature are one design.** They sit opposite each
  other on the resting pill and in the top strip of every panel, and in the strip
  they were a filled tag on one side and a bare outline on the other. Both are
  tags now, in both places, and the battery is drawn as line work to match the
  weather beside it — an outlined shell with a slim bar of colour inside rather
  than a solid block. It still reads at a glance, still turns red when you are
  low, and still carries the bolt when it is charging
- **The panel name reads as a title, not a heading.** `MEDIA CONTROLS` in wide
  tracked capitals was the loudest thing on the strip, shouting the name of the
  panel you were already looking at over the panel itself. It is sentence case
  now, which is quieter and fits more of a long name before it has to trim
- **The clock leads the resting pill.** It was set at nearly the same size as the
  two readouts flanking it, so the pill was three things of equal weight with
  nothing saying which one you came for

## 0.6.8 — 2026-08-18

**The temperature, without opening anything.** The weather panel was always a
hover and a scroll away, which is more than anyone is going to do to answer "do I
need a coat". The temperature now sits on the notch itself — on the resting pill
beside the clock, and in the top strip of every panel you open — in whichever
accent colour you picked. Set a location once under Settings → Weather and it is
there; the full week is still on its own panel when you want it.

### New

- **The temperature on the resting pill.** Beside the clock, opposite the
  battery, with the sky it belongs to drawn next to it — sun, cloud, rain, snow,
  fog or a thunderstorm. It needs a location, which you set under
  Settings → Weather; Crest still never guesses where you are, and shows nothing
  here until you have told it
- **And on every panel you open.** The same reading in the top strip of the media
  card, the launcher, the shelf and the rest, so it stays in view once you are
  inside the notch instead of disappearing the moment you open something
- **In your accent colour.** The glyph, the number and the wash behind them all
  follow the accent and theme set in Appearance — with rain and snow a shade
  brighter than the cloud behind them, so wet still reads differently from dry at
  a glance

### Improved

- **Music takes the pill's left slot while it is playing.** The equalizer and the
  temperature share one spot rather than crowding into two: whatever is playing
  wins it for as long as it plays, and the temperature comes back when it stops.
  Music is the only thing on that pill that changes by itself, and it is easier
  to catch out of the corner of your eye with nothing sitting beside it — the
  weather is one hover away on its own panel in the meantime

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
