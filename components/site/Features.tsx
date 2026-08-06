import { Clipboard, Clock, Files, Ghost, Grid, Music, Note } from "./icons";

/*
  One card per thing the app actually ships today. Nothing aspirational — the
  panels listed here map 1:1 onto `NotchModule` in the product source.
*/
const features = [
  {
    icon: Music,
    title: "Now playing, always",
    body: "Reads the Windows media session directly, so whatever is playing shows up — Spotify, YouTube in a browser tab, a local file. Album art, a live scrub bar, and transport controls that actually control it.",
    span: "lg:col-span-2",
  },
  {
    icon: Grid,
    title: "Quick launcher",
    body: "Every installed app, indexed once and searched fuzzily. Start typing and the results take over the whole card.",
  },
  {
    icon: Clipboard,
    title: "Clipboard history",
    body: "The last things you copied, kept where your cursor already is. Click to put one back on the clipboard.",
  },
  {
    icon: Files,
    title: "File shelf",
    body: "Drag a file at the top of the screen and the shelf opens to meet it. Park things there while you move between apps, then drag them straight back out.",
  },
  {
    icon: Note,
    title: "Quick notes",
    body: "A scratchpad that is always one hover away and saves as you type. No file, no save button, no window to find again.",
    span: "lg:col-span-2",
  },
  {
    icon: Clock,
    title: "A clock at rest",
    body: "Collapsed, the pill is a clock with an equalizer beside it — useful even when you want nothing from it.",
  },
  {
    icon: Ghost,
    title: "Invisible when idle",
    body: "No taskbar button, no window in Alt-Tab, and click-through everywhere it isn't drawing. Your desktop keeps every pixel it had.",
  },
];

export default function Features() {
  return (
    <section id="features" className="relative border-t border-white/[.06] py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-2xl">
          <p className="section-label">Panels</p>
          <h2 className="mt-4 text-[clamp(2rem,4.4vw,3rem)] leading-[1.1] font-semibold tracking-[-0.03em]">
            Five things you reach for all day,
            <span className="text-[var(--faint)]"> in one gesture.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-[var(--muted)]">
            Each panel is a page of the same card. Arrows on either side of the
            title move between them, and the card morphs to fit — it never
            collapses and reopens.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body, span }) => (
            <article
              key={title}
              className={`pane group rounded-2xl p-6 transition-colors duration-300 hover:border-[var(--hairline-bright)] ${span ?? ""}`}
            >
              <div className="relative z-[1]">
                <span className="inline-grid h-11 w-11 place-items-center rounded-xl border border-[var(--hairline)] bg-white/[.05] text-[var(--accent-bright)] transition-colors duration-300 group-hover:bg-[var(--accent)] group-hover:text-white">
                  <Icon width={20} height={20} />
                </span>
                <h3 className="mt-5 text-[17px] font-semibold tracking-tight">
                  {title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--muted)]">
                  {body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
