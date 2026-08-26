# Asset inventory — crest.localhost capture

**Authored by the agent, not by vision captioning.** The capture's optional
vision phase was skipped (`--skip-vision`) and its asset-download phase never ran
(the cooperative budget was exhausted by this site's animation load — 24 web
animations, 57 CDP animations, 26 scroll targets and a parallax background).
The inventory below was established by reading the captured DOM directly.

## The finding: this site has exactly one raster asset

`capture/extracted/page.html` contains **5 `<img>` elements, all of them the same
Crest logo** at different sizes (24, 24, 68, 76 and 24 px), served through the
Next.js image optimizer from `/public/crest-logo.png`. The only other external
`url()` references are the four Geist woff2 font files. Every icon, every panel,
the entire notch demo and all decorative artwork are **inline SVG and CSS** — so
an empty `assets/` directory is substantively correct here, not a capture failure.

## assets/

| File | What it is | Where it belongs |
|---|---|---|
| `crest-logo.png` | The Crest app mark. 512x512 PNG, rounded-square glyph, blue. Staged from the repo's own `public/crest-logo.png` at full resolution — better than any optimizer-resized srcset variant the download phase would have produced. | The close: the brand lockup over the download CTA. |

## screenshots/ — the real visual inventory

These are the assets that matter for this video. All captured clean: the
`What's new in Crest` modal (which auto-opens on a fresh browser profile and
covered every scroll position in the first two capture attempts) was suppressed,
and the Next.js dev indicator was disabled.

| File | What it shows |
|---|---|
| `full-page.png` | **The whole document, 1920x10208, 1x.** Pixel-exact for a 1920-wide viewport travelling down it — this is the plate for any scroll shot. |
| `scroll-000.png` | Hero. H1 "The space at the top of your screen *finally does something.*", the lede, both CTAs ("Try Crest for Windows" / "See it in action"), "Free for Windows 10 & 11 · No account required", and the top of the live NotchDemo showing the resting pill: music mark, `5:15 PM`, `68%` battery, with the caption "Hover the notch. It expands after 600ms". |
| `scroll-008.png` – `scroll-025.png` | The NotchDemo section and the hero stat panel (600ms / 7 / 0 / MIT). |
| `scroll-033.png` – `scroll-050.png` | Features grid and "How it works" ("No shortcut to learn."). |
| `scroll-058.png` – `scroll-083.png` | Preferences, the little things, under the hood. |
| `scroll-091.png` – `scroll-100.png` | Origin, FAQ, download section, community/footer. |

## Reference material NOT in this capture

`docs/screenshots/*.png` in the repo holds four genuine shots of Crest running
(`notch-peek` 320x96, `notch-media` 500x228, `notch-files` 560x270,
`notch-launcher` 520x410). Per `BRIEF.md` these are **fidelity reference only and
must not appear on screen**: they are small, cropped on black with no desktop
context, and `notch-media.png` is stale — its nav strip still carries the `1/3`
position counter that the product has since removed.
