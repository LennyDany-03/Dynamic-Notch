"use client";

import { useState, type SVGProps } from "react";
import Reveal from "./Reveal";
import {
  Bell,
  BellOff,
  Cloud,
  Contrast,
  Displays,
  Droplet,
  Gauge,
  Layers,
  List,
  Palette,
  Position,
  Screen,
  Sliders,
  Target,
  Windows,
} from "./icons";

type Control = "switch" | "segments" | "meter" | "swatches" | "chips" | "screens" | "none";

interface Preference {
  icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
  title: string;
  body: string;
  control: Control;
  
  options?: string[];
  selected?: number;
  
  meter?: number;
  
  swatches?: string[];
  
  chips?: string[];
}

const groups: {
  id: string;
  tab: string;
  cols: string;
  fillers?: string[];
  items: Preference[];
}[] = [
  {
    id: "look",
    tab: "Panels & colour",
    cols: "sm:grid-cols-2",
    items: [
      {
        icon: List,
        title: "Choose your panels",
        body: "Switch off the ones you don't use and drag the rest into the order you want.",
        control: "chips",
        chips: ["Media", "Launcher", "Shelf", "Calendar", "+3"],
      },
      {
        icon: Palette,
        title: "Five themes",
        body: "Crest, Glacier, Ember, Daylight and Mono. One repaints every window at once.",
        control: "swatches",
        
        swatches: ["#7C3AED", "#6FB1D9", "#E8934A", "#2F6FED", "#F0F0F0"],
      },
      {
        icon: Droplet,
        title: "Accent colour",
        body: "Eight to pick from, or type your own hex. Everything active is drawn in it.",
        control: "swatches",
        
        swatches: [
          "#7C3AED",
          "#2563EB",
          "#0891B2",
          "#059669",
          "#CA8A04",
          "#EA580C",
          "#DC2626",
          "#DB2777",
        ],
      },
      {
        icon: Contrast,
        title: "Background opacity",
        body: "How much of your wallpaper shows through. Every Mica surface follows it.",
        control: "meter",
        
        meter: 92,
      },
    ],
  },
  {
    id: "where",
    tab: "Where it lives",
    cols: "sm:grid-cols-2 lg:grid-cols-3",
    fillers: ["hidden sm:block"],
    items: [
      {
        icon: Position,
        title: "Position",
        body: "Left, centre or right of your top edge. The strip you hover moves with it.",
        control: "segments",
        options: ["Left", "Center", "Right"],
        selected: 1,
      },
      {
        icon: Screen,
        title: "Which screen",
        body: "Click a monitor to send the notch there. Unplug it and it comes home by itself.",
        control: "screens",
      },
      {
        icon: Displays,
        title: "One on every screen",
        body: "Or stop choosing: a notch on each monitor, appearing and going with the screens.",
        control: "switch",
      },
      {
        icon: Target,
        title: "Show me where it is",
        body: "A thin line marking the spot that summons it. Turn it off once you know.",
        control: "switch",
      },
      {
        icon: Layers,
        title: "Always on top",
        body: "Keeps the pill on screen above your windows. Off, it hides until you reach for it.",
        control: "switch",
      },
    ],
  },
  {
    id: "tells",
    tab: "What it tells you",
    cols: "sm:grid-cols-2 lg:grid-cols-3",
    fillers: ["hidden sm:block lg:hidden"],
    items: [
      {
        icon: Bell,
        title: "Notifications in the notch",
        body: "They drop down for a few seconds, then get out of the way. Hover to hold one.",
        control: "switch",
      },
      {
        icon: BellOff,
        title: "Mute Windows' own banners",
        body: "No corner pop-up, so it appears in the notch and nowhere else. Reversible any time.",
        control: "switch",
      },
      {
        icon: Gauge,
        title: "Charger, Wi-Fi and load",
        body: "A word when a charger goes in, a device connects, or your machine is struggling.",
        control: "switch",
      },
    ],
  },
  {
    id: "once",
    tab: "Set once",
    cols: "sm:grid-cols-2",
    items: [
      {
        icon: Cloud,
        title: "Weather location",
        body: "The one thing Crest has to be told. Type a town: no account, no API key.",
        control: "none",
      },
      {
        icon: Windows,
        title: "Start with Windows",
        body: "A proper logon task, so it is up in seconds rather than behind your game launchers.",
        control: "switch",
      },
    ],
  },
];

function Switch() {
  return (
    <span
      aria-hidden
      className="relative h-6 w-11 shrink-0 rounded-full bg-[var(--accent)]"
    >
      <span className="absolute top-1/2 right-1 h-4 w-4 -translate-y-1/2 rounded-full bg-white" />
    </span>
  );
}

function Meter({ value }: { value: number }) {
  return (
    <div className="mt-4 flex items-center gap-3" aria-hidden>
      <div className="relative h-1.5 flex-1 rounded-[var(--r-pill)] bg-[var(--track)]">
        <div
          className="absolute inset-y-0 left-0 rounded-[var(--r-pill)] bg-[var(--accent)]"
          style={{ width: `${value}%` }}
        />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,.5)]"
          style={{ left: `${value}%` }}
        />
      </div>
      <span className="tnum w-9 text-right text-[12px] text-[var(--text-tertiary)]">
        {value}%
      </span>
    </div>
  );
}

