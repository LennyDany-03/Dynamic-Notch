import Reveal from "./Reveal";
import {
  Bell,
  Calendar,
  Clipboard,
  Clock,
  Cloud,
  Files,
  Gauge,
  Ghost,
  Grid,
  Music,
  Note,
} from "./icons";

/*
  One card per thing the app ships. The first seven map onto the seven
  `NotchModule` panels in the product source, in the order `MODULES` lists them;
  the rest are what the notch does without a panel of its own.

  **Bodies are one line.** They used to be three or four sentences each, which
  made this section four screens tall — and a visitor deciding whether to
  download something does not read four screens of prose, they scan for the one
  feature they came for. The detail that was cut is not lost: it is in the FAQ,
  where somebody who has already decided goes looking for it.

  If a module is added to `MODULES`, it belongs here too. This section and the
  Settings one are the only two places on the site that claim to be complete.
*/
const features = [
  {
    icon: Music,
    title: "Now playing",
    body: "Art, scrub bar and transport for whatever Windows is playing.",
  },
  {
    icon: Grid,
    title: "Quick launcher",
    body: "Fuzzy search every installed app. Pin the ones you live in.",
  },
  {
    icon: Files,
    title: "File shelf",
    body: "Drag files up to park them, drag them back out anywhere.",
  },
  {
    icon: Bell,
    title: "Notifications",
    body: "They drop down here instead of the corner, and wait to be read.",
  },
  {
    icon: Gauge,
    title: "System monitor",
    body: "CPU, memory, GPU, disk and temperature — plus sleep and shut down.",
  },
  {
    icon: Cloud,
    title: "Weather",
    body: "Conditions now and the rest of the week, for a town you pick.",
  },
  {
    icon: Calendar,
    title: "Calendar",
    body: "A month at a glance, and a nudge when a reminder comes round.",
  },
  {
    icon: Note,
    title: "Quick notes",
    body: "A scratchpad one hover away that saves as you type.",
  },
  {
    icon: Clipboard,
    title: "Clipboard history",
    body: "The last things you copied. Click one to copy it again.",
  },
  {
    icon: Clock,
    title: "A clock at rest",
    body: "Collapsed, it is the time and your battery. Nothing else.",
  },
  {
    icon: Ghost,
    title: "Invisible when idle",
    body: "No taskbar button, no Alt-Tab entry, click-through everywhere.",
  },
];

export default function Features() {
  return (
    <section id="features" className="relative border-t border-white/[.06] py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-2xl">
          <p className="section-label">Panels</p>
          <h2 className="mt-4 text-[clamp(2rem,4.4vw,3rem)] leading-[1.1] font-semibold tracking-[-0.03em]">
            Everything you reach for all day,
            <span className="text-[var(--faint)]"> in one gesture.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-[var(--muted)]">
            Seven panels, each a page of the same card. Arrows or a scroll move
            between them and it morphs to fit. Keep the ones you use, drag them
            into the order you want.
          </p>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map(({ icon: Icon, title, body }, i) => (
            <Reveal
              key={title}
              /*
                Stagger across the row rather than down the list: at four columns
                a flat `i * 40` would take a second and a half to finish the last
                row, long after the reader has moved on. Modulo the column count
                so every row starts its own short cascade.
              */
              delay={(i % 4) * 55}
              className="h-full"
            >
              <article className="pane group h-full rounded-2xl p-5 transition-colors duration-300 hover:border-[var(--hairline-bright)]">
                <div className="relative z-[1] flex h-full flex-col">
                  <span className="inline-grid h-9 w-9 place-items-center rounded-lg border border-[var(--hairline)] bg-white/[.05] text-[var(--accent-bright)] transition-colors duration-300 group-hover:bg-[var(--accent)] group-hover:text-white">
                    <Icon width={17} height={17} />
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold tracking-tight">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--muted)]">
                    {body}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        {/*
          The three things that arrive without being asked for. A line rather
          than three more cards — they are not panels, and giving them the same
          shape as one would say they were.
        */}
        <Reveal delay={120}>
          <p className="mt-8 text-center text-[14px] leading-relaxed text-[var(--faint)]">
            And some things never wait to be asked for — a track starting, a
            notification landing, a reminder falling due, a charger going in, or
            your machine struggling.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
