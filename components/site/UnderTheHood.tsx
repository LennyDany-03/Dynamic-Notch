import { Bolt, Ghost, Shield, Windows } from "./icons";

const pillars = [
  {
    icon: Windows,
    title: "Native, not a web app in a box",
    body: "The music, the launcher index, the clipboard listener, the drag-out shelf and the load meters are all real Windows APIs called from Rust. The CPU and GPU figures come from the same performance counters Task Manager reads, so they agree with it rather than approximating it.",
  },
  {
    icon: Bolt,
    title: "Idle costs nothing",
    body: "Nothing renders while the notch is away, and the watchers that have to keep listening (what is playing, what has just arrived, what your machine is doing) settle to a check every two seconds. The meters only speed up while you are looking at them, and the forecast is cached for ten minutes.",
  },
  {
    icon: Shield,
    title: "No account. No clutter.",
    body: "Nothing to sign into, nothing syncing to a server you didn't choose. Clipboard entries, notes, reminders and shelved files live in your local app-data folder and go nowhere else. Only two things ever leave the machine: the update check, and the forecast for the town you typed in yourself.",
  },
  {
    icon: Ghost,
    title: "It stays out of the way.",
    body: "No taskbar icon, no Alt-Tab entry, click-through outside its own bounds: a click meant for the desktop reaches the desktop. It only claims the top of the window stack when there is something on screen to see.",
  },
];

const stack = [
  ["Tauri 2", "Desktop shell"],
  ["Rust", "Native Windows APIs"],
  ["React 19", "Panel UI"],
  ["TypeScript", "End to end"],
  ["Framer Motion", "Spring physics"],
  ["Fluent 2", "Mica design language"],
];

export default function UnderTheHood() {
  return (
    <section id="stack" className="relative py-[clamp(56px,9vw,104px)]">
      <div className="mx-auto max-w-[1080px] px-[22px]">
        <div className="max-w-2xl">
          <p className="t-eyebrow">Under the hood</p>
          <h2 className="t-title mt-3">
            Built like a system tool,
            <span className="text-[var(--heading-tint)]"> not a wrapper.</span>
          </h2>
        </div>

        
        <div className="panel mt-11 overflow-hidden">
          <div className="grid gap-px bg-[var(--hairline)] sm:grid-cols-2">
            {pillars.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4 bg-[var(--surface)] px-7 py-7">
                <span className="mt-0.5 shrink-0 text-[var(--text-tertiary)]">
                  <Icon width={20} height={20} />
                </span>
                <div className="min-w-0">
                  <h3 className="t-heading">{title}</h3>
                  <p className="t-body mt-1.5">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        
        <dl className="mt-7 flex flex-wrap items-baseline gap-x-7 gap-y-2 border-t border-[var(--hairline)] pt-6">
          {stack.map(([name, role]) => (
            <div key={name} className="flex items-baseline gap-2">
              <dt className="text-[13px] font-medium tracking-[-0.005em] text-[var(--text-body)]">
                {name}
              </dt>
              <dd className="text-[12.5px] text-[var(--text-faint)]">{role}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
