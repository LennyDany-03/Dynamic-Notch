import Logo from "./Logo";
import { Discord, SOCIAL_ICONS } from "./icons";
import { activeSocials, site } from "@/lib/site";

const columns = [
  {
    heading: "Product",
    links: [
      { href: "#features", label: "Features", external: false },
      { href: "#settings", label: "Settings", external: false },
      { href: "#how", label: "How it works", external: false },
      { href: "#stack", label: "Under the hood", external: false },
      { href: "#download", label: "Download", external: false },
    ],
  },
  {
    heading: "Project",
    links: [
      { href: site.repo, label: "Source code", external: true },
      { href: site.releases, label: "Releases", external: true },
      { href: `${site.repo}/issues`, label: "Report an issue", external: true },
      { href: `${site.repo}/blob/main/LICENSE`, label: "MIT license", external: true },
    ],
  },
  {
    heading: "Community",
    links: [
      { href: site.discord, label: "Discord server", external: true },
      { href: "#community", label: "Where to find us", external: false },
      { href: `${site.repo}/discussions`, label: "Discussions", external: true },
      { href: `${site.repo}/issues/new`, label: "Request a feature", external: true },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/[.06] py-14">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-col gap-12 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-[14px] leading-relaxed text-[var(--faint)]">
              A dynamic notch for Windows. Music, notifications, apps,
              clipboard, files and notes — one hover away.
            </p>
            <a
              href={site.discord}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[var(--hairline)] px-3.5 py-2 text-[13px] text-[var(--muted)] transition-colors hover:border-transparent hover:bg-[#5865F2] hover:text-white"
            >
              <Discord width={15} height={15} />
              Join the community
            </a>

            {/*
              Icon row, drawn from `activeSocials` — an account with no URL yet
              is filtered out in `lib/site.ts`, so nothing here is ever a dead
              link waiting for a handle.
            */}
            <ul className="mt-6 flex flex-wrap gap-2">
              {activeSocials.map((social) => {
                const Icon = SOCIAL_ICONS[social.id];
                return (
                  <li key={social.id}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`${site.name} on ${social.label}`}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--hairline)] text-[var(--faint)] transition-colors hover:border-[var(--hairline-bright)] hover:bg-white/[.06] hover:text-white"
                    >
                      <Icon width={17} height={17} />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-wrap gap-x-16 gap-y-10">
            {columns.map((column) => (
              <div key={column.heading}>
                <p className="section-label">{column.heading}</p>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        {...(link.external
                          ? { target: "_blank", rel: "noreferrer noopener" }
                          : {})}
                        className="text-[14px] text-[var(--muted)] transition-colors hover:text-white"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/[.06] pt-6 text-[13px] text-[var(--faint)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name}. Not affiliated with
            Microsoft or Apple.
          </p>
          <p>
            Built by{" "}
            <a
              href={site.authorUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[var(--muted)] underline-offset-4 hover:text-white hover:underline"
            >
              {site.author}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
