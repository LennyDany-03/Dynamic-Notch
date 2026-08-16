# Hyperframes Composition Brief: Crest

## Objective

Create a short launch-style brag video for Crest — a Windows 11 notch overlay —
that earns its claim by showing the notch arrive, do three things, and take itself
away again.

## Output

- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 22.4 seconds

## Source Material

- Project root: `C:\Users\lenny\Documents\Code\Project\dynamic-notch`
- Primary files read:
  - `lib/site.ts` (name, tagline, version, description)
  - `app/globals.css` (palette, `.mica` recipe, `.notch-tile`, motion keyframes)
  - `components/site/Hero.tsx`, `Features.tsx`, `HowItWorks.tsx`, `UnderTheHood.tsx`, `DownloadSection.tsx` (copy)
  - `components/site/NotchDemo.tsx` (the authoritative in-browser replica — every
    card dimension, colour, label and sample value in this video is lifted from it)
  - `public/crest-logo.png` (the mark)
  - `CLAUDE.md` (`size` tokens, `NAV_STRIP_HEIGHT`, dwell/grace timings, module order)
- Product name: Crest
- Tagline / strongest claim: **The dynamic notch, built for Windows.**
- Key UI to recreate: the overlay itself — the 264×34 collapsed pill and the
  Media controls / System monitor / Calendar cards, at their real token sizes,
  morphing between them as one object.
- Copy that must appear verbatim:
  - "No shortcut to learn."
  - "The dynamic notch, built for Windows."
  - "Move away and the desktop is yours again." (compressed from the hero paragraph's
    "Move away and the desktop is yours again.")
  - The nav-strip labels: MEDIA CONTROLS, SYSTEM MONITOR, CALENDAR
  - "600ms of hover." (the dwell from `timing.dwellMs`)

## Creative Direction

- Tone preset: `polished`
- Creative direction: a quiet Windows product film — the notch does the talking
- Interpretation: five copy lines in 22 seconds, all short, all the project's own
  words. Soft crossfades, no hard cuts, no zoom-punches. The longest holds go to
  the card doing something rather than to text.
- Angle: absence and arrival. Open on an empty top edge, spend the middle on one
  card genuinely changing shape three times, end by taking the whole thing away
  again. The pitch is *invisible when idle*, so the video has to be willing to show
  an empty screen — twice.
- Hook: an empty desktop, an 80×4 accent hairline at the very top edge, and an
  oversized cursor already travelling toward it. One line: "No shortcut to learn."
- Outro / punchline: the mark, the name, the tagline, one line of fact, out.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign — every colour and dimension comes from the project

## Visual Identity

- Background (outro / page): `#07070b`
- Desktop wallpaper (from `NotchDemo`): `radial-gradient(120% 90% at 50% 0%, #2a1a52 0%, #150f2c 42%, #0a0a12 100%)`
  with two blurred wallpaper blobs — accent `#7c3aed` and icon-indigo `#1b00b5`
- Accent: `#7c3aed`; bright `#a855f7`; wash `rgba(124,58,237,.16)`; on-accent `#fff`
- Card surface (`.mica`): `rgba(32,32,32,.8)` + a 1px `rgba(255,255,255,.1)` top-only
  hairline + fractal-noise SVG at 5%, `mix-blend-mode: overlay`
- Inner tile (`.notch-tile`): `rgba(255,255,255,.055)`, radius 8, own `.12` top hairline
- Text: `#ededf2`; muted `rgba(237,237,242,.62)`; faint `rgba(237,237,242,.42)`;
  in-card `rgba(255,255,255,.9 / .8 / .6 / .4)`
- Meter tones: accent under 75%, `#fbbf24` at 75-89%, `#f87171` at 90%+
- Display + body font: "Segoe UI Variable Display" / "Segoe UI" / Inter / system-ui.
  Geist is not installed locally and no webfont may be fetched at render time, so the
  video uses the app's own documented fallback chain — which is what Crest actually
  renders in on Windows.
- Visual references: the collapsed pill's three-column grid; the 26px nav strip with
  chevrons, centred label and compact battery badge; the media scrub bar; the four
  system meters and the power row; the six-row month grid.

### Scale convention (important for any edit)

`html { font-size: 2.05px }`, so **`1rem` = one app pixel**. Every dimension in the
composition is written as the app's own number in `rem` — `width: 480rem` is the
calendar card's real 480px token. Do not convert these to px; the 2.05× zoom is what
makes 10px nav-strip type readable at 1080p, and rem keeps the source auditable
against `product/src/tokens.ts`.

## Storyboard

Use `brag-output/brag-plan.md` as the creative contract.

Scene summary:

1. **Approach** — 0.00 → 4.39s — empty desktop, hint mark, cursor travelling up;
   "No shortcut to learn." must be readable for ~2.9s.
2. **Peek** — 4.39 → 8.74s — the 264×34 pill drops in (equalizer chip, clock,
   68% charging battery chip); a dwell ring fills over exactly 0.6s;
   "600ms of hover."
3. **The ring** — 8.74 → 15.29s — the card springs open to Media controls, then
   morphs to System monitor, then to Calendar. Width **and** height change on
   every step; the nav-strip label cross-fades with the body.
