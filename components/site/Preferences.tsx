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

/*
  The Settings window, as four tabs rather than four stacked groups.

  It used to draw all fourteen preferences at once, which ran to three screens
  of switches — and a reader scrolling past that is not comparing options, they
  are looking for the end. Tabbed, the section is one screen: pick the thing you
  care about and read five cards.

  The bodies are two lines now, for the same reason the panel cards are one. A
  preference row on a marketing page has to answer "what does this do" and
  nothing more; what it *costs* to turn off is a question you ask inside the app,
  where the real row says so.

  If a preference is added to `useSettings.ts`, it belongs here too — this and
  the panels section are the only two places on the site that claim to be
  complete.
*/

/**
 * What the card draws under its copy.
 *
 * Explicit, and that is a fix rather than a preference. It used to be inferred —
 * "no meter and no options means draw a switch" — which quietly put a toggle on
 * three rows that have no switch in the app at all: the panel picker, the
 * display map and the weather search. A card that draws a control the app does
 * not have is the site lying about the product in the most checkable way there
 * is.
 */
type Control = "switch" | "segments" | "meter" | "swatches" | "chips" | "screens" | "none";

interface Preference {
  icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
  title: string;
  body: string;
  control: Control;
  /** `segments` — the options, and which one ships selected. */
  options?: string[];
  selected?: number;
  /** `meter` — the shipped default. */
  meter?: number;
  /** `swatches` — real hex values from the app. */
  swatches?: string[];
  /** `chips` — a few of the panel names, as a preview of the picker. */
  chips?: string[];
}

