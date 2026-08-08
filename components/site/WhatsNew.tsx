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

/*
  The "What's new" dialog.

  It opens by itself once per released version and can be reopened at any time
  from the header or the hero badge. Notes come from the repo's CHANGELOG.md via
  `lib/changelog` — parsed on the server, passed down as props — so the dialog
  and the GitHub release body are always the same text.

  Any element on the page can open it by dispatching `OPEN_EVENT` on `window`,
  which is why `WhatsNewTrigger` lives here too: the header and hero are Server
  Components and cannot hold a reference to this component's state.
*/

const OPEN_EVENT = "crest:whats-new";

/**
 * Remembers the last version whose notes were shown, not a boolean — a visitor
 * who dismissed 0.3.0 should still be told about 0.4.0, and storing a flag
 * would mean they never hear about a release again.
 */
const SEEN_KEY = "crest:whats-new-seen";

/** Long enough that the dialog reads as arriving, not as blocking the page. */
const AUTO_OPEN_DELAY_MS = 900;

/*
  localStorage throws outright in some privacy modes rather than failing soft,
  and a release-notes popup is not worth taking the page down over. Both sides
  degrade to "always show", which is the safe direction.
*/
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
  } catch {
    /* Nothing to do — the dialog simply greets them again next visit. */
  }
}

/**
 * The dialog's contents are authored markdown, so `**bold**` and `` `code` ``
 * have to survive the trip. This handles those two and nothing else: the
 * changelog is written by hand for this dialog, and a full markdown parser
 * would be a dependency plus an HTML-injection surface for two inline styles.
 */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded-md bg-white/[.07] px-1.5 py-0.5 font-mono text-[.9em] text-[var(--accent-bright)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/** Group headings are free text in the changelog, so unknown ones get a default. */
const GROUP_COLOR: Record<string, string> = {
  new: "var(--accent-bright)",
  added: "var(--accent-bright)",
  fixed: "#34d399",
  changed: "#fbbf24",
  removed: "#f87171",
};

function groupColor(title: string) {
  return GROUP_COLOR[title.toLowerCase()] ?? "var(--muted)";
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
                className="flex gap-3 text-[14.5px] leading-relaxed text-[var(--muted)]"
              >
                <span
                  aria-hidden
                  className="mt-[.6em] h-px w-3 shrink-0 bg-[var(--hairline-bright)]"
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

export default function WhatsNew({ releases }: { releases: Release[] }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  /* Where focus was before the dialog stole it, so it can be handed back. */
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const [latest, ...previous] = releases;

  const close = useCallback(() => setOpen(false), []);

  const show = useCallback(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setOpen(true);
    if (latest) writeSeen(latest.version);
  }, [latest]);

  // Manual opens, from anywhere on the page.
  useEffect(() => {
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, [show]);

  // The once-per-version automatic open.
  useEffect(() => {
    if (!latest || readSeen() === latest.version) return;
    const timer = window.setTimeout(show, AUTO_OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [latest, show]);

  /*
    Modal behaviour: Escape closes, the page behind stops scrolling, and Tab
    cycles inside the panel rather than wandering into the page underneath.
  */
  useEffect(() => {
    if (!open) return;

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

      // The panel itself holds focus on open, so treat it as "before the first".
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
  }, [open, close]);

  if (!latest || !open) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(event) => {
        // Only a click on the backdrop itself — not one bubbling out of the card.
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        tabIndex={-1}
        className="modal-panel pane flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-3xl outline-none sm:max-h-[80vh] sm:rounded-3xl"
      >
        <header className="relative z-[1] flex items-start gap-4 border-b border-white/[.07] p-6 pb-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--hairline)] bg-[var(--accent)]/15 text-[var(--accent-bright)]">
            <Sparkles width={20} height={20} />
          </span>

          <div className="min-w-0 flex-1">
            <h2
              id="whats-new-title"
              className="text-[19px] font-semibold tracking-tight"
            >
              What&rsquo;s new in {site.name}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--faint)]">
              <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-white">
                v{latest.version}
              </span>
              {latest.date && <span>Released {latest.date}</span>}
            </p>
          </div>

          <button
            type="button"
            onClick={close}
            aria-label="Close what's new"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--hairline)] text-[var(--muted)] transition-colors hover:bg-white/[.07] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-bright)]"
          >
            <Close width={16} height={16} />
          </button>
        </header>

        <div className="relative z-[1] flex-1 overflow-y-auto overscroll-contain px-6 py-6">
          {latest.summary.map((paragraph, i) => (
            <p
              key={i}
              className="mb-5 text-[15px] leading-relaxed text-[var(--muted)]"
            >
              {inline(paragraph)}
            </p>
          ))}

          <Groups groups={latest.groups} />

          {previous.length > 0 && (
            <details className="group mt-8 border-t border-white/[.07] pt-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-medium text-[var(--muted)] transition-colors hover:text-white">
                Earlier releases
                <span
                  aria-hidden
                  className="text-[var(--faint)] transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>

              {previous.map((release) => (
                <section key={release.version} className="mt-6">
                  <h3 className="text-[14px] font-semibold tracking-tight text-white">
                    v{release.version}
                    {release.date && (
                      <span className="ml-2 text-[12px] font-normal text-[var(--faint)]">
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

        <footer className="relative z-[1] flex flex-col gap-3 border-t border-white/[.07] p-5 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={site.releases}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-[13.5px] text-[var(--muted)] transition-colors hover:text-white"
          >
            Full release history
            <ArrowRight width={14} height={14} />
          </a>

          <a
            href={site.download}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[var(--accent-bright)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-bright)]"
          >
            <Download width={16} height={16} />
            Get v{latest.version}
          </a>
        </footer>
      </div>
    </div>
  );
}

/**
 * Opens the dialog from anywhere. A plain custom event rather than context, so
 * Server Components can render the trigger without the whole header or hero
 * having to become client-rendered.
 */
export function WhatsNewTrigger({
  children,
  className = "",
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className={className}
      {...rest}
    >
      {children}
    </button>
  );
}
