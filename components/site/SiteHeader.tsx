"use client";

import { useEffect, useState } from "react";
import Logo from "./Logo";
import { Download, ExternalLink } from "./icons";
import { WhatsNewTrigger } from "./WhatsNew";
import { site } from "@/lib/site";

const leftLinks = [{ href: "#top", label: "See Crest" }];
const rightLinks = [{ href: "#faq", label: "FAQ" }];

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const navLink =
    "text-[13px] tracking-[-0.005em] text-[var(--text-secondary)] transition-colors duration-200 hover:text-[var(--text)]";

  const changelogLink = (
    <WhatsNewTrigger className={navLink}>Changelog</WhatsNewTrigger>
  );

  const githubLink = (
    <a
      href={site.repo}
      target="_blank"
      rel="noreferrer noopener"
      className={`inline-flex items-center gap-1 ${navLink}`}
    >
      GitHub
      <ExternalLink width={11} height={11} />
    </a>
  );

  const downloadButton = (
    <a
      href={site.download}
      className="press inline-flex h-9 items-center gap-2 rounded-[var(--r-pill)] bg-[var(--accent)] px-4 text-[13px] font-medium tracking-[-0.005em] text-white transition-colors duration-200 hover:bg-[var(--accent-bright)]"
    >
      <Download width={15} height={15} />
      Download
    </a>
  );

  return (
    <header
      className="glass scroll-edge sticky top-0 z-50"
      data-scrolled={scrolled || open}
    >
      
      <nav className="mx-auto hidden h-14 max-w-[1080px] grid-cols-[1fr_auto_1fr] items-center gap-6 px-[22px] lg:grid">
        <div className="flex items-center gap-8 justify-self-center">
          {leftLinks.map((link) => (
            <a key={link.href} href={link.href} className={navLink}>
              {link.label}
            </a>
          ))}
          {changelogLink}
        </div>

        <a href="#top" className="shrink-0" aria-label={`${site.name} home`}>
          <Logo size={24} withWordmark={false} />
        </a>

        <div className="flex items-center justify-end gap-8">
          <div className="flex items-center gap-8">
            {githubLink}
            {rightLinks.map((link) => (
              <a key={link.href} href={link.href} className={navLink}>
                {link.label}
              </a>
            ))}
          </div>
          {downloadButton}
        </div>
      </nav>

      
      <nav className="mx-auto flex h-14 max-w-[1080px] items-center justify-between gap-6 px-[22px] lg:hidden">
        <a href="#top" className="shrink-0" aria-label={`${site.name} home`}>
          <Logo size={24} />
        </a>

        <div className="flex items-center gap-2">
          {downloadButton}

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="press grid h-9 w-9 place-items-center rounded-[var(--r-pill)] border border-[var(--hairline)] text-[var(--text-secondary)] transition-colors duration-200 hover:text-[var(--text)]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              aria-hidden
            >
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 8h16M4 16h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      
      <div
        className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-[var(--ease-spring)] lg:hidden ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0">
          <ul className="border-t border-[var(--hairline)] px-[22px] py-2">
            <li>
              <a
                href="#top"
                onClick={() => setOpen(false)}
                className="flex h-11 items-center text-[15px] tracking-[-0.01em] text-[var(--text-body)] transition-colors hover:text-[var(--text)]"
              >
                See Crest
              </a>
            </li>
            <li>
              <WhatsNewTrigger
                onClick={() => setOpen(false)}
                className="flex h-11 w-full items-center text-left text-[15px] tracking-[-0.01em] text-[var(--text-body)] transition-colors hover:text-[var(--text)]"
              >
                Changelog
              </WhatsNewTrigger>
            </li>
            <li>
              <a
                href={site.repo}
                target="_blank"
                rel="noreferrer noopener"
                onClick={() => setOpen(false)}
                className="flex h-11 items-center text-[15px] tracking-[-0.01em] text-[var(--text-body)] transition-colors hover:text-[var(--text)]"
              >
                GitHub
              </a>
            </li>
            <li>
              <a
                href="#faq"
                onClick={() => setOpen(false)}
                className="flex h-11 items-center text-[15px] tracking-[-0.01em] text-[var(--text-body)] transition-colors hover:text-[var(--text)]"
              >
                FAQ
              </a>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