4. **Retreat** — 15.29 → 18.56s — cursor leaves, card → pill → nothing, hint mark
   back; "Move away and the desktop is yours again."
5. **Crest** — 18.56 → 22.40s — mark, name, tagline, one fact line, fade out.

### Implementation constraint the storyboard depends on

The card resizing is the centerpiece, and `width`/`height` tweens are forbidden
(`gsap_non_transform_motion`). Use the `anchored-layout-expand` **proxy counter-scale**
variant, extended to both axes:

- `#card-mask` is authored at the largest card (480×312 app-px), `overflow: hidden`,
  and carries the Mica fill and shadow. One proxy `{w,h}` drives `scaleX/scaleY` on
  it, `transform-origin: 50% 0%`.
- `#card-sheet` inside it takes the exact inverse scale from the **same** proxy, so
  net content scale is 1.0 every frame. Every panel is authored at its true token
  size, centred and top-anchored, and cross-faded by opacity.
- The mask's `border-radius` is written from the same `onUpdate` as an **elliptical**
  radius (`16/sx px / 16/sy px`) so the corners render at a true 16px at every size
  instead of flattening. `borderRadius` is on the core allowlist.
- The hairline and the noise overlay live on the **sheet** (net scale 1), so a 1px
  line stays 1px at every card size, clipped to the card by the mask.
- `data-layout-allow-overflow` on the mask — the counter-scaled sheet parks outside
  it by construction, which is the technique working as designed.

## Audio

- Audio role: cinematic support held low — a steady bed that makes the card's motion
  feel deliberate, never a soundtrack the viewer notices on its own.
- Audio arc: bed establishes over an empty screen → one real hit when the card opens
  → thins to near-silence while the notch takes itself away → returns for a single
  bell under the name → fades out.
- Music: `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
  from 0.00, base volume 0.30.
- Music treatment: 0.6s fade in; duck to 0.20 across scene 4 (15.4 → 16.0s), back to
  0.30 at 18.4s for the mark, 1.4s fade to 0 from 21.0s. Implement as `volume` tweens
  on the timeline, not by swapping `data-volume`.
- Music cue guidance: preset read at
  `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`
  — 109.96 BPM, ~0.545s/beat.
  - **Strong-cue locks (3):** 8.74s (0.99) card expands · 18.56s (0.99) mark lands ·
    19.66s (0.96) tagline settles.
  - **Beat grid:** panel steps at 10.93s and 13.11s (four beats apart — deliberately
    not every beat, because each panel is content to read).
- Audio-reactive treatment: subtle. Per-frame data is pre-extracted to
  `assets/music/audio-data.js` (30fps, `[rms, bass, treble]`, first 676 frames).
  Drive only: the two wallpaper blobs' opacity/scale from RMS (±12%), the ambient
  glow above the notch from bass (±14%), and the outro mark's halo from treble.
  Nothing on text, nothing on the card's geometry — the card's size is information,
  so it must never move for a reason that is not the product. No waveform, bars,
  particles, or strobing.
- Audio-coupled moments:
  - cursor reaches the top edge (3.55s) — `ui/rollover1`, very soft
  - pill drops (4.34s) — `interface/drop_002`
  - card expands (8.70s) — `impact/impactSoft_medium_001`, the one payoff hit
  - panel steps (10.90s, 13.08s) — `interface/select_008`, quieter than the expand
  - pill retracts (15.72s) — `interface/drop_001`
  - mark lands (18.52s) — `impact/impactBell_heavy_000`, rings over the fading bed
- SFX selection guidance: six cues in 22 seconds. Nothing may be louder than the
  expand hit, and nothing at all fires between 16.0s and 18.5s — that silence over
  the empty screen is the point of scene 4.
- SFX analysis guidance:
  `~/.claude/plugins/cache/brag/brag/0.2.2/skills/brag/assets/sfx/sfx-analysis.md`
  — prefer low/medium high-frequency-risk files; all six picks above are the
  low-risk family members.
- Audio files: already copied into `assets/music/` and `assets/sfx/{interface,impact,ui}/`.
- Track allocation: music on `data-track-index="10"`, SFX from 11 up, one track each
  so no two overlapping clips share a lane.

## Hyperframes Instructions

Built with the `hyperframes-core` contract (single paused GSAP timeline registered on
`window.__timelines["main"]`, `class="clip"` only on direct children of the root,
root `data-start="0"`), `hyperframes-animation` (`anchored-layout-expand` proxy
counter-scale, no `width`/`height`/`top`/`left` tweens, finite repeats),
`hyperframes-creative` (audio-reactive per-frame `tl.call` sampling), and
`hyperframes-cli` (`npx hyperframes check` as the single pre-render gate).

Requirements:

- Show real UI from the product — the whole middle of the video is it.
- Keep all text readable in the final render (see the reading-time table in the plan).
- Total duration 22.4s.
- Include the planned music and SFX layer.
- Treat cue metadata as timing hints; 3 strong-cue locks and one beat-grid pair only.
- Use local assets only — no CDN media, no webfonts.
- `npx hyperframes check` must pass before render.
