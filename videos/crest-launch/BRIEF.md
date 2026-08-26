---
workflow: product-launch-video
flow: automation
storyboard: yes
message: "The dead strip above your desktop finally does something"
destination: youtube
aspect: 1920x1080
language: en
length: 45-60s
angle: why-the-top-edge
audience: Windows desktop users, especially those who have watched macOS get a Dynamic Island
narration: yes
---

## Intent

A launch promo for **Crest** v0.7.0 — a Windows 11 always-on-top notch overlay
(Tauri 2 + React), free, native, MIT, no account.

The concept the user picked from the pitch round is **"Dead Strip"** — the
anti-pattern inverted. Every dev-tool promo opens on the product; this one opens
on the *void*. The wasted band above the desktop is drawn first as a cold
engineering measurement — dimension lines, hatched fill, a monospace callout
reading `1920 × 32 px · unused` — and only then does the drawing fill in and
resolve into the real product.

Chosen because Crest's hardest sell is not what the panels do, it is **why the
top edge** — the site has a section titled exactly that, and its H1 is "The space
at the top of your screen finally does something." Dead Strip is that headline as
a visual argument: the viewer *sees* the wasted band before anything offers to
fill it, so the product arrives as the answer to a question they now have.

The payoff lands on the real desk (pitch 1's framing, folded in as the resolution).

Tone: cold and precise at the top, warm and confident at the close. Restraint is
the product's character and should be the video's.

## Assets

- public/crest-logo.png — the brand mark; closes the video over the download CTA.
- product/src/tokens.ts — **brand truth for the notch rebuild.** Exact geometry:
  pill 264x34, media card 380x164, launcher 400x346, files 440x260,
  notifications 420x300, system 380x266, weather 400x268, calendar 480x286,
  quickAccess 420x186, screenshots 420x260, timer 400x190. Shell radius 16px,
  tile radius 8px, pill radius 99. Hotzone strip 80x6 at the very top edge.
- product/src/index.css — the Mica recipe, to be reproduced verbatim:
  background rgba(32,32,32,0.92), backdrop-filter blur(40px) saturate(1.2),
  inline-SVG fractalNoise at 5% overlay-blend, top-only 1px hairline
  rgba(255,255,255,0.1), shell shadow 0 2px 8px rgba(0,0,0,.28) + 0 12px 28px rgba(0,0,0,.22).
- app/globals.css — the site palette; source of the brand accent (see Notes).
- docs/screenshots/*.png — four real product shots. **Reference only, not staged
  assets:** small (320x96 to 560x410), cropped on black with no desktop context,
  and notch-media.png is stale (its nav strip still shows the removed `1/3`
  position counter). Use them to check fidelity of the rebuild, never on screen.
- capture/ — the marketing site, captured from http://localhost:3000 (see Notes).

## Customizations

- **Website capture** — the Next.js marketing site is the capture source and
  supplies brand tokens, real screens and the hero/NotchDemo/features sections.
- **The payoff card is rebuilt in HTML from `product/src/tokens.ts`**, not shown
  as a screenshot. This is load-bearing for the concept: Dead Strip's whole
  argument is the drawing *becoming* the product, and a flat PNG cannot be
  constructed on screen. The rebuild must animate the real state machine —
  hidden -> peek (264x34 pill) -> expanded card — using the product's own
  timings: 600ms dwell, 300ms grace.
- **Scene transitions** that morph the drafting layer into the real card at the
  payoff seam, rather than cutting.
- **Music: minimal, precise, and building.** Sparse and near-metronomic under the
  drafting section to match dimension lines and measurement, opening up when the
  void fills and the notch arrives. Storyboard `music:` mood should reflect this.
- **Design spec deferred until after capture** (a declared deferred ask): the
  user picks from 2-3 shipped presets shown with Crest's real colours and fonts
  already remixed on, so the look is judged with the real brand in hand rather
  than a stranger's palette.

## Notes

- **The accent is blue everywhere, including the notch. This was a user decision
  made against a raised concern.** The two surfaces disagree: the marketing site
  is blue `#2f6fed` (with `--accent-bright: #5b90f5`), while the product's default
  Crest theme is violet `#7c3aed`. The concern raised was that rendering a blue
  notch misrepresents what installs; the user chose all-blue anyway. It is a
  defensible state rather than a fiction — Crest ships an `accentColor`
  preference, so a blue notch is something a user can genuinely have. Do not
  silently revert this to violet.
- **Capture target is `http://localhost:3000`.** `site.url` in `lib/site.ts`
  falls back to localhost because `NEXT_PUBLIC_SITE_URL` is unset — there is no
  deployed site. The dev server must be running (`npm run dev` at the repo root)
  before `hyperframes capture` is invoked.
- Site facts available for copy, all verbatim from `lib/site.ts` / the section
  components: v0.7.0 · "Free for Windows 10 & 11 · No account required" ·
  hero stats `600ms` typical response, `7` built-in modules, `0` accounts
  required, `MIT` licence · CTA "Try Crest for Windows".
- The site's own feature one-liners are unusually good and are fair game as
  narration or on-screen text: "A track starts. Skip it without touching the
  taskbar." / "You need an app right now. Type three letters, it's open." /
  "The fan kicks in. Check what's actually using the CPU before you blame Chrome."
  / "You're not touching it. It's not touching your taskbar, Alt-Tab, or anything
  else."
- Avoid the anti-pattern this concept was chosen against: the dark-mode SaaS
  montage — synth bed, panels flying in from the side, "MEET CREST", a feature
  grid, an end card. No glowing gradient blobs.
- There is a prior, unrelated video at `brag-output/` in this repo. It is not a
  reference and should not be matched or continued.
