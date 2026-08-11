import { Bolt, Ghost, Shield, Windows } from "./icons";

const pillars = [
  {
    icon: Windows,
    title: "Native, not a web app in a box",
    body: "The music, the launcher index, the clipboard listener and the drag-out shelf are all real Windows APIs called from Rust. There is no polling of a browser shim in between.",
  },
  {
    icon: Bolt,
    title: "Idle costs nothing",
    body: "Nothing renders while the notch is away, and the two things that must keep listening — what is playing, and what has just arrived — drop to a check every two seconds. Everything else happens only in the seconds you are looking at it.",
  },
  {
    icon: Shield,
    title: "Your data stays put",
    body: "No account, no sync, no telemetry, no analytics. Clipboard entries, notes and shelved files live in your local app-data folder and go nowhere else.",
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
