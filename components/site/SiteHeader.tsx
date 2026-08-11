import Logo from "./Logo";
import { Discord, Download, Github, Sparkles } from "./icons";
import { WhatsNewTrigger } from "./WhatsNew";
import { site } from "@/lib/site";

const links = [
  { href: "#features", label: "Features" },
  { href: "#settings", label: "Settings" },
  { href: "#how", label: "How it works" },
  { href: "#community", label: "Community" },
  { href: "#faq", label: "FAQ" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[.06] bg-[#07070b]/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
        <a href="#top" className="shrink-0" aria-label={`${site.name} home`}>
          <Logo />
        </a>

        {/* lg, not md: five links plus three actions do not fit at 768px. */}
        <div className="hidden items-center gap-7 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[14px] text-[var(--muted)] transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/*
            Sits with the actions rather than the nav links: it opens a dialog,
            it does not scroll the page to a section like everything to its left.
          */}
          <WhatsNewTrigger className="mr-1 hidden h-10 items-center gap-2 rounded-xl px-3 text-[14px] text-[var(--muted)] transition-colors hover:text-white sm:inline-flex focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-bright)]">
            <Sparkles width={16} height={16} className="text-[var(--accent-bright)]" />
            What&rsquo;s new
          </WhatsNewTrigger>

          {/*
            Discord sits beside GitHub rather than in the nav: both are places
            to go, not sections of this page. It keeps its brand colour on
            hover — it is the one link on the header that is not about the
            download, and the tint is what says so at a glance.
          */}
          <a
            href={site.discord}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Crest on Discord"
            className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--hairline)] text-[var(--muted)] transition-colors hover:bg-[#5865F2] hover:text-white"
          >
            <Discord width={18} height={18} />
          </a>
          <a
            href={site.repo}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Crest on GitHub"
            className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--hairline)] text-[var(--muted)] transition-colors hover:bg-white/[.06] hover:text-white"
          >
            <Github width={18} height={18} />
          </a>
          <a
            href={site.download}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[14px] font-medium text-white shadow-[0_8px_24px_-10px_rgba(124,58,237,1)] transition-colors hover:bg-[var(--accent-bright)]"
          >
            <Download width={16} height={16} />
            <span className="hidden sm:inline">Download</span>
            <span className="sm:hidden">Get</span>
          </a>
        </div>
      </nav>
    </header>
  );
}
