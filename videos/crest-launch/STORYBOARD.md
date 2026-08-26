---
format: 1920x1080
duration: 54s
message: "The dead strip above your desktop finally does something"
arc: BAB — Before (the void, measured) → After (it fills) → Bridge (Crest named) → Proof (the panels) → Wow (it vanishes) → CTA
audience: Windows desktop users, especially those who have watched macOS get a Dynamic Island
mode: collaborative
music: minimal precise electronic underscore — sparse ticking pulse under the drafting section, opening to a warm resolve at the reveal
---

> **Concept: "Dead Strip."** The anti-pattern inverted. Every dev-tool promo opens on
> the product; this opens on the *void* — the wasted band above the desktop drawn as a
> cold engineering measurement, which then fills in and resolves into the real thing.
> The video **bookends on its own callout**: frame 1 reads `1920 x 32 px · unused`,
> frame 8 re-measures the same band and reads `in use`.
>
> **The notch is rebuilt in HTML from `product/src/tokens.ts`**, never screenshotted —
> the whole argument is the drawing *becoming* the product, and a flat PNG cannot be
> constructed on screen. Exact geometry: pill 264x34, media card 380x164, launcher
> 400x346, shell radius 16px, tile radius 8px, dwell 600ms, grace 300ms, hotzone 80x6.
> Mica recipe: `rgba(32,32,32,.92)`, `backdrop-filter: blur(40px) saturate(1.2)`, 5%
> turbulence noise overlay-blended, top-only 1px hairline `rgba(255,255,255,.1)`.
>
> **Accent is `#2F6FED` (site blue) everywhere, including the notch** — a user decision
> recorded in `BRIEF.md`. Do not revert to the product's default violet.

## Video direction

**Palette** (from `frame.md`, never invented) — `paper #0F0F13` is the ground on every
frame. `ink #F5F5F7` is all primary type. `ink-soft #2F6FED` is the **single accent**
and it does three jobs and no others: dimension lines and measurement chrome, the one
focal word per frame, and the notch's own accent. `grid rgba(47,111,237,0.10)` is the
permanent graph-paper ground behind every frame — the preset's canvas tone, never
disabled. `ink-faint rgba(47,111,237,0.18)` for hairlines.
**`paper-2 #5865F2` is remix noise, not a surface** — the remapper produced a saturated
indigo for a key the preset used as a second paper. Never ground a frame in it; at most
a rare deep tint behind an accent. Nothing in this video is violet `#7C3AED`.

**Type** — by role from `frame.md`: `display-hero` / `headline` for frame headlines,
`body-lede` for the lede, `mono-tag` / `mono-chrome` for every measurement, callout and
stat unit, `micro` for section chrome. The mono voice is load-bearing: it is what makes
the measurements read as drafting rather than decoration, and it must never be
substituted for the sans.

**Motion grammar + reveal model** — long-tail decel throughout; `power3` is the default
and overshoot is not used anywhere in this video (Crest's register is restraint, and a
bouncy notch would contradict the product). Every frame is **VO-paced**: at t=0 only
what the voiceover is saying then is on screen, and each further piece reveals on its
spoken cue, weighted into the back half. Nothing front-loads.

**Rhythm / held-frame allocation** — the video alternates deliberately.
Frames 1, 3, 6 and 8 develop across their whole length. **Frame 5 is the breather** —
its zoom-out finishes at 3.4s and the remaining 3.3s is dead still, which is the point:
it is the frame that argues by absence, placed immediately before the stat cascade so
frame 6 lands against silence. **Frame 4 holds for its last 3s** after doing six cuts,
and **frame 7 is 3.5s of near-continuous change** to accelerate into the close. During
any hold the only sanctioned aliveness is low-amplitude subtle jitter; there is no
breathing and no back-half pan or push anywhere.

**Continuity** — one film, not eight slides. The band at the top edge is the carrier:
established in frame 1, it becomes the pill in frame 2, is the thing being opened in
frames 3–4, is what vanishes in frame 5, and is re-measured in frame 8 at the **same
coordinates it had in frame 1**. Frames 1→2 and 5→8 must agree on that geometry exactly.

**Caption keep-out** — captions ride the bottom ~17%. **Nothing meaningful below
y≈890.** The frame labels and note lines in the sketches (`Frame 0N · role`, the bottom
note) were sketch scaffolding only and are **dropped in the build** — they sit in the
band and were never content.

