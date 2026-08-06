"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Files,
  Note,
  Pause,
  Search,
  SkipBack,
  SkipForward,
} from "./icons";

/*
  A faithful replica of the shipped overlay, running in the browser.

  Every dimension, colour and timing below is lifted from the real app
  (`product/src/tokens.ts` and `product/src/layout.ts`) rather than eyeballed —
  a demo that lies about the size of the thing you're about to install is worse
  than no demo. The one departure is that this never enters the `hidden` state:
  on the desktop the notch disappears entirely when the cursor leaves, which
  here would just look like the demo broke.
*/

type Module = "media" | "launcher" | "files";

const MODULES: readonly Module[] = ["media", "launcher", "files"];

const LABELS: Record<Module, string> = {
  media: "Now playing",
  launcher: "Launcher",
  files: "Shelf & notes",
};

/** Card dimensions, verbatim from the product's design tokens. */
const SIZE = {
  peek: { width: 200, height: 32 },
  media: { width: 380, height: 164 },
  launcher: { width: 400, height: 346 },
  files: { width: 440, height: 206 },
} as const;

const NAV_STRIP_HEIGHT = 26;

/** Interaction timings, verbatim from the product. */
const DWELL_MS = 600;
const GRACE_MS = 300;

const C = {
  accent: "#7C3AED",
  accentBright: "#A855F7",
  primary: "#fff",
  strong: "rgba(255,255,255,.9)",
  body: "rgba(255,255,255,.8)",
  secondary: "rgba(255,255,255,.6)",
  icon: "rgba(255,255,255,.55)",
  muted: "rgba(255,255,255,.4)",
  divider: "rgba(255,255,255,.06)",
  dividerStrong: "rgba(255,255,255,.08)",
  dashed: "rgba(255,255,255,.15)",
  scrubTrack: "rgba(255,255,255,.15)",
  inset: "rgba(0,0,0,.28)",
} as const;

const sectionLabel = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  color: C.muted,
} as const;

export default function NotchDemo() {
  const [expanded, setExpanded] = useState(false);
  const [module, setModule] = useState<Module>("media");
  /** True once the visitor has hovered or clicked — stops the scripted tour. */
  const [touched, setTouched] = useState(false);

  const dwell = useRef<ReturnType<typeof setTimeout> | null>(null);
  const grace = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (dwell.current) clearTimeout(dwell.current);
    if (grace.current) clearTimeout(grace.current);
    dwell.current = null;
    grace.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const handleEnter = useCallback(() => {
    setTouched(true);
    clearTimers();
    // The real notch requires 600ms of continuous dwell before expanding, so a
    // cursor crossing the top of the screen on its way somewhere else is
    // ignored. Reproduced here, or the demo would feel twitchier than the app.
    dwell.current = setTimeout(() => setExpanded(true), DWELL_MS);
  }, [clearTimers]);

  const handleLeave = useCallback(() => {
    clearTimers();
    grace.current = setTimeout(() => setExpanded(false), GRACE_MS);
  }, [clearTimers]);

  /*
    Scripted tour: the notch's whole pitch is that it expands, so a visitor who
    never happens to mouse over the demo should still see it happen once. Any
    real interaction cancels it and hands control back.
  */
  useEffect(() => {
    if (touched) return;

    const steps: Array<[number, () => void]> = [
      [1400, () => setExpanded(true)],
      [4000, () => setModule("launcher")],
      [7000, () => setModule("files")],
      [9800, () => setExpanded(false)],
      [11200, () => setModule("media")],
    ];

    const ids = steps.map(([at, run]) => setTimeout(run, at));
    return () => ids.forEach(clearTimeout);
  }, [touched]);

  const step = useCallback((direction: 1 | -1) => {
    setTouched(true);
    setModule((current) => {
      const next = (MODULES.indexOf(current) + direction + MODULES.length) % MODULES.length;
      return MODULES[next];
    });
  }, []);

  const card = expanded ? SIZE[module] : SIZE.peek;

  return (
    <div className="relative w-full">
      {/* The "desktop" the notch sits on. */}
      <div className="pane relative overflow-hidden rounded-2xl">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 0%, #2a1a52 0%, #150f2c 42%, #0a0a12 100%)",
          }}
        />
        {/* A couple of wallpaper shapes, so the Mica blur has something to chew on. */}
        <div
          aria-hidden
          className="absolute -left-16 top-24 h-64 w-64 rounded-full opacity-40 blur-3xl"
          style={{ background: C.accent }}
        />
        <div
          aria-hidden
          className="absolute -right-10 bottom-0 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: "#1b00b5" }}
        />

        <div className="relative flex h-[420px] items-start justify-center px-4 sm:h-[460px]">
          {/*
            The app renders at fixed pixel sizes against a 1080p-ish desktop.
            Scaling the whole stage keeps those proportions honest on a phone
            instead of reflowing the card into something that doesn't ship.
          */}
          <div className="origin-top scale-[0.68] sm:scale-[0.85] lg:scale-100">
            <div
              onPointerEnter={handleEnter}
              onPointerLeave={handleLeave}
              // Focus bubbles from the nav buttons, so the same handlers give
              // keyboard users a way in: Tab to the card and it expands.
              onFocus={handleEnter}
              onBlur={handleLeave}
              tabIndex={0}
              role="group"
              aria-label="Interactive preview of the Crest notch"
              className="mica focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent-bright)]"
              style={{
                width: card.width,
                height: card.height,
                borderRadius: 16,
                // Slight overshoot approximates the app's Framer Motion spring.
                transition:
                  "width .42s cubic-bezier(.22,1.15,.36,1), height .42s cubic-bezier(.22,1.15,.36,1)",
              }}
            >
              <div className="relative z-[1] flex h-full w-full flex-col">
                {expanded && (
                  <div
                    className="flex flex-none items-center justify-center"
                    style={{ height: NAV_STRIP_HEIGHT }}
                  >
                    <NavArrows
                      label={LABELS[module]}
                      index={MODULES.indexOf(module)}
                      onPrev={() => step(-1)}
                      onNext={() => step(1)}
                    />
                  </div>
                )}

                <div className="relative min-h-0 flex-1">
                  <div
                    key={expanded ? module : "peek"}
                    className="panel-in absolute inset-0"
                  >
                    {expanded ? <ModuleContent module={module} /> : <CollapsedPill />}
                  </div>
                </div>
              </div>
            </div>

            {/* Hint sits below the card so it never overlaps the hit area. */}
            <p
              className="mt-6 text-center text-[13px] transition-opacity duration-500"
              style={{ color: C.muted, opacity: expanded ? 0 : 1 }}
            >
              Hover the notch — it expands after {DWELL_MS}ms
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Collapsed pill ---------------------------------------------------- */