const groups: { id: string; tab: string; cols: string; items: Preference[] }[] = [
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
        /* Each theme's own accent, from `Theme::accent()` in settings.rs. */
        swatches: ["#7C3AED", "#6FB1D9", "#E8934A", "#2F6FED", "#F0F0F0"],
      },
      {
        icon: Droplet,
        title: "Accent colour",
        body: "Eight to pick from, or type your own hex. Everything active is drawn in it.",
        control: "swatches",
        /* Mirrors ACCENT_SWATCHES in useSettings.ts. */
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
        /* Mirrors OPACITY in useSettings.ts. */
        meter: 92,
      },
    ],
  },
  {
    id: "where",
    tab: "Where it lives",
    cols: "sm:grid-cols-2 lg:grid-cols-3",
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
        body: "Or stop choosing — a notch on each monitor, appearing and going with the screens.",
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
        body: "The one thing Crest has to be told. Type a town — no account, no API key.",
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

/* --- Controls ---------------------------------------------------------- */

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

/** The 0–100 slider, drawn at its default. */
function Meter({ value }: { value: number }) {
  return (
    <div className="mt-4 flex items-center gap-3" aria-hidden>
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

/** The segmented picker, with the shipped default drawn as chosen. */
function Segments({ options, selected }: { options: string[]; selected: number }) {
  return (
    <div
      className="mt-4 inline-flex rounded-xl border border-[var(--hairline)] bg-white/[.03] p-1"
      aria-hidden
    >
      {options.map((option, i) => (
        <span
          key={option}
          className={`rounded-lg px-3 py-1 text-[12.5px] ${
            i === selected
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

/** Real hex values from the app, with the default ringed. */
function Swatches({ colors }: { colors: string[] }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-hidden>
      {colors.map((color, i) => (
        <span
          key={color}
          className={`h-6 w-6 rounded-full ${
            i === 0
              ? "ring-2 ring-white/70 ring-offset-2 ring-offset-[#0b0b11]"
              : "ring-1 ring-white/15"
          }`}
          style={{ background: color }}
        />
      ))}
    </div>
  );
}

/** A few panel names, as the picker's tick-list would show them. */
function Chips({ labels }: { labels: string[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden>
      {labels.map((label) => (
        <span
          key={label}
          className="rounded-md border border-[var(--hairline)] bg-white/[.04] px-2 py-1 text-[11.5px] text-[var(--muted)]"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * A miniature of the Display page's map — two screens at their real relative
 * sizes, the notch marked on the one carrying it.
 */
function Screens() {
  return (
    <div className="mt-4 flex items-end gap-2" aria-hidden>
      <span className="relative grid h-[42px] w-[74px] place-items-center rounded-md border-[1.5px] border-[var(--accent)] bg-[var(--accent)]/[.14] text-[11px] text-white">
        <span className="absolute top-0 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-b bg-[var(--accent)]" />
        1
      </span>
      <span className="grid h-[32px] w-[56px] place-items-center rounded-md border-[1.5px] border-[var(--hairline-bright)] bg-white/[.04] text-[11px] text-[var(--muted)]">
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

/* --- Section ----------------------------------------------------------- */

export default function Preferences() {
  const [active, setActive] = useState(groups[0].id);
  const group = groups.find((g) => g.id === active) ?? groups[0];

  return (
    <section id="settings" className="relative border-t border-white/[.06] py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-2xl">
          <p className="section-label">Settings</p>
          <h2 className="mt-4 text-[clamp(2rem,4.4vw,3rem)] leading-[1.1] font-semibold tracking-[-0.03em]">
            Yours to arrange,
            <span className="text-[var(--faint)]"> no config file.</span>
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-[var(--muted)]">
            Crest works the moment it installs, so none of this is setup — it is
            what you change once you have lived with it for a week. Every change
            lands immediately, in every window at once.
          </p>
        </div>

        {/* Tabs. A `tablist` proper, so arrow keys and screen readers get the
            grouping for free rather than four buttons that happen to be near
            each other. */}
        <div
          role="tablist"
          aria-label="Settings pages"
          className="mt-10 flex flex-wrap gap-1.5 rounded-2xl border border-[var(--hairline)] bg-white/[.03] p-1.5 sm:inline-flex"
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
                className={`rounded-xl px-4 py-2 text-[13.5px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-bright)] ${
                  selected
                    ? "bg-[var(--accent)] font-medium text-white"
                    : "text-[var(--muted)] hover:bg-white/[.05] hover:text-white"
                }`}
              >
                {entry.tab}
              </button>
            );
          })}
        </div>

        {/* Keyed on the group, so switching tabs remounts the grid and replays
            the slide — the same trick the notch itself uses to cross-fade a
            panel it never unmounts on its own. */}
        <div
          key={group.id}
          id={`settings-${group.id}`}
          role="tabpanel"
          className={`group-in mt-6 grid gap-3 ${group.cols}`}
        >
          {group.items.map((item, i) => (
            <article
              key={item.title}
              className="pane group h-full rounded-2xl p-5 transition-colors duration-300 hover:border-[var(--hairline-bright)]"
              // Staggered by hand rather than through `Reveal`: these are already
              // on screen when the tab is clicked, so there is nothing to observe
              // — the cascade is the whole of the feedback that the panel changed.
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <div className="relative z-[1] flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <span className="inline-grid h-9 w-9 place-items-center rounded-lg border border-[var(--hairline)] bg-white/[.05] text-[var(--accent-bright)] transition-colors duration-300 group-hover:bg-[var(--accent)] group-hover:text-white">
                    <item.icon width={17} height={17} />
                  </span>
                  {item.control === "switch" && <Switch />}
                </div>

                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--muted)]">
                  {item.body}
                </p>

                <ControlFor item={item} />
              </div>
            </article>
          ))}
        </div>

        <Reveal delay={80}>
          <div className="pane mt-3 flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center">
            <span className="relative z-[1] inline-grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--hairline)] bg-white/[.05] text-[var(--accent-bright)]">
              <Sliders width={17} height={17} />
            </span>
            <p className="relative z-[1] text-[13.5px] leading-relaxed text-[var(--muted)]">
              <span className="font-medium text-white">
                Eight pages, one window.
              </span>{" "}
              About, Panels, Theme, Appearance, Display, Weather, Notes and the
              switches — opened from the tray icon, so nothing is buried at the
              bottom of a page you have already scrolled past.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
