import { site } from "@/lib/site";

/*
  `<details>` rather than a JS accordion: it works before hydration, it's
  keyboard accessible for free, and search engines index the answers.
*/
const faqs = [
  {
    q: "Does this need a laptop with a physical notch?",
    a: "No. Crest draws its own. It is a transparent, always-on-top window pinned to the top-centre of your screen, so it works on any monitor — including several, and including a desktop tower with no notch anywhere in sight.",
  },
  {
    q: "Will it get in the way of my windows?",
    a: "It sits above them, but only where it is actually drawing. Everywhere else the overlay is click-through, so a click aimed at a maximised window or the desktop passes right through it. It is also skipped from the taskbar and from Alt-Tab.",
  },
  {
    q: "Which music apps work?",
    a: "Anything that reports to the Windows media session — Spotify, Apple Music, Groove, VLC, and media playing in Edge, Chrome or Firefox. Crest reads the same source the volume flyout uses, so if Windows knows about it, Crest does.",
  },
  {
    q: "Does it phone home?",
    a: "There is no account, no sync service, no telemetry and no analytics. Your clipboard entries, notes and shelved files are written to your local app-data folder and stay there. The whole source is on GitHub if you want to check.",
  },
  {
    q: "Is it heavy?",
    a: "It is a Tauri app, so it uses the WebView that ships with Windows instead of bundling a browser. While the notch is hidden nothing renders and the media poll stops entirely, so idle cost is close to nothing.",
  },
  {
    q: "How do I get rid of it?",
    a: "Uninstall it from Windows Settings like any other app. Auto-start is registered through the standard Windows mechanism and is removed along with it.",
  },
  {
    q: "Is it really free?",
    a: "Yes — MIT licensed and open source. No trial, no pro tier, no upsell. If it saves you time, a star on the repo is plenty.",
  },
];

export default function Faq() {
  return (
    <section id="faq" className="relative border-t border-white/[.06] py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="section-label">Questions</p>
            <h2 className="mt-4 text-[clamp(2rem,4.4vw,3rem)] leading-[1.1] font-semibold tracking-[-0.03em]">
              Before you install.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-[var(--muted)]">
              Still unsure about something?{" "}
              <a
                href={`${site.repo}/issues`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[var(--accent-bright)] underline-offset-4 hover:underline"
              >
                Open an issue
              </a>{" "}
              and it gets answered.
            </p>
          </div>

          <div className="divide-y divide-white/[.07] border-y border-white/[.07]">
            {faqs.map((faq) => (
              <details key={faq.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[16px] font-medium tracking-tight transition-colors hover:text-[var(--accent-bright)]">
                  {faq.q}
                  <span
                    aria-hidden
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--hairline)] text-[var(--muted)] transition-transform duration-300 group-open:rotate-45"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-[var(--muted)]">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