/*
  The clock is an external source of truth, not React state, so it's read
  through `useSyncExternalStore`. The server snapshot is deliberately empty —
  the build machine's clock has nothing to do with the visitor's, and rendering
  one into the HTML is a guaranteed hydration mismatch.
*/
function subscribeToClock(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}

const readClock = () =>
  new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const readClockOnServer = () => "";

function CollapsedPill() {
  const time = useSyncExternalStore(subscribeToClock, readClock, readClockOnServer);

  return (
    <div className="relative flex h-full w-full items-center justify-between px-[14px]">
      <div className="flex h-[13px] flex-none items-end gap-[2.5px]">
        {[0, 0.2, 0.4].map((delay) => (
          <span
            key={delay}
            className="eq"
            style={{
              width: 2.5,
              height: 13,
              borderRadius: 2,
              background: C.accentBright,
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </div>

      <span
        className="pointer-events-none absolute inset-x-0 text-center font-mono tabular-nums"
        style={{ fontSize: 12.5, fontWeight: 600, color: C.strong, letterSpacing: ".02em" }}
      >
        {time || " "}
      </span>

      <span
        className="flex-none rounded-full"
        style={{ width: 6, height: 6, background: C.accent }}
      />
    </div>
  );
}

/* --- Nav strip --------------------------------------------------------- */

function NavArrows({
  label,
  index,
  onPrev,
  onNext,
}: {
  label: string;
  index: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const button =
    "grid h-[18px] w-[18px] place-items-center rounded-[5px] transition-colors hover:bg-white/10";

  return (
    <div className="flex items-center gap-2" style={{ color: C.icon }}>
      <button type="button" onClick={onPrev} className={button} aria-label="Previous panel">
        <ChevronLeft width={12} height={12} />
      </button>
      <span
        className="min-w-[92px] text-center"
        style={{ ...sectionLabel, color: C.secondary }}
      >
        {label}
      </span>
      <button type="button" onClick={onNext} className={button} aria-label="Next panel">
        <ChevronRight width={12} height={12} />
      </button>
      <span className="ml-1 font-mono" style={{ fontSize: 9, color: C.muted }}>
        {index + 1}/{MODULES.length}
      </span>
    </div>
  );
}

/* --- Panels ------------------------------------------------------------ */

function ModuleContent({ module }: { module: Module }) {
  if (module === "media") return <MediaPanel />;
  if (module === "launcher") return <LauncherPanel />;
  return <FilesPanel />;
}

function MediaPanel() {
  return (
    <div className="flex h-full w-full items-center gap-3 p-4">
      <div
        className="flex-none rounded-lg"
        style={{
          width: 74,
          height: 74,
          background: "linear-gradient(135deg,#4b3f6b,#241d38)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.12)",
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-[7px]">
        <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>
          Midnight City
        </div>
        <div className="truncate" style={{ fontSize: 11.5, color: C.secondary }}>
          M83 — Hurry Up, We&apos;re Dreaming
        </div>

        <div className="mt-[3px] flex items-center gap-2">
          <span className="font-mono" style={{ fontSize: 9, color: C.muted }}>
            1:42
          </span>
          <div
            className="relative h-[3px] flex-1 overflow-hidden rounded-full"
            style={{ background: C.scrubTrack }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: "42%", background: C.accent }}
            />
          </div>
          <span className="font-mono" style={{ fontSize: 9, color: C.muted }}>
            4:03
          </span>
        </div>

        <div className="mt-[2px] flex items-center gap-3" style={{ color: C.strong }}>
          <SkipBack width={14} height={14} />
          <span
            className="grid place-items-center rounded-full"
            style={{ width: 24, height: 24, background: C.accent, color: "#fff" }}
          >
            <Pause width={12} height={12} />
          </span>
          <SkipForward width={14} height={14} />
        </div>
      </div>
    </div>
  );
}

const APPS = [
  ["VS", "Code"],
  ["Fx", "Firefox"],
  ["Sp", "Spotify"],
  ["Fg", "Figma"],
  ["Tm", "Terminal"],
  ["Nt", "Notion"],
  ["Sl", "Slack"],
  ["St", "Steam"],
];

function LauncherPanel() {
  return (
    <div className="flex h-full w-full min-h-0 flex-col p-4">
      <div
        className="flex flex-none items-center gap-2 rounded-lg px-2.5"
        style={{
          height: 30,
          background: C.inset,
          boxShadow: "inset 0 1px 2px rgba(0,0,0,.4)",
          color: C.muted,
        }}
      >
        <Search width={13} height={13} />
        <span style={{ fontSize: 11.5 }}>Search apps</span>
        <span className="caret" style={{ marginLeft: -4, color: C.secondary }}>
          |
        </span>
      </div>

      <div className="mt-3 grid flex-none grid-cols-4 gap-2">
        {APPS.map(([initials, name]) => (
          <div
            key={name}
            className="notch-tile flex flex-col items-center justify-center gap-1.5"
            style={{ height: 62 }}
          >
            <span
              className="grid place-items-center rounded-md"
              style={{
                width: 26,
                height: 26,
                background: "rgba(255,255,255,.08)",
                fontSize: 10,
                fontWeight: 700,
                color: C.strong,
              }}
            >
              {initials}
            </span>
            <span style={{ fontSize: 9, color: C.secondary }}>{name}</span>
          </div>
        ))}
      </div>

      <div className="mt-[14px] flex flex-none items-center gap-1.5" style={sectionLabel}>
        <Clipboard width={11} height={11} />
        <span>Clipboard history</span>
      </div>

      <div className="mt-1 min-h-0 flex-1">
        {[
          ["npm run tauri build", "2m ago"],
          ["https://tauri.app/start/", "14m ago"],
          ["rgba(124, 58, 237, 1)", "1h ago"],
        ].map(([text, when], i) => (
          <div
            key={text}
            className="flex items-center justify-between py-[7px]"
            style={{ borderTop: i === 0 ? "none" : `1px solid ${C.divider}` }}
          >
            <span className="truncate font-mono" style={{ fontSize: 10.5, color: C.body }}>
              {text}
            </span>
            <span className="ml-3 flex-none" style={{ fontSize: 9, color: C.muted }}>
              {when}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilesPanel() {
  return (
    <div className="flex h-full w-full p-4">
      <div className="flex min-w-0 flex-1 flex-col pr-4">
        <div className="flex flex-none items-center gap-1.5" style={sectionLabel}>
          <Files width={11} height={11} />
          <span>File shelf</span>
        </div>

        <div className="mt-2 flex flex-1 gap-2">
          {[
            ["PDF", "#F87171", "spec.pdf"],
            ["PNG", C.accentBright, "notch.png"],
          ].map(([kind, tint, name]) => (
            <div
              key={name}
              className="notch-tile flex flex-1 flex-col items-center justify-center gap-1.5"
            >
              <span
                className="grid place-items-center rounded-[6px]"
                style={{
                  width: 28,
                  height: 34,
                  background: "rgba(255,255,255,.06)",
                  fontSize: 8,
                  fontWeight: 700,
                  color: tint,
                }}
              >
                {kind}
              </span>
              <span className="truncate px-1" style={{ fontSize: 9, color: C.secondary }}>
                {name}
              </span>
            </div>
          ))}

          <div
            className="grid flex-1 place-items-center rounded-lg px-1 text-center"
            style={{ border: `1px dashed ${C.dashed}`, fontSize: 9, color: C.muted }}
          >
            Drop files
          </div>
        </div>
      </div>

      <div className="flex-none" style={{ width: 1, background: C.dividerStrong }} />

      <div className="flex min-w-0 flex-1 flex-col pl-4">
        <div className="flex flex-none items-center gap-1.5" style={sectionLabel}>
          <Note width={11} height={11} />
          <span>Quick notes</span>
        </div>
        <p className="mt-2 leading-[1.55]" style={{ fontSize: 11, color: C.body }}>
          Ship the landing page
          <br />
          Check media scrub on Spotify
          <br />
          Notes autosave — no save button
          <span className="caret" style={{ color: C.accentBright }}>
            |
          </span>
        </p>
      </div>
    </div>
  );
}
