import { site } from "@/lib/site";

/*
  `<details>` rather than a JS accordion: it works before hydration, it's
  keyboard accessible for free, and search engines index the answers.
*/
const faqs = [
  {
    q: "Does this need a laptop with a physical notch?",
    a: "No. Crest draws its own. It is a transparent overlay pinned to the top edge of your screen — left, centre or right, whichever you pick — so it works on any monitor, including a desktop tower with no notch anywhere in sight.",
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
    q: "How do notifications in the notch work?",
    a: "Crest reads the Windows notification centre, so anything that lands there drops down from the notch for a few seconds with the app's own icon, then retracts. Hover to hold it while you read. Windows needs \"Let apps access your notifications\" turned on — Crest tells you in Settings if it isn't. There is also a panel holding everything currently in the centre, where you can open one in full, dismiss it, or clear the lot.",
  },
  {
    q: "I have two monitors. Which one does it live on?",
    a: "Whichever you want. The Display page in Settings draws the screens you have, arranged the way they actually sit on your desk and numbered to match Windows' own display settings — click one and the notch moves there. Or switch on \"show the notch on every display\" and each monitor gets its own, with the same panels and the same banners. If you unplug the screen you sent it to, the notch moves to your main display until that screen is back; you never have to pick it again.",
  },
  {
    q: "Can I change how it looks?",
    a: "There are five themes — Crest's near-black and violet, cool Glacier, warm Ember, a light Daylight for a bright desktop, and Mono with no colour in it at all. On top of that you can set the accent to any colour you like, and a slider decides how much of your wallpaper shows through. Everything repaints at once: the notch, the tray menu and the settings window.",
  },
  {
    q: "How does it update?",
    a: "By itself. Crest checks shortly after it starts and again through the day, and if there is something newer it downloads and installs it quietly — no installer window, no prompts, no wizard. The only thing you see is a small loader in the notch. Releases are signed, and the full notes for each one are on GitHub and in the app.",
  },
  {
    q: "Can I stop Windows showing its own pop-ups too?",
    a: "Yes — one switch in Settings. Crest turns off the per-app banner for each app that registers one, so a notification appears in the notch and nowhere else. It still lands in the notification centre as normal, and every banner is handed straight back the moment you turn the switch off or quit Crest. Nothing is ever blocked from being delivered.",
  },
  {
    q: "Can I move it, or keep it on screen?",
    a: "Both. Settings puts the notch at the left, centre or right of your top edge — on whichever monitor you choose — and the strip you hover to summon it moves with it. \"Always on top\" keeps the pill resting on screen above your windows instead of hiding, and with it off, a card you open still comes up in front of whatever you are working in, then drops back once it closes. There is also a slider for how transparent the surface is.",
  },
  {
    q: "Where do I report a bug or ask for something?",
    a: "The Discord server is the fastest route — bug reports, changelogs and feature requests all live there, and the person who writes the app reads it. Anything that should outlive a conversation belongs on the GitHub issue tracker instead.",
  },
  {
    q: "Does it phone home?",
    a: "There is no account, no sync service, no telemetry and no analytics. Your clipboard entries, notes and shelved files are written to your local app-data folder and stay there. The whole source is on GitHub if you want to check.",
  },
  {
    q: "Is it heavy?",
    a: "It is a Tauri app, so it uses the WebView that ships with Windows instead of bundling a browser. While the notch is away nothing renders, and the watchers that have to keep listening — what is playing, what has just arrived, what your machine is doing — settle to a check every two seconds. The load meters only speed up while the system panel is actually on screen. Idle cost is close to nothing.",
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
              Still unsure about something? Ask in the{" "}
              <a
                href={site.discord}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[var(--accent-bright)] underline-offset-4 hover:underline"
              >
                Discord
              </a>{" "}
              or{" "}
              <a
                href={`${site.repo}/issues`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[var(--accent-bright)] underline-offset-4 hover:underline"
              >
                open an issue
              </a>{" "}
              — both get answered.
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
