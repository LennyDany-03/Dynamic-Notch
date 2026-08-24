
const repo = "https://github.com/LennyDany-03/Dynamic-Notch";

const version = "0.6.9";

export const site = {
  name: "Crest",
  tagline: "The dynamic notch, built for Windows.",
  description:
    "Crest puts a Mica-glass notch at the top of your Windows desktop. Hover for your music, apps, files, notes, notifications, system load, weather and calendar. Then it disappears. Five themes, any monitor. Free, native, and open source.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  version,
  repo,
  
  download: `${repo}/releases/download/v${version}/Crest_${version}_x64-setup.exe`,
  releases: `${repo}/releases`,
  author: "LennyDany-03",
  authorUrl: "https://github.com/LennyDany-03",
  
  discord: "https://discord.gg/GYcHnBmuMg",
} as const;

export type SocialId = "discord" | "github" | "instagram" | "x" | "youtube";

export const socials: readonly {
  id: SocialId;
  label: string;
  
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

export const activeSocials = socials.filter((social) => social.href !== "");
