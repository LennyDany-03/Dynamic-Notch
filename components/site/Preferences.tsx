import {
  Bell,
  BellOff,
  Contrast,
  Layers,
  Position,
  Sliders,
  Target,
} from "./icons";
import type { SVGProps } from "react";

interface Preference {
  icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
  title: string;
  body: string;
  /** Present on the one preference that is a segmented picker, not a switch. */
  options?: string[];
  /** Present on the one preference that is a slider. Its default value. */
  meter?: number;
  span?: string;
}

/*
  The Settings window, section by section.

  These are the six preferences that exist — one card each, in the order the
  app draws them (General, then Notifications), so somebody comparing the page
  to the window in front of them finds the rows in the same sequence. The
  bodies say what turning each one *off* costs, which is the thing a switch
  never tells you and the thing a visitor is actually deciding.

  If a preference is added to `useSettings.ts`, it belongs here too — this list
  is the only place on the site that claims to be complete.
*/
/*
  `cols` is per group because the two groups have different item counts and a
  shared three-column grid leaves the two-item Notifications group with a hole
  in it. General is three wide and its spans add up to two full rows.
*/
const groups: { heading: string; cols: string; items: Preference[] }[] = [
  {
    heading: "General",
    cols: "sm:grid-cols-2 lg:grid-cols-3",
    items: [
      {
        icon: Position,
        title: "Position",
        body: "Put the notch at the left, centre or right of your top edge. Everything moves with it, the strip you hover to summon it included — so a centred taskbar clock or an ultrawide monitor stops being a reason not to run it.",
        /* The one preference with discrete options, so the card shows them. */
        options: ["Left", "Center", "Right"],
        span: "lg:col-span-2",
      },
      {
        icon: Target,
        title: "Show me where it is",
        body: "Marks the top edge with a thin line at the exact spot that summons the notch. It disappears the moment the notch comes down, and stays away entirely once the notch is resting on screen. Turn it off once you know where to point.",
      },
      {
        icon: Layers,
        title: "Always on top",
        body: "Keeps the pill on screen and above other windows, so it is there without reaching for it. Off means it stays hidden until your cursor finds it — and it still opens in front of whatever you are working in, then drops back behind once it closes.",
      },
      {
        icon: Contrast,
        title: "Background opacity",
        body: "A slider for how much of what is behind the notch shows through it. Glass over a wallpaper, solid over a text editor — every Mica surface follows it, including this app's own tray menu and settings window.",
        /* Mirrors OPACITY in useSettings.ts. */
        meter: 92,
        span: "lg:col-span-2",
      },
    ],
  },
  {
    heading: "Notifications",
    cols: "sm:grid-cols-2",
    items: [
      {
        icon: Bell,
        title: "Notifications in the notch",
        body: "Anything Windows notifies you about drops down from the notch for a few seconds, carrying the app's own icon, then gets out of the way. Hovering holds it there while you read. Needs \"Let apps access your notifications\" turned on in Windows.",
      },
      {
        icon: BellOff,
        title: "Mute Windows' own banners",
        body: "Stops Windows drawing its pop-up in the bottom-right corner, so a notification appears in the notch and nowhere else. It still lands in the notification centre, and Windows gets its banners back the moment you turn this off or quit Crest.",
      },
    ],
  },
];

/** The 0–100 slider, drawn at its default. Decoration — the real one is in the app. */
function Meter({ value }: { value: number }) {
  return (
    <div className="mt-5 flex items-center gap-3" aria-hidden>
      <div className="relative h-1.5 flex-1 rounded-full bg-white/[.08]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]"
          style={{ width: `${value}%` }}
        />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,.5)]"
          style={{ left: `${value}%` }}
        />
      </div>
      <span className="w-9 text-right font-mono text-[12px] text-[var(--faint)]">
        {value}%
      </span>
    </div>
  );
}

/** The three-up segmented picker, with the shipped default selected. */
function Segments({ options }: { options: string[] }) {
  return (
    <div
      className="mt-5 inline-flex rounded-xl border border-[var(--hairline)] bg-white/[.03] p-1"
      aria-hidden
    >
      {options.map((option, i) => (
        <span
          key={option}
          className={`rounded-lg px-4 py-1.5 text-[13px] ${
            i === 1
              ? "bg-[var(--accent)] font-medium text-white"
              : "text-[var(--muted)]"
          }`}
        >
          {option}
        </span>
      ))}
    </div>
  );
}

export default function Preferences() {
  return (
    <section
      id="settings"
      className="relative border-t border-white/[.06] py-24"
    >
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-2xl">
          <p className="section-label">Settings</p>
          <h2 className="mt-4 text-[clamp(2rem,4.4vw,3rem)] leading-[1.1] font-semibold tracking-[-0.03em]">
            Six switches,
            <span className="text-[var(--faint)]"> no config file.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-[var(--muted)]">
            Crest works the moment it installs, so none of this is setup — it is
            what you change once you have lived with it for a week. Open Settings
            from the tray icon; every change lands immediately and survives the
            next launch.
          </p>
        </div>

        <div className="mt-14 space-y-12">
          {groups.map((group) => (
            <div key={group.heading}>
              <p className="section-label flex items-center gap-3">
                <span
                  aria-hidden
                  className="h-px w-6 bg-[var(--hairline-bright)]"
                />
                {group.heading}
              </p>

              <div className={`mt-6 grid gap-4 ${group.cols}`}>
                {group.items.map((item) => (
                  <article
                    key={item.title}
                    className={`pane group rounded-2xl p-6 transition-colors duration-300 hover:border-[var(--hairline-bright)] ${item.span ?? ""}`}
                  >
                    <div className="relative z-[1]">
                      <div className="flex items-center justify-between gap-4">
                        <span className="inline-grid h-11 w-11 place-items-center rounded-xl border border-[var(--hairline)] bg-white/[.05] text-[var(--accent-bright)] transition-colors duration-300 group-hover:bg-[var(--accent)] group-hover:text-white">
                          <item.icon width={20} height={20} />
                        </span>

                        {/* Rows with their own control don't get a switch too. */}
                        {item.meter === undefined && !item.options && (
                          <span
                            aria-hidden
                            className="relative h-6 w-11 shrink-0 rounded-full bg-[var(--accent)]"
                          >
                            <span className="absolute top-1/2 right-1 h-4 w-4 -translate-y-1/2 rounded-full bg-white" />
                          </span>
                        )}
                      </div>

                      <h3 className="mt-5 text-[17px] font-semibold tracking-tight">
                        {item.title}
                      </h3>
                      <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--muted)]">
                        {item.body}
                      </p>

                      {item.options && <Segments options={item.options} />}
                      {item.meter !== undefined && <Meter value={item.meter} />}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pane mt-4 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center">
          <span className="relative z-[1] inline-grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--hairline)] bg-white/[.05] text-[var(--accent-bright)]">
            <Sliders width={20} height={20} />
          </span>
          <p className="relative z-[1] text-[14.5px] leading-relaxed text-[var(--muted)]">
            <span className="font-medium text-white">
              Everything lives in one window.
            </span>{" "}
            Settings opens from the tray icon with a sidebar — what the app is on
            one page, the switches on the other — so nothing is buried behind a
            pitch you have already read.
          </p>
        </div>
      </div>
    </section>
  );
}