**Negative list** — no bouncy defaults (`back.out` / `bounce.out` / `elastic.out`); no
lazy breathing; no slow pan or push in any frame's back half; no `repeat` / `yoyo`; no
`Math.random` / `Date.now`; no browser chrome, scrollbars, nav bars or real OS cursors
except the deliberate desktop reconstruction, which is the subject; no floating bokeh
or purple-blue "AI" gradients; no glow used as decoration rather than as focus; and no
stock-desktop screenshot standing in for the rebuilt notch.

## Frame 1 — Dead strip

- scene: A blue dimension line draws across the top of an empty near-black screen; a monospace callout counts up to 1920 and lands on the word "unused"
- voiceover: "Every Windows desktop has a strip of dead space right at the top. Nineteen hundred pixels wide. Doing nothing at all."
- duration: 7.68s
- transition_in: cut
- status: animated
- src: compositions/frames/01-dead-strip.html
- type: hook
- persuasion: Pain validation by measurement
- beat: recognition + mild indignation
- blueprint: dataviz-countup (Adapt)
- focal: none — typography and vector only
- roles: —
- sfx: tick-soft, riser-low
- asset_candidates:

Adapt: keep the count-up-as-engine signature and the cold, empty open. The blueprint's "icons puncture in and fling outward" spread is dropped — Crest has no icon set at this beat and a scatter would contradict the drafting register — and the spread becomes the dimension line extending to both frame edges, which is the same single beat played as a measurement.

Scene 1 (0.0–3.0s): paper ground with the graph grid faint; nothing else on screen. As the VO reaches "a strip of dead space right at the top", a hatched band establishes at the true top edge, its hatch strokes drawing in left-to-right (`svg-path-draw`) on a long-tail settle. Full-width strip, 2 depth layers (grid behind, band above). Camera static.
Scene 2 (3.0–5.0s): on "Nineteen hundred pixels wide", the dimension line extends from centre out to both frame edges with end ticks snapping in at the extremes (`svg-path-draw`), while the numeral counts 0→1920 dead-centre and grows with its own value (`counting-dynamic-scale`) — the count-up and the line's extension are ONE beat, which is the blueprint's signature. Centered, numeral ~35% of frame height, mono. A slow lean-in on the root (`multi-phase-camera`) runs underneath and stops at 5.0s.
Scene 3 (5.0–7.68s): the numeral holds; `× 32 px` settles beneath it, then on "Doing nothing at all" the single accent word `unused` lands below in ink-soft (`dynamic-content-sequencing`). No further camera, and no jitter — the frame goes completely still on the word "nothing", which is the joke. Held read to the end.

narrativeRole: Opens on the void, not the product. Draws the wasted band as a cold engineering measurement — dimension line, end ticks, hatched fill — so the viewer sees the problem as a fact before anything is sold. The 1920 counting up is the shot's engine: scale alone carries the tension, no product and no context yet.
keyMessage: There is real, measurable dead space at the top of your screen.

## Frame 2 — Finally does something

- scene: The hatched void fills — the drafting rectangle resolves into a real Mica pill — and the callout "unused" swaps in place for the Crest wordmark
- voiceover: "Crest turns it into a panel. It shows up when something needs you, and gets out of the way the second it doesn't."
- duration: 6.243s
- transition_in: crossfade
- status: animated
- src: compositions/frames/02-finally.html
- type: product_intro
- persuasion: Negative contrast — the void answered in the same frame that measured it
- beat: curiosity to clarity
- blueprint: kinetic-type-beats (Adapt)
- focal: none — the rebuilt pill is the hero and is authored, not an asset
- roles: —
- sfx: impact-soft
- asset_candidates:

Adapt: keep the in-place token-swap signature — `unused` is the fixed slot and what replaces it is the product — but the swap terminates in a real surface rather than in another word, which is the whole concept. The blueprint's full-screen statement beats are kept for the headline.

Scene 1 (0.0–2.2s): opens on frame 1's band and dimension line at **identical coordinates** (the carrier hand-off). On "Crest turns it into a panel" the hatch clears left-to-right and the band's centre morphs into the real Mica pill at true 264x34 — container morph (`card-morph-anchor`), radius easing to the shell's 16px, Mica surface and its top hairline fading up beneath. `unused` hard-cuts out on the same frame the pill lands (`discrete-text-sequence`) — a cut, not a fade. Full-width strip up top.
Scene 2 (2.2–4.3s): the site's own H1 builds beneath in two lines, word by word (`dynamic-content-sequencing`), with "finally does something." arriving in ink-soft on its spoken cue. Centered, headline ~28% of frame height. Camera still.
Scene 3 (4.3–6.243s): the lede's two clauses reveal one per spoken clause beneath the H1 (`dynamic-content-sequencing`); as "gets out of the way" is spoken the pill's own contents dim toward rest — the surface demonstrating the sentence rather than illustrating it. Held read, subtle jitter only.

