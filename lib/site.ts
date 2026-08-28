/**
 * Single source of truth for everything the marketing copy needs to point at.
 *
 * `url` feeds `metadataBase`, which is what makes the OG/Twitter image URLs
 * absolute — set `NEXT_PUBLIC_SITE_URL` on the host to pin a custom domain.
 */
const repo = "https://github.com/LennyDany-03/Dynamic-Notch";

/**
 * The origin this site is served from, used for canonical URLs, `metadataBase`
 * and the sitemap.
 *
 * The localhost fallback used to be the only one, and on a host where nobody had
 * set `NEXT_PUBLIC_SITE_URL` it did not fail loudly — it shipped a live
 * `sitemap.xml` advertising `http://localhost:3000/privacy`, which is the URL
 * the Microsoft Store submission depends on being discoverable. So the Vercel
 * domain is read directly as the middle fallback and the variable becomes an
 * override for a custom domain rather than a requirement.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` is the *production* domain on every
 * deployment, preview builds included, which is what a canonical URL wants —
 * `VERCEL_URL` is per-deployment, so it would point previews at themselves and
 * scatter the canonical across every build. Neither is `NEXT_PUBLIC_`, so both
 * are server-only; that is safe precisely because the three readers of
 * `site.url` (`app/sitemap.ts` and the two `metadata` exports) all run on the
 * server. Do not read `site.url` from a Client Component without making this a
 * `NEXT_PUBLIC_` variable — the value would be `undefined` in the browser
 * bundle and hydration would disagree with the server.
 */
const origin = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/**
 * Must match `version` in product/src-tauri/tauri.conf.json — that number is
 * what the release tag and the NSIS installer filename are built from, so a
 * mismatch here produces a 404 on the download button.
 */
const version = "0.7.2";

export const site = {
  name: "Crest",
  tagline: "The dynamic notch, built for Windows.",
  description:
    "Crest puts a Mica-glass notch at the top of your Windows desktop. Hover for your music, apps, files, notes, notifications, system load, weather and calendar. Then it disappears. Five themes, any monitor. Free, native, and open source.",
  url: origin,
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
   * Support address, and the one registered with Microsoft Partner Center —
   * keep the two the same, or a Store enquiry lands somewhere nobody reads.
   * The privacy policy and the contact page both build their `mailto:` from it.
   */
  email: "lennydany3@gmail.com",
  /**
   * Who the privacy policy names as the publisher. `author` above is the GitHub
   * handle, which is a username rather than a person — a legal document needs
   * the person, so the two are deliberately separate strings.
   */
  publisher: "Lenny Dany Derek D",
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
