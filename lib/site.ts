/**
 * Single source of truth for everything the marketing copy needs to point at.
 *
 * `url` feeds `metadataBase`, which is what makes the OG/Twitter image URLs
 * absolute — set `NEXT_PUBLIC_SITE_URL` on the host once the real domain is
 * live, otherwise social previews resolve against localhost.
 */
export const site = {
  name: "Crest",
  tagline: "The dynamic notch, built for Windows.",
  description:
    "Crest puts a Mica-glass notch at the top of your Windows desktop. Hover for your music, apps, clipboard, files and notes — then it disappears. Free, native, and open source.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  version: "0.1.0",
  repo: "https://github.com/LennyDany-03/Dynamic-Notch",
  download: "https://github.com/LennyDany-03/Dynamic-Notch/releases/latest",
  releases: "https://github.com/LennyDany-03/Dynamic-Notch/releases",
  author: "LennyDany-03",
  authorUrl: "https://github.com/LennyDany-03",
} as const;