narrativeRole: The value claim, landing on beat 2 as the spine requires. The drawing becomes the thing — this is the concept's central move and the seam the whole video is built around. The word "unused" swapping in place for the brand is the kinetic-type pattern doing the argument.
keyMessage: That dead space is now a panel — present when useful, absent otherwise.

## Frame 3 — Nudge the top

- scene: A cursor rises to the top edge, crosses the measured 80x6 trigger strip, the pill peeks, a 600ms dwell ring completes, and the card opens
- voiceover: "Nudge the top of the screen. Hold it for six hundred milliseconds. It opens."
- duration: 5.773s
- transition_in: crossfade
- status: animated
- src: compositions/frames/03-nudge.html
- type: key_feature
- persuasion: Friction reduction — show the entire cost of using it, which is one gesture
- beat: ease + control
- blueprint: cursor-ui-demo (Reproduce)
- focal: none — rebuilt UI
- roles: —
- sfx: whoosh-soft, tick-soft
- asset_candidates:

Scene 1 (0.0–2.0s): pushed-in framing on the screen's top-centre — the camera is closer than frames 1–2, and this is the only re-framing in the video. The 80x6 hotzone draws as a measured accent strip with an `80 × 6` mono tag beside it. An oversized cursor enters from the lower edge and travels up into the strip (`cursor-click-ripple`, travel only — no click yet), decelerating into it on `power3`. Layered depth: grid, desktop plane, cursor.
Scene 2 (2.0–4.2s): the pill peeks on a smooth settle (`spring-pop-entrance`, long-tail register — no overshoot), and a dwell ring draws itself around the cursor tip (`svg-path-draw`, stroke rotated -90° so it fills from twelve o'clock) exactly as the VO says "six hundred milliseconds". The ring's fill IS the 600ms — it is the number made visible, not a decoration.
Scene 3 (4.2–5.773s): the ring completes and clears; the media card opens downward out of the pill (`card-morph-anchor`) to a true 380x164, its rows fading up on a short stagger. Held; the cursor rests where it is. No back-half camera move.

narrativeRole: The mechanism, shown rather than claimed. The hotzone keeps the drafting language (still measured, 80x6) so the technical frame survives into the live product instead of being abandoned at the reveal. The dwell ring makes the 600ms legible as a deliberate guard, not a lag.
keyMessage: Opening it costs one deliberate gesture, and passing through does nothing.

## Frame 4 — Seven panels, one arrow apart

- scene: The card holds its position while its contents hard-cut through Media, Launcher, System load, Weather and Calendar; only the nav-strip label and the body change
- voiceover: "Music. Your apps. What's actually eating the CPU. The weather, a timer, your notes. Seven panels, one arrow apart."
- duration: 10.292s
- transition_in: crossfade
- status: animated
- src: compositions/frames/04-panels.html
- type: feature_showcase
- persuasion: Value stacking — breadth asserted around one fixed identity
- beat: surprise at range
- blueprint: fixed-anchor-cycle (Reproduce — sub-shape A, adjacent-region cycle)
- focal: none — rebuilt UI
- roles: —
- sfx: tick-soft
- asset_candidates:

The anchor is the card's outer shell and its nav strip; the cycling region is the body beneath. The blueprint's geometry law is respected exactly — the body never overlaps, touches or displaces the strip, and the shell never moves a pixel for the whole 10.3s.

Scene 1 (0.0–1.2s): the card sits centred at true scale, carried in from frame 3 with its media body already present; the strip reads `‹ MEDIA CONTROLS ›`. On "Music" the transport row lights on the accent. Nothing else moves.
Scene 2 (1.2–4.4s): two steady steps at ~1s each. On "Your apps" the body hard-cuts to the launcher grid and the strip label swaps in place (`discrete-text-sequence`, instant replacement); on "What's actually eating the CPU" it steps to the system meters, whose four bars fill on that cue (`stat-bars-and-fills`).
Scene 3 (4.4–7.2s): the cadence tightens to ~0.9s for weather → timer → notes, three more hard cuts landing on their spoken names. Each swap is a velocity-matched seam rather than a dissolve, run at label granularity across the strip text (`cut-catalog.md`, waterfall cut).
Scene 4 (7.2–10.292s): the cycling stops on the calendar. "Seven panels, one arrow apart." builds word by word beneath the card (`dynamic-content-sequencing`) and the two nav chevrons pulse once on the accent. Held read to the end — the longest hold in the video, placed deliberately because the frame has just performed six cuts.

narrativeRole: Breadth without a feature grid. The card is the pinned anchor and its contents cycle, which is exactly how the product behaves — the notch never moves, the panel inside it changes. The stillness of the frame is what makes the range read as one coherent thing rather than a list.
keyMessage: One surface, many panels, always in the same place.

## Frame 5 — Then it's gone

- scene: The cursor leaves; the card steps expanded to pill to nothing, and one continuous zoom-out reveals the whole clean desktop with only a faint mark at the top edge
- voiceover: "Move away and it steps back down. No taskbar icon. No Alt-Tab entry. Nothing."
- duration: 6.661s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/05-gone.html
- type: benefit_highlight
- persuasion: Show-don't-tell proof of absence — the benefit is demonstrated by removal
- beat: relief + peace of mind
- blueprint: zoom-out-workspace-reveal (Reproduce — Variant B)
- focal: none
- roles: —
- sfx: whoosh-soft
- asset_candidates:

Scene 1 (0.0–2.4s): held close-up on the card, matching frame 4's scale. The cursor exits downward out of frame; after the product's real 300ms grace the card steps down through three **discrete** states — expanded → pill → gone — driven as states rather than as a fade (`discrete-text-sequence` for the state clock, `card-morph-anchor` for the shell's geometry).
Scene 2 (2.4–3.4s): ONE decelerating zoom-out burst (`viewport-change`, heavy `power4.out`) pulls back to the full desktop and the frame LOCKS. The zoom **ends here**, well before the shot does — the deceleration-to-stop is what makes the lock legible, and the post-lock act is mandatory.
Scene 3 (3.4–6.661s): post-lock. On their spoken cues, three mono tags reveal one at a time (`dynamic-content-sequencing`) — `taskbar` and `alt-tab` arriving struck through, then simply `nothing` — while the only mark anywhere on the desktop is the 80px accent hotzone at the top edge. Absolutely still: no drift, no push, no jitter. This is the video's breather and its silence is doing the work.

narrativeRole: The emotional payoff and the hardest thing to say in words — the product's value is that it is not there. The zoom-out is the engine: the card collapses in close-up, then the frame opens to a desktop with nothing on it. This is the beat that separates Crest from a widget.
keyMessage: Its best state is invisible, and it costs you nothing while it waits.

## Frame 6 — The numbers

- scene: Four stat tiles self-assemble on the drafting grid — 600ms, 7, 0, MIT — each landing with its caption
- voiceover: "Six hundred milliseconds to open. Seven panels built in. Zero accounts. MIT licensed."
- duration: 8.046s
- transition_in: crossfade
- status: animated
- src: compositions/frames/06-numbers.html
- type: social_proof
- persuasion: Statistical proof + risk reversal — "zero accounts" and "MIT" remove the two objections
- beat: trust
- blueprint: grid-card-assemble (Adapt)
- focal: none
- roles: —
- sfx: tick-soft
- asset_candidates:

Adapt: keep the staggered assemble-into-slot signature, but the four tiles arrive **one per spoken stat** rather than in one fast cascade — the line names them separately, and a single 0.05s cascade would front-load the entire frame against doctrine rule 2. The blueprint's Scene-2 continuous tile float is dropped outright (doctrine rule 3: no lazy breathing).

Scene 1 (0.0–2.3s): the graph grid strengthens into a visible four-column measure — the drafting surface returning to do one last job. Tile 1 slides a short path into its slot (`center-outward-expansion`, direct-into-slot form) and `600` counts up with `ms` settling after it (`counting-dynamic-scale`).
Scene 2 (2.3–4.3s): tile 2 lands on "Seven panels built in"; `7` counts up. Tile 1 is already still.
Scene 3 (4.3–5.9s): tile 3 lands on "Zero accounts"; `0` counts up and holds **in ink-soft** — accented because it, not the performance number, is the objection-killer.
Scene 4 (5.9–8.046s): tile 4 lands on "MIT licensed"; `MIT` snaps in by character rather than counting (`discrete-text-sequence`) since it is a word wearing a number's clothes, and holds in ink-soft. All four tiles hold, dead still, to the end.

narrativeRole: The site's own hero stats, in the site's own order. The 0 and the MIT are doing the persuasive work rather than the performance numbers — they answer "what does this cost me" before the ask. Deliberately a tile assembly rather than a second count-up, so it does not repeat frame 1's shape.
keyMessage: It is fast, it is broad, and it asks nothing of you.

## Frame 7 — Any screen, any theme

- scene: The pill re-skins through five themes in place, then slides from one monitor's top edge to another's
- voiceover: "Five themes. Any monitor. Free."
- duration: 3.474s
- transition_in: crossfade
- status: animated
- src: compositions/frames/07-themes.html
- type: benefit_highlight
- persuasion: Rule of three — three short value phrases, no elaboration
- beat: confidence
- blueprint: kinetic-type-beats (Adapt)
- focal: none
- roles: —
- sfx: tick-soft
- asset_candidates:

Adapt: keep the beat-per-phrase build, but each beat is carried by a **surface change** rather than by the word alone — the theme morph is the motion and the words are its caption. At 3.5s this is the one frame where change is near-continuous, which is deliberate: it accelerates into the close.

Scene 1 (0.0–1.3s): the pill sits centred at true scale. On "Five themes" it re-skins in place through five complete palettes (`theme-crossfade-morph`, ~0.22s per skin, the anchor's geometry never moving); the word lands beneath as the last skin settles. The five are the product's real themes — Crest, Glacier, Ember, Daylight, Mono — but this video's accent decision means the pill returns to blue at rest.
Scene 2 (1.3–2.4s): on "Any monitor" a second screen outline slides in beside the first and the pill repositions to its top edge in one slow-fast-slow move (`nudge-curve`).
Scene 3 (2.4–3.474s): on "Free" the word lands centred in ink-soft on a single smooth settle (`spring-pop-entrance`, long-tail register). Immediate hold — the frame ends on the word, with no time spent after it.

narrativeRole: The shortest frame in the video and deliberately so. Three facts that each remove a "but does it..." objection, delivered staccato so the piece accelerates into the close rather than sagging before it.
keyMessage: It adapts to your setup rather than asking you to adapt to it.

## Frame 8 — In use

- scene: The frame-1 dimension line returns and re-measures the same band — now containing the pill — and the callout reads "in use"; the logo and the download line resolve beneath
- voiceover: "Crest. Free, native, open source. Try it on Windows."
- duration: 6.034s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/08-in-use.html
- type: cta
- persuasion: Closure — the opening measurement answered, then the ask
- beat: inevitability to urgency-to-act
- blueprint: logo-assemble-lockup (Adapt)
- focal: assets/crest-logo.png
- roles: crest-logo = cutout — the centred mark above the wordmark
- sfx: tick-soft, impact-soft
- asset_candidates: assets/crest-logo.png — the Crest app mark, 512x512, rounded-square blue glyph

Adapt: keep the "mark comes to exist → centred lockup → extended into the CTA" spine, but the assemble is replaced by **the bookend**: the frame-1 dimension line and its end ticks redraw at their original coordinates and re-measure the band, now containing the pill. That re-measurement IS the mark's arrival context, and it is why the CTA needs no persuasion of its own.

Scene 1 (0.0–1.3s): the dimension line and both end ticks redraw at **frame 1's exact coordinates** (`svg-path-draw`) with the pill sitting inside the band. The mono callout types `1920 × 32 px · in use`, `in use` landing in ink-soft in the slot where `unused` sat (`discrete-text-sequence`). The logo settles into centre and the wordmark completes beside it as "Crest" is spoken.
Scene 2 (1.3–3.4s): "Free, native, open source." reveals word by word beneath the lockup (`dynamic-content-sequencing`). Camera still.
Scene 3 (3.4–6.034s): the CTA pill lands on one press-settle (`press-release-spring`, no release burst) carrying "Try Crest for Windows", and the site's verbatim "Free for Windows 10 & 11 · No account required" settles beneath it in mono — **both kept above y≈890**, clear of the caption band. Everything holds to the end. This is the only frame with a real exit, and the exit is the hold.

narrativeRole: The bookend. The same dimension line, the same band, the same monospace voice — and a callout that now reads "in use". The argument closes on itself, which is why the CTA needs no persuasion of its own: the frame has already proved the claim the video opened with. The download line is the site's verbatim "Free for Windows 10 & 11 · No account required".
keyMessage: The dead strip is in use now — go get it.
