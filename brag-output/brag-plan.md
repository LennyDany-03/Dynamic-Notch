# Brag Plan: Crest

## What is this app?

Crest hides a Mica-glass notch at the top edge of a Windows desktop: nudge it and
your music, apps, files, notes, notifications, system load, weather and calendar
slide down as one card that morphs to fit each one — then you move away and the
desktop is yours again.

## The angle

Every other desktop utility answers "where do I put it?" with another taskbar
icon, another window, another shortcut to memorise. Crest answers it with a strip
of screen you already move your cursor across a hundred times a day, and the rest
of the time it is not there at all.

So the video is built around **absence and arrival**. It opens on an empty top
edge, spends its middle on one card genuinely changing shape three times, and
ends by taking the whole thing away again. The product's own pitch — *invisible
when idle* — is only credible if the video is willing to show the screen with
nothing on it, twice.

This is not a joke project, so it does not get a joke video. Restraint is the
angle.

## Hook (first 2-3 seconds)

A dark Windows desktop with a violet aurora and nothing at the top of it but an
80×4 hairline mark. An oversized cursor is already travelling upward toward that
mark. The one line on screen is the site's own section heading, verbatim:

> No shortcut to learn.

The hook is the emptiness plus the movement: something is about to happen at a
part of the screen nobody uses.

## Key moments (the middle)

- **The 600ms dwell.** The 264×34 pill drops from the edge — equalizer chip left,
  clock dead centre, battery chip right at 68% charging with its accent wash — and
  sits there. A slim accent arc completes around the cursor over exactly 600ms.
  This is the app's actual contract: crossing the edge does nothing, dwelling opens it.