function Segments({ options, selected }: { options: string[]; selected: number }) {
  return (
    <div
      className="mt-4 inline-flex rounded-[var(--r-pill)] border border-[var(--hairline)] bg-[var(--ground)] p-1"
      aria-hidden
    >
      {options.map((option, i) => (
        <span
          key={option}
          className={`rounded-[var(--r-pill)] px-3 py-1 text-[12.5px] ${
            i === selected
              ? "bg-[var(--accent)] font-medium text-white"
              : "text-[var(--text-secondary)]"
          }`}
        >
          {option}
        </span>
      ))}
    </div>
  );
}

function Swatches({ colors }: { colors: string[] }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-hidden>
      {colors.map((color, i) => (
        <span
          key={color}
          className={`h-6 w-6 rounded-full ${
            i === 0
              ? "ring-2 ring-white/70 ring-offset-2 ring-offset-[var(--surface)]"
              : "ring-1 ring-white/15"
          }`}
          style={{ background: color }}
        />
      ))}
    </div>
  );
}

function Chips({ labels }: { labels: string[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden>
      {labels.map((label) => (
        <span
          key={label}
          className="rounded-[var(--r-chip)] border border-[var(--hairline)] bg-[var(--surface-raised)] px-2 py-1 text-[11.5px] text-[var(--text-secondary)]"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function Screens() {
  return (
    <div className="mt-4 flex items-end gap-2" aria-hidden>
      <span className="tnum relative grid h-[42px] w-[74px] place-items-center rounded-[var(--r-chip)] border-[1.5px] border-[var(--accent)] bg-[var(--accent)]/[.14] text-[11px] text-white">
        <span className="absolute top-0 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-b bg-[var(--accent)]" />
        1
      </span>
      <span className="tnum grid h-[32px] w-[56px] place-items-center rounded-[var(--r-chip)] border-[1.5px] border-[var(--hairline-strong)] bg-[var(--surface-raised)] text-[11px] text-[var(--text-secondary)]">
        2
      </span>
    </div>
  );
}

function ControlFor({ item }: { item: Preference }) {
  if (item.control === "meter" && item.meter !== undefined)
    return <Meter value={item.meter} />;
  if (item.control === "segments" && item.options)
    return <Segments options={item.options} selected={item.selected ?? 0} />;
  if (item.control === "swatches" && item.swatches)
    return <Swatches colors={item.swatches} />;
  if (item.control === "chips" && item.chips) return <Chips labels={item.chips} />;
  if (item.control === "screens") return <Screens />;
  return null;
}

export default function Preferences() {
  const [active, setActive] = useState(groups[0].id);
  const group = groups.find((g) => g.id === active) ?? groups[0];

  return (
    <section id="settings" className="relative py-[clamp(56px,9vw,104px)]">
      <div className="mx-auto max-w-[1080px] px-[22px]">
        <div className="max-w-2xl">
          <p className="t-eyebrow">Settings</p>
          <h2 className="t-title mt-3">
            Yours to arrange,
            <span className="text-[var(--heading-tint)]"> no config file.</span>
          </h2>
          <p className="t-lede mt-5">
            Crest works the moment it installs, so none of this is setup: it is
            what you change once you have lived with it for a week. Every change
            lands immediately, in every window at once.
          </p>
        </div>

        
        <div
          role="tablist"
          aria-label="Settings pages"
          className="mt-10 flex flex-wrap gap-1 rounded-[var(--r-pill)] border border-[var(--hairline)] bg-[var(--surface)] p-1 sm:inline-flex"
        >
          {groups.map((entry) => {
            const selected = entry.id === active;
            return (
              <button
                key={entry.id}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls={`settings-${entry.id}`}
                onClick={() => setActive(entry.id)}
                className={`press rounded-[var(--r-pill)] px-4 py-2 text-[13.5px] tracking-[-0.005em] transition-colors duration-200 ${
                  selected
                    ? "bg-[var(--surface-hover)] font-medium text-[var(--text)] shadow-[var(--sh-card)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                }`}
              >
                {entry.tab}
              </button>
            );
          })}
        </div>

        
        <div
          key={group.id}
          id={`settings-${group.id}`}
          role="tabpanel"
          className="panel group-in mt-6 overflow-hidden"
        >
          <div className={`grid gap-px bg-[var(--hairline)] ${group.cols}`}>
            {group.items.map((item, i) => (
              <article
                key={item.title}
                className="flex h-full flex-col bg-[var(--surface)] px-6 py-6"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="text-[var(--text-tertiary)]">
                    <item.icon width={20} height={20} />
                  </span>
                  {item.control === "switch" && <Switch />}
                </div>

                <h3 className="t-heading mt-4">{item.title}</h3>
                <p className="mt-1 text-[13.5px] leading-[1.6] text-[var(--text-secondary)]">
                  {item.body}
                </p>

                <ControlFor item={item} />
              </article>
            ))}
            {group.fillers?.map((className, i) => (
              <div
                key={i}
                aria-hidden
                className={`bg-[var(--surface)] ${className}`}
              />
            ))}
          </div>
        </div>

        <Reveal delay={80}>
          <p className="mt-6 max-w-2xl text-[13.5px] leading-[1.7] text-[var(--text-tertiary)]">
            <Sliders
              width={16}
              height={16}
              className="mr-2 -mt-0.5 inline-block align-middle"
            />
            <span className="font-medium text-[var(--text-body)]">
              Eight pages, one window.
            </span>{" "}
            About, Panels, Theme, Appearance, Display, Weather, Notes and the
            switches, opened from the tray icon, so nothing is buried at the
            bottom of a page you have already scrolled past.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
