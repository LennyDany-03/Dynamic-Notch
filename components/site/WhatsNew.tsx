"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { ArrowRight, Close, Download, Sparkles } from "./icons";
import { site } from "@/lib/site";
import type { Release } from "@/lib/changelog";

const OPEN_EVENT = "crest:whats-new";

const SEEN_KEY = "crest:whats-new-seen";

const AUTO_OPEN_DELAY_MS = 900;

function readSeen(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeen(version: string) {
  try {
    window.localStorage.setItem(SEEN_KEY, version);
  } catch {}
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[var(--text)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded-[var(--r-chip)] bg-[var(--surface-hover)] px-1.5 py-0.5 font-mono text-[.9em] text-[var(--accent-bright)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

const GROUP_COLOR: Record<string, string> = {
  new: "var(--accent-bright)",
  added: "var(--accent-bright)",
  fixed: "#34d399",
  changed: "#fbbf24",
  removed: "#f87171",
};

function groupColor(title: string) {
  return GROUP_COLOR[title.toLowerCase()] ?? "var(--text-secondary)";
}

function Groups({ groups }: { groups: Release["groups"] }) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.title} className="mt-6 first:mt-0">
          <p
            className="flex items-center gap-2 text-[11px] font-semibold tracking-[.14em] uppercase"
            style={{ color: groupColor(group.title) }}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "currentColor" }}
            />
            {group.title}
          </p>
          <ul className="mt-3 space-y-2.5">
            {group.items.map((item, i) => (
              <li
                key={i}
                className="flex gap-3 text-[14.5px] leading-[1.7] text-[var(--text-body)]"
              >
                <span
                  aria-hidden
                  className="mt-[.6em] h-px w-3 shrink-0 bg-[var(--hairline-strong)]"
                />
                <span>{inline(item)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

export default function WhatsNew({
  releases,
  autoOpen = true,
}: {
  releases: Release[];
  /**
   * Whether an unseen release opens the modal by itself.
   *
   * True on the home page, which is what the auto-open is for. False everywhere
   * else: the privacy and contact pages mount this only so the header's
   * Changelog button has a listener, and a changelog springing up unasked over
   * a privacy policy is the one place that surprise is actually costly — the
   * Store submission points a reviewer straight at that URL.
   */
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const entranceFrameRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const [latest, ...previous] = releases;

  const close = useCallback(() => {
    if (entranceFrameRef.current !== null) {
      cancelAnimationFrame(entranceFrameRef.current);
      entranceFrameRef.current = null;
    }

    setOpen(false);
    setShown(false);

    if (!mounted) return;
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
    }
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      setMounted(false);
    }, 300);
  }, [mounted]);

  const show = useCallback(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    if (!open) {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      setMounted(true);
      setShown(false);
      setOpen(true);
      entranceFrameRef.current = requestAnimationFrame(() => {
        entranceFrameRef.current = null;
        setShown(true);
      });
    }
    if (latest) writeSeen(latest.version);
  }, [latest, open]);

  useEffect(
    () => () => {
      if (entranceFrameRef.current !== null) {
        cancelAnimationFrame(entranceFrameRef.current);
      }
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, [show]);

  useEffect(() => {
    if (!autoOpen) return;
    if (!latest || readSeen() === latest.version) return;
    const timer = window.setTimeout(show, AUTO_OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoOpen, latest, show]);

  
  useEffect(() => {
    if (!open || !mounted) return;

    const panel = panelRef.current;
    panel?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab" || !panel) return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [open, mounted, close]);

  if (!latest || !mounted) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
      data-open={shown}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        tabIndex={-1}
        data-open={shown}
        className="modal-panel flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-[var(--r-hero)] outline-none sm:max-h-[80vh] sm:rounded-[var(--r-hero)]"
      >
        <header className="flex items-start gap-4 border-b border-[var(--hairline)] p-6 pb-5">
          <span className="mt-0.5 shrink-0 text-[var(--accent-bright)]">
            <Sparkles width={20} height={20} />
          </span>

          <div className="min-w-0 flex-1">
            <h2
              id="whats-new-title"
              className="text-[19px] font-semibold tracking-[-0.02em]"
            >
              What&rsquo;s new in {site.name}
            </h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--text-tertiary)]">
              <span className="tnum rounded-[var(--r-pill)] bg-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-white">
                v{latest.version}
              </span>
              {latest.date && <span>Released {latest.date}</span>}
            </p>
          </div>

          <button
            type="button"
            onClick={close}
            aria-label="Close what's new"
            className="press grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r-pill)] text-[var(--text-secondary)] transition-colors duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
          >
            <Close width={16} height={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-6">
          {latest.summary.map((paragraph, i) => (
            <p
              key={i}
              className="mb-5 text-[15px] leading-[1.75] text-[var(--text-body)]"
            >
              {inline(paragraph)}
            </p>
          ))}

          <Groups groups={latest.groups} />

          {previous.length > 0 && (
            <details className="group mt-8 border-t border-[var(--hairline)] pt-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]">
                Earlier releases
                <span
                  aria-hidden
                  className="text-[var(--text-faint)] transition-transform duration-300 ease-[var(--ease-out-quart)] group-open:rotate-45"
                >
                  +
                </span>
              </summary>

              {previous.map((release) => (
                <section key={release.version} className="mt-6">
                  <h3 className="tnum text-[14px] font-semibold tracking-[-0.015em] text-[var(--text)]">
                    v{release.version}
                    {release.date && (
                      <span className="ml-2 text-[12px] font-normal text-[var(--text-tertiary)]">
                        {release.date}
                      </span>
                    )}
                  </h3>
                  <div className="mt-3">
                    <Groups groups={release.groups} />
                  </div>
                </section>
              ))}
            </details>
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-[var(--hairline)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={site.releases}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-[13.5px] text-[var(--text-secondary)] transition-colors duration-200 hover:text-[var(--text)]"
          >
            Full release history
            <ArrowRight width={14} height={14} />
          </a>

          <a
            href={site.download}
            className="press inline-flex h-11 items-center justify-center gap-2 rounded-[var(--r-pill)] bg-[var(--accent)] px-5 text-[14px] font-medium text-white transition-colors duration-200 hover:bg-[var(--accent-bright)]"
          >
            <Download width={16} height={16} />
            Get v{latest.version}
          </a>
        </footer>
      </div>
    </div>
  );
}

export function WhatsNewTrigger({
  children,
  className = "",
  onClick,
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="button"
      onClick={(event) => {
        window.dispatchEvent(new Event(OPEN_EVENT));
        onClick?.(event);
      }}
      className={className}
      {...rest}
    >
      {children}
    </button>
  );
}
