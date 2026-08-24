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
    <footer className="border-t border-[var(--hairline)] py-14">
      <div className="mx-auto max-w-[1080px] px-[22px]">
        <div className="flex flex-col gap-12 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <Logo size={24} />
            <p className="mt-4 text-[13.5px] leading-[1.7] text-[var(--text-tertiary)]">
              A dynamic notch for Windows. Music, notifications, apps,
              clipboard, files and notes, one hover away.
            </p>

            
            <ul className="mt-6 flex flex-wrap gap-1">
              {activeSocials.map((social) => {
                const Icon = SOCIAL_ICONS[social.id];
                return (
                  <li key={social.id}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`${site.name} on ${social.label}`}
                      className="grid h-11 w-11 place-items-center rounded-[var(--r-pill)] text-[var(--text-tertiary)] transition-colors duration-200 hover:bg-[var(--surface-raised)] hover:text-[var(--text)]"
                    >
                      <Icon width={17} height={17} />
                    </a>
                  </li>
                );
              })}
              <li>
                <a
                  href={site.discord}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`${site.name} on Discord`}
                  className="grid h-11 w-11 place-items-center rounded-[var(--r-pill)] text-[var(--text-tertiary)] transition-colors duration-200 hover:bg-[var(--surface-raised)] hover:text-[var(--discord)]"
                >
                  <Discord width={17} height={17} />
                </a>
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-x-16 gap-y-10">
            {columns.map((column) => (
              <div key={column.heading}>
                <p className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--text)]">
                  {column.heading}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        {...(link.external
                          ? { target: "_blank", rel: "noreferrer noopener" }
                          : {})}
                        className="text-[13.5px] text-[var(--text-secondary)] transition-colors duration-200 hover:text-[var(--text)]"
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

        <div className="mt-12 flex flex-col gap-3 border-t border-[var(--hairline)] pt-6 text-[12.5px] text-[var(--text-faint)] sm:flex-row sm:items-center sm:justify-between">
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
              className="text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--text)] hover:underline"
            >
              {site.author}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
