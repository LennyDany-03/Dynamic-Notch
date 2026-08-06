import Logo from "./Logo";
import { Github } from "./icons";
import { site } from "@/lib/site";

const columns = [
  {
    heading: "Product",
    links: [
      { href: "#features", label: "Features", external: false },
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
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/[.06] py-14">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-col gap-12 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-[14px] leading-relaxed text-[var(--faint)]">
              A dynamic notch for Windows. Music, apps, clipboard, files and
              notes — one hover away.
            </p>
            <a
              href={site.repo}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[var(--hairline)] px-3.5 py-2 text-[13px] text-[var(--muted)] transition-colors hover:bg-white/[.05] hover:text-white"
            >
              <Github width={15} height={15} />
              Star on GitHub
            </a>
          </div>

          <div className="flex gap-16">
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
