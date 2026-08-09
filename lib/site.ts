/**
 * Single source of truth for everything the marketing copy needs to point at.
 *
 * `url` feeds `metadataBase`, which is what makes the OG/Twitter image URLs
 * absolute — set `NEXT_PUBLIC_SITE_URL` on the host once the real domain is
 * live, otherwise social previews resolve against localhost.
 */
const repo = "https://github.com/LennyDany-03/Dynamic-Notch";

/**
 * Must match `version` in product/src-tauri/tauri.conf.json — that number is
 * what the release tag and the NSIS installer filename are built from, so a
 * mismatch here produces a 404 on the download button.
 */
const version = "0.4.1";

export const site = {
  name: "Crest",
  tagline: "The dynamic notch, built for Windows.",
  description:
    "Crest puts a Mica-glass notch at the top of your Windows desktop. Hover for your music, apps, clipboard, files and notes — then it disappears. Free, native, and open source.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  version,
  repo,
  /**
   * The NSIS installer asset itself, not the release page — one click, one
   * file. The name is the bundle tauri-action uploads
   * (`Crest_<version>_x64-setup.exe`); bumping `version` above moves both the
   * tag and the filename together.
   */
  download: `${repo}/releases/download/v${version}/Crest_${version}_x64-setup.exe`,
  releases: `${repo}/releases`,
  author: "LennyDany-03",
  authorUrl: "https://github.com/LennyDany-03",
} as const;
