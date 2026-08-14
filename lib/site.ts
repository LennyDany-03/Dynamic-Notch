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
const version = "0.6.0";

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
  /**
   * The community server. A permanent invite — the community section, the
   * header and the footer all point at this one string, so a re-issued invite
   * is a one-line change.
   */
  discord: "https://discord.gg/GYcHnBmuMg",
} as const;

/**
 * Every place Crest can be followed, in the order they are drawn.
 *
 * `icon` names a component in `components/site/icons.tsx` rather than importing
 * one, so this file stays a plain data module that a Server Component, the
 * footer and the community section can all read without pulling in React.
 *
 * **An entry with an empty `href` is not rendered.** The accounts below that
 * have no URL yet are listed so the shape is already decided — fill in the
 * handle and the link appears everywhere at once, with nothing else to edit.
 * A placeholder that shipped live would be a 404 on the real site, so an empty
 * string is deliberately the "not yet" value rather than a `#`.
 */
export type SocialId = "discord" | "github" | "instagram" | "x" | "youtube";

export const socials: readonly {
  id: SocialId;
  label: string;
  /** What following *this* one gets you — the footer shows it, the grid needs it. */
  blurb: string;
  href: string;
}[] = [
  {
    id: "discord",
    label: "Discord",
    blurb: "Bug reports, changelogs and whatever gets built next.",
    href: site.discord,
  },
  {
    id: "github",
    label: "GitHub",
    blurb: "The whole source, every release, and the issue tracker.",
    href: repo,
  },
  {
    id: "instagram",
    label: "Instagram",
    blurb: "Clips of new panels as they land.",
    href: "",
  },
  {
    id: "x",
    label: "X",
    blurb: "Release notes in one post.",
    href: "",
  },
  {
    id: "youtube",
    label: "YouTube",
    blurb: "Walkthroughs and build logs.",
    href: "",
  },
];

/** The subset that actually has somewhere to point. */
export const activeSocials = socials.filter((social) => social.href !== "");
