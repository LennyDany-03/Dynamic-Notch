import { Clipboard, Clock, Gauge } from "./icons";

const things = [
  {
    icon: Clock,
    title: "A timer for the next 25 minutes",
    body: "Set it, forget the app exists, glance at the pill when you need to.",
  },
  {
    icon: Gauge,
    title: "A glance at what's eating your CPU",
    body: "Before you blame the Wi-Fi, check whether it's actually your machine.",
  },
  {
    icon: Clipboard,
    title: "The thing you copied three clicks ago",
    body: "Not the one still on your clipboard. The one before that.",
  },
];

export default function LittleThings() {
  return (
    <section className="relative py-[clamp(48px,8vw,88px)]">
      <div className="mx-auto max-w-[1080px] px-[22px]">
        <div className="max-w-2xl">
          <p className="t-eyebrow">The small stuff</p>
          <h2 className="t-title mt-3">Built for the little things.</h2>
          <p className="t-lede mt-5">
            Not a redesign of how you use your PC: the small stuff that
            happens forty times a day. None of it deserves its own window. All
            of it fits in a strip you already know how to reach.
          </p>
        </div>

        <div className="panel mt-11 overflow-hidden">
          <div className="grid gap-px bg-[var(--hairline)] sm:grid-cols-3">
            {things.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex flex-col gap-3 bg-[var(--surface)] px-6 py-7">
                <span className="text-[var(--text-tertiary)]">
                  <Icon width={20} height={20} />
                </span>
                <div>
                  <h3 className="t-heading">{title}</h3>
                  <p className="mt-1 text-[13.5px] leading-[1.6] text-[var(--text-secondary)]">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
