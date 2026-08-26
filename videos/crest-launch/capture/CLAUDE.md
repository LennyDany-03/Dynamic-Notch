# Crest: The dynamic notch, built for Windows.

Source: http://localhost:3000

To create a video from this capture, use the `product-launch-video` skill.

## What's in This Capture

| File | Contents |
|------|----------|
| `screenshots/contact-sheet.jpg` | **View this first.** All scroll screenshots in one labeled grid. |
| `screenshots/scroll-*.png` | Individual viewport screenshots if you need detail on a specific section. |
| `extracted/tokens.json` | Design tokens: 20 colors, 5 fonts, 20 headings, 2 CTAs |
| `extracted/design-styles.json` | Computed styles from live DOM: typography hierarchy, button/card/nav styles, spacing scale, border-radius, box shadows. Primary data source for DESIGN.md. |
| `extracted/asset-descriptions.md` | One-line description of every downloaded asset. Read this for asset selection — only open individual files for safe-zone checking. |
| `extracted/visible-text.txt` | Page text in DOM order, prefixed with HTML tag (`[h1]`, `[p]`, `[a]`). Use as context — rephrase freely. |
| `assets/contact-sheet.jpg` | All downloaded images in one labeled grid. |
| `assets/` | Individual downloaded images, SVGs, and font files. |

## Brand Summary

- **Colors**: #F5F5F7 (bg-light), #050508 (bg-dark), #98989D (neutral), #7D7D82 (neutral), #FFFFFF (bg-light), #0F0F13 (surface-dark), #2F6FED (accent), #C9C9CE (surface-light), #202020 (surface-dark), #000000 (bg-dark)
- **Fonts**: Geist (100-900 variable), Geist Mono (100-900 variable), __nextjs-Geist (400-600 variable), __nextjs-Geist Mono (400-600 variable), -apple-system (400,500,550,600,700)
