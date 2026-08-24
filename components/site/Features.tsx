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

const features = [
  {
    icon: Music,
    title: "Now playing",
    body: "A track starts. Skip it without touching the taskbar.",
  },
  {
    icon: Grid,
    title: "Quick launcher",
    body: "You need an app right now. Type three letters, it's open.",
  },
  {
    icon: Files,
    title: "File shelf",
    body: "A file needs to go somewhere else first. Drag it up, drop it later.",
  },
  {
    icon: Bell,
    title: "Notifications",
    body: "Something lands in the Action Center. It surfaces here first, then files itself away.",
  },
  {
    icon: Gauge,
    title: "System monitor",
    body: "The fan kicks in. Check what's actually using the CPU before you blame Chrome.",
  },
  {
    icon: Cloud,
    title: "Weather",
    body: "You're deciding on a jacket. It's already answered.",
  },
  {
    icon: Calendar,
    title: "Calendar",
    body: "A reminder's about to fire. You see it before it interrupts you.",
  },
  {
    icon: Note,
    title: "Quick notes",
    body: "A thought worth keeping. Type it before it's gone. No app to open first.",
  },
  {
    icon: Clipboard,
    title: "Clipboard history",
    body: "You copied the wrong thing two steps ago. It's still in there.",
  },
  {
    icon: Clock,
    title: "A clock at rest",
    body: "You just want the time. That's all it shows until you ask for more.",
  },
  {
    icon: Ghost,
    title: "Invisible when idle",
    body: "You're not touching it. It's not touching your taskbar, Alt-Tab, or anything else.",
  },
];

export default function Features() {
  return (
    <section id="features" className="relative py-[clamp(56px,9vw,104px)]">
      <div className="mx-auto max-w-[1080px] px-[22px]">
        <div className="max-w-2xl">
          <p className="t-eyebrow">Panels</p>
          <h2 className="t-title mt-3">
            See what&rsquo;s happening
            <span className="text-[var(--heading-tint)]"> without losing focus.</span>
          </h2>
          <p className="t-lede mt-5">
            Seven panels, each a page of the same card. Arrows or a scroll move
            between them and it morphs to fit. Keep the ones you use, drag them
            into the order you want.
          </p>
        </div>

        
        <div className="panel mt-11 overflow-hidden">
          <div className="grid gap-px bg-[var(--hairline)] sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, body }, i) => (
              <Reveal
                key={title}
                
                delay={(i % 3) * 55}
                className="bg-[var(--surface)]"
              >
                <article className="group flex h-full gap-4 px-6 py-6 transition-colors duration-200 hover:bg-[var(--surface-raised)]">
                  
                  <span className="mt-0.5 shrink-0 text-[var(--text-tertiary)] transition-colors duration-200 group-hover:text-[var(--accent-bright)]">
                    <Icon width={20} height={20} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="t-heading">{title}</h3>
                    <p className="mt-1 text-[13.5px] leading-[1.6] text-[var(--text-secondary)]">
                      {body}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
            
            <div aria-hidden className="hidden bg-[var(--surface)] sm:block" />
          </div>
        </div>

        
        <Reveal delay={120}>
          <p className="mx-auto mt-7 max-w-xl text-center text-[13.5px] leading-[1.7] text-[var(--text-tertiary)]">
            And some things never wait to be asked for: a track starting, a
            notification landing, a reminder falling due, a charger going in, or
            your machine struggling.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
