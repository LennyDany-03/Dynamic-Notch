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
    body: "Nothing renders while the notch is away, and the watchers that have to keep listening — what is playing, what has just arrived, what your machine is doing — settle to a check every two seconds. The meters only speed up while you are looking at them, and the forecast is cached for ten minutes.",
  },
  {
    icon: Shield,
    title: "Your data stays put",
    body: "No account, no sync, no telemetry, no analytics. Clipboard entries, notes, reminders and shelved files live in your local app-data folder and go nowhere else. Only two things ever leave the machine: the update check, and the forecast for the town you typed in yourself.",
  },
  {
    icon: Ghost,
    title: "It respects your desktop",
    body: "Transparent, skipped from the taskbar and from Alt-Tab, and click-through outside its own bounds — so a click meant for the desktop reaches the desktop. It only claims the top of the window stack when there is something on screen to see.",
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
    <section id="stack" className="relative border-t border-white/[.06] py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-2xl">
          <p className="section-label">Under the hood</p>
          <h2 className="mt-4 text-[clamp(2rem,4.4vw,3rem)] leading-[1.1] font-semibold tracking-[-0.03em]">
            Built like a system tool,
            <span className="text-[var(--faint)]"> not a wrapper.</span>
          </h2>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {pillars.map(({ icon: Icon, title, body }) => (
            <div key={title} className="pane rounded-2xl p-7">
              <div className="relative z-[1] flex gap-4">
                <span className="mt-0.5 shrink-0 text-[var(--accent-bright)]">
                  <Icon width={22} height={22} />
                </span>
                <div>
                  <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--muted)]">
                    {body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <ul className="mt-4 flex flex-wrap gap-2">
          {stack.map(([name, role]) => (
            <li
              key={name}
              className="inline-flex items-baseline gap-2 rounded-xl border border-[var(--hairline)] bg-white/[.03] px-4 py-2.5"
            >
              <span className="text-[14px] font-medium">{name}</span>
              <span className="text-[12.5px] text-[var(--faint)]">{role}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