- **The card genuinely resizing.** Media controls at 380×164 → System monitor at
  380×266 → Calendar at 480×286. Real dimensions from `product/src/tokens.ts`, real
  panel names from the nav strip, real sample content (Midnight City / M83, scrub
  at 1:42 of 4:03; CPU 81% / Memory 64% / GPU 23% / Disk 7% / 52°C; August 2026
  with Friday 14 August's three reminders). The width and the height both change.
  Nothing cross-fades between fixed frames — the card is one object changing shape.
- **The step-down.** Cursor leaves, card → pill → nothing, and the top edge is
  empty again with the hairline mark back where it started.

## Outro / punchline

The Crest mark, the name, and the site's tagline verbatim: *The dynamic notch,
built for Windows.* Then one small line of fact — free, native, open source,
Windows 10 & 11 — and out. No CTA voice, no "download now" shout.

## User flow worth showing

Entry → key action → result, and it is the whole video:

1. Cursor arrives at the top edge → the pill peeks.
2. 600ms of dwell → the card opens on Media controls.
3. Chevron / scroll steps the ring → the card morphs to System monitor, then to
   Calendar → cursor leaves → it steps back down to nothing.

## Tone

- Preset: `polished`
- Creative direction: a quiet Windows product film — the notch does the talking
- Interpretation: five scenes but only five *lines* of copy, all of them short and
  all of them the project's own words. Soft crossfades, no hard cuts, no zooms.
  The longest holds go to the card doing something, not to text. Nothing shouts,
  because the product's whole claim is that it does not.

## Format: landscape — 1920x1080
## Duration: 22.4 seconds

## Visual identity (from the project)

- Background: `#07070b` (site `--background`); the in-video "desktop" is the
  hero demo's wallpaper, `radial-gradient(120% 90% at 50% 0%, #2a1a52 0%, #150f2c 42%, #0a0a12 100%)`
- Accent: `#7c3aed`, bright `#a855f7`, plus the icon field indigo `#1b00b5` for depth washes only
- Text: `#ededf2`, muted `rgba(237,237,242,.62)`, faint `rgba(237,237,242,.42)`
- Display font: Geist Sans (site `--font-geist-sans`); fall back to Inter, then
  Segoe UI Variable / system sans — the site's own fallback chain
- Body font: same family; Geist Mono for the clipboard/step numerals if used
- Strongest visual element: the `.mica` recipe from `app/globals.css` —
  `rgba(32,32,32,.8)` + `blur(40px) saturate(1.2)` + a 1px `rgba(255,255,255,.1)`
  top-only hairline + the SVG fractal-noise overlay at 5% overlay-blend. Every
  card and both chips are made of it. The `.notch-tile` inner surface is
  `rgba(255,255,255,.055)` with its own `.12` top hairline.

## Share copy (draft)

Crest: the dynamic notch, built for Windows. Nudge the top of your screen and
your music, files, notes, notifications, system load and calendar slide down —
move away and it's gone. Native Rust + Tauri, no account, MIT.

## Audio direction

- Role: cinematic support held low — a steady bed that makes the card's motion
  feel deliberate, never a soundtrack the viewer notices on its own
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (steady and clean,
  the polished/cinematic pick), from `0.00`, volume `0.30`
- Music treatment: 0.6s fade-in at the head; hold at 0.30 through the ring;
  duck to ~0.20 across the retreat so the empty screen reads as quiet; back to
  0.30 for the mark, then a 1.4s fade to zero over the final hold
- Music cue guidance: bundled preset read —
  `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.md`,
  109.96 BPM (~0.545s/beat). Three strong-cue locks: **8.74s (1.00 window peak,
  0.99)** for the card expanding, **18.56s (0.99)** for the Crest mark landing,
  **19.66s (0.96)** for the tagline. Beat-grid window for the sequential panel
  steps: 10.93s and 13.11s (four beats apart, ~2.18s per panel — deliberately not
  every beat, because each panel is content to read).
- Audio-reactive treatment: subtle. Music RMS may breathe the aurora wash behind
  the desktop and lift the card's outer glow a few percent. Nothing on the text,
  nothing on the card's geometry, and no waveform, bars, or particles — the card's
  size is information, so it must never move for a reason that is not the product.
- SFX posture: sparse. Five cues in 22 seconds, all under 0.75 volume.
- Audio-coupled moments: the cursor reaching the edge; the pill dropping; the card
  expanding (the payoff hit); each panel step; the mark landing.
- Restraint rule: no cue on the collapse louder than the cue on the expand, and
  nothing at all during the empty-screen beat in scene 4 — the silence is the
  point of that shot.

## Storyboard

### Scene 1 — Approach — 4.39s (0.00 → 4.39)

The desktop: the hero demo's violet radial wallpaper, the two blurred accent/indigo
wallpaper blobs, and the faint 64px grid floor masked to the top. The top edge
carries only the 80×4 accent hairline — the app's real `hotzoneHint`. An oversized
cursor enters low-right and glides up toward the mark, arriving at ~3.6s.
Lower third, settled by 1.5s and held: **"No shortcut to learn."** (site verbatim).
Sequential/interaction: yes — simulated cursor travel to the top edge; the hint
mark brightens as the cursor nears it.
Audio intent: the bed establishes; one very soft rollover as the cursor reaches
the mark, so arrival is felt rather than announced.
Audio-coupled idea: simulated cursor arrival → `ui/rollover1` at ~3.55s.
Music: steady, fading in over 0.6s.
Transition mood: soft (continuous — the desktop never cuts) → Scene 2

### Scene 2 — Peek — 4.35s (4.39 → 8.74)

The 264×34 Mica pill drops from the top edge on the beat at 4.39s. It is a
three-column grid: the equalizer chip (three accent bars, 0.9s loop, staggered
0/0.2/0.4s) left, the clock centred by construction, the battery chip right at
68% with the charging bolt and its `rgba(124,58,237,.16)` wash. A thin accent arc
draws around the cursor tip over exactly 600ms and completes at ~8.5s.
Copy replaces scene 1's line at ~5.3s: **"600ms of hover."**
Sequential/interaction: yes — pill drop, then the dwell arc filling in real time.
Audio intent: a soft placement, then quiet — the dwell should feel like waiting.
Audio-coupled idea: pill drop → `interface/drop_002` at 4.34s.
Music: steady, unchanged.
Transition mood: soft — no cut; the pill becomes the card → Scene 3

### Scene 3 — The ring — 6.55s (8.74 → 15.29)

**// beat-locked: 8.74s** — the card springs open from the pill to Media controls,
380×164: 64px art tile with its gradient and highlight, "Midnight City" / "M83",
the scrub at 42% between 1:42 and 4:03, and the transport row with the accent
play/pause circle. Above it the 26px nav strip appears: chevrons, the label
**MEDIA CONTROLS**, and the compact battery badge on the right.

**// beat-grid: 10.93s** — right chevron highlights; the card morphs to System
monitor, 380×266. Four meters (CPU 81% accent, Memory 64% with "10.2 / 16.0 GB",
GPU 23%, Disk 7%), the 52°C chip, and the Sleep / Restart / Shut down row. The
label cross-fades to **SYSTEM MONITOR**.

**// beat-grid: 13.11s** — morphs again to Calendar, 480×286: the six-row August
2026 grid with the 14th filled in accent, dots on 6/21/27, and the right pane
reading "Friday 14 August" over three reminder tiles (Ship the Display page 17:30,
Call with Priya 18:15, Renew domain 09:00 struck through). Label **CALENDAR**.

The card's width and height both change on every step and the content cross-fades
in 140ms with no travel — matching the app, where the card is already springing and
a second axis of motion reads as jitter.
Sequential/interaction: yes — three panels arriving one at a time, each preceded by
its chevron lighting up.
Audio intent: the payoff on the expand, then two small, dry steps. The steps must
be quieter than the expand or the ring outranks the reveal.
Audio-coupled idea: expand → `impact/impactSoft_medium_001` at 8.70s (0.72);
panel steps → `interface/select_008` at 10.90s and 13.08s (0.48).
Music: steady at 0.30, its strongest stretch.
Transition mood: soft → Scene 4

### Scene 4 — Retreat — 3.27s (15.29 → 18.56)

The cursor turns and leaves downward. The card steps back down on the app's own
timings — expanded → pill over ~0.30s, a beat, pill → nothing — and the top edge is
empty again with only the hairline mark, exactly as scene 1 began.
Copy, entering at 15.84s and settled from ~16.2s to the end (≈2.4s):
**"Move away and the desktop is yours again."** (site verbatim, hero paragraph).
Sequential/interaction: yes — cursor exit driving a two-step collapse.
Audio intent: the bed ducks to ~0.20 and one soft cue marks the pill leaving.
Nothing after it — the last second of this scene is deliberately bare.
Audio-coupled idea: pill retracting → `interface/drop_001` at 15.72s (0.40).
Music: ducked.
Transition mood: soft crossfade (0.5s) → Scene 5

### Scene 5 — Crest — 3.84s (18.56 → 22.40)

**// beat-locked: 18.56s** — the Crest mark (`public/crest-logo.png`, 22% rounded,
its indigo drop shadow) lands centre with the wordmark **Crest** beside it.
**// beat-locked: 19.66s** — the tagline settles under it: **"The dynamic notch,
built for Windows."** (site verbatim).
At 20.75s one small faint line: **"Free · native · open source · Windows 10 & 11"**.
Everything holds still from 21.0s; the aurora keeps breathing and the whole frame
fades out over the last 0.6s.
Sequential/interaction: none — this scene is a full stop.
Audio intent: one resonant bell as the mark lands, allowed to ring over the music
while the bed fades out under it.
Audio-coupled idea: mark landing → `impact/impactBell_heavy_000` at 18.52s (0.62).
Music: back to 0.30 on the mark, then a 1.4s fade to zero from 21.0s.
Transition mood: fade to black — end.

**Music mood for this video:** cinematic (steady, restrained, low)
**Audio summary:** A low steady bed establishes over an empty screen, gives its one
real hit to the card opening, thins to near-silence while the notch takes itself
away, and returns just long enough for a single bell under the name before fading
out.

## Reading-time check

| Line | Words | Floor | Settled |
|---|---|---|---|
| "No shortcut to learn." | 4 | 1.2s | ~2.9s |
| "600ms of hover." | 3 | 0.9s | ~3.2s |
| Panel labels (nav strip) | 1-2 | 0.8s | 2.18s each |
| "Move away and the desktop is yours again." | 8 | 2.4s | ~2.4s |
| "The dynamic notch, built for Windows." | 6 | 1.8s | ~2.7s |
| "Free · native · open source · Windows 10 & 11" | 8 | 2.4s | ~1.65s ⚠ |

The last row is under its floor as a sentence, but it is a badge line of four
independent facts read at a glance rather than a sentence parsed left to right —
it is allowed to run short. Every line that carries an argument clears its floor.
