"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Clipboard, Files, Note, Pause, Search, SkipBack, SkipForward } from "./icons";

const C = {
  tile: "rgba(255,255,255,.055)",
  tileHighlight: "rgba(255,255,255,.12)",
  hover: "rgba(255,255,255,.06)",
  inset: "rgba(0,0,0,.28)",
  insetShadow: "inset 0 1px 2px rgba(0,0,0,.4)",
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
  artGradient: "linear-gradient(135deg,#3d5486,#1a2338)",
  accent: "#2f6fed",
  accentBright: "#5b90f5",
  accentWash: "rgba(47,111,237,.16)",
  onAccent: "#fff",
  loadWarn: "#fbbf24",
  danger: "#f87171",
} as const;

const sectionLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  color: C.muted,
};

type Module =
  | "media"
  | "launcher"
  | "files"
  | "notifications"
  | "system"
  | "weather"
  | "calendar";

const MODULES: readonly Module[] = [
  "media",
  "launcher",
  "files",
  "notifications",
  "system",
  "weather",
  "calendar",
];

const LABELS: Record<Module, string> = {
  media: "Media controls",
  launcher: "Launcher and clipboard",
  files: "File shelf and notes",
  notifications: "Notifications",
  system: "System monitor",
  weather: "Weather",
  calendar: "Calendar",
};

const SIZE = {
  peek: { width: 264, height: 34 },
  media: { width: 380, height: 164 },
  launcher: { width: 400, height: 346 },
  files: { width: 440, height: 260 },
  notifications: { width: 420, height: 88 + 44 * 3 },
  system: { width: 380, height: 266 },
  weather: { width: 400, height: 268 },
  calendar: { width: 480, height: 286 },
} as const;

const NAV_STRIP_HEIGHT = 26;

const DWELL_MS = 600;
const GRACE_MS = 300;

const BATTERY = { percent: 68, acPower: true };

export default function NotchDemo() {
  const [expanded, setExpanded] = useState(false);
  const [module, setModule] = useState<Module>("media");
  
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
    dwell.current = setTimeout(() => setExpanded(true), DWELL_MS);
  }, [clearTimers]);

  const handleLeave = useCallback(() => {
    clearTimers();
    grace.current = setTimeout(() => setExpanded(false), GRACE_MS);
  }, [clearTimers]);

  
  useEffect(() => {
    if (touched) return;

    const steps: Array<[number, () => void]> = [
      [1400, () => setExpanded(true)],
      [4200, () => setModule("system")],
      [7000, () => setModule("calendar")],
      [10000, () => setModule("files")],
      [12800, () => setExpanded(false)],
      [14200, () => setModule("media")],
    ];

    const ids = steps.map(([at, run]) => setTimeout(run, at));
    return () => ids.forEach(clearTimeout);
  }, [touched]);

  const step = useCallback((direction: 1 | -1) => {
    setTouched(true);
    setModule((current) => {
      const next =
        (MODULES.indexOf(current) + direction + MODULES.length) % MODULES.length;
      return MODULES[next];
    });
  }, []);

  
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = cardRef.current;
    if (!node || !expanded) return;

    let settled = 0;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const now = Date.now();
      if (now - settled < 320) return;
      settled = now;
      step(event.deltaY > 0 || event.deltaX > 0 ? 1 : -1);
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [expanded, step]);

  const card = expanded ? SIZE[module] : SIZE.peek;

  return (
    <div className="relative w-full">
      
      <div className="pane relative overflow-hidden rounded-2xl">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 0%, #16295c 0%, #0e1730 42%, #0a0a12 100%)",
          }}
        />
        
        <div
          aria-hidden
          className="absolute -left-16 top-24 h-64 w-64 rounded-full opacity-40 blur-3xl"
          style={{ background: C.accent }}
        />
        <div
          aria-hidden
          className="absolute -right-10 bottom-0 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: "#123a9e" }}
        />

        <div className="relative flex h-[420px] items-start justify-center px-4 sm:h-[470px]">
          
          <div className="origin-top scale-[0.6] sm:scale-[0.8] lg:scale-100">
            <div
              ref={cardRef}
              onPointerEnter={handleEnter}
              onPointerLeave={handleLeave}
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
                transition:
                  "width .42s cubic-bezier(.22,1.15,.36,1), height .42s cubic-bezier(.22,1.15,.36,1)",
              }}
            >
              <div className="relative z-[1] flex h-full w-full flex-col">
                {expanded && (
                  <div
                    className="flex flex-none items-center"
                    style={{ height: NAV_STRIP_HEIGHT }}
                  >
                    <NavArrows
                      label={LABELS[module]}
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

            
            <p
              className="mt-6 text-center text-[13px] transition-opacity duration-500"
              style={{ color: C.muted, opacity: expanded ? 0 : 1 }}
            >
              Hover the notch. It expands after {DWELL_MS}ms
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const BADGE = {
  full: { glyph: { width: 22, height: 11.85 }, gap: 5, font: 12, number: 30 },
  compact: { glyph: { width: 18, height: 9.7 }, gap: 4, font: 11, number: 26 },
} as const;

const BODY = { x: 2.75, width: 17.5 };

function BatteryBadge({ chip }: { chip?: { height: number; padding: string } }) {
  const size = chip ? BADGE.full : BADGE.compact;
  const { percent, acPower } = BATTERY;
  const tint = acPower ? C.accent : C.secondary;

  return (
    <span
      className={chip ? "notch-tile" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: size.gap,
        flex: "none",
        ...(chip && {
          height: chip.height,
          padding: chip.padding,
          borderRadius: 99,
          overflow: "hidden",
          ...(acPower && { background: C.accentWash }),
        }),
      }}
      role="img"
      aria-label={`Battery ${percent}%${acPower ? ", charging" : ""}`}
    >
      <svg
        viewBox="0 0 26 14"
        width={size.glyph.width}
        height={size.glyph.height}
        style={{ flex: "none", display: "block" }}
      >
        <rect
          x="0.75"
          y="1.25"
          width="21.5"
          height="11.5"
          rx="3.5"
          fill="none"
          stroke={C.muted}
          strokeWidth={1.5}
        />
        
        <rect x="23.6" y="5" width="1.9" height="4" rx="0.95" fill={C.muted} />
        
        <rect x={BODY.x} y="3.5" width={BODY.width} height="7" rx="1.75" fill={C.hover} />
        <rect
          x={BODY.x}
          y="3.5"
          width={Math.max(1.5, (BODY.width * percent) / 100)}
          height="7"
          rx="1.75"
          fill={tint}
        />
        {acPower && (
          <path
            d="M13.6 2.6L9.4 8.1h2.6l-.6 3.5 4.3-5.4h-2.7z"
            fill={C.onAccent}
            stroke={C.accent}
            strokeWidth={0.5}
            strokeLinejoin="round"
          />
        )}
      </svg>

      <span
        style={{
          fontSize: size.font,
          fontWeight: 600,
          letterSpacing: ".01em",
          color: acPower ? tint : C.secondary,
          fontVariantNumeric: "tabular-nums",
          minWidth: size.number,
          textAlign: "right",
        }}
      >
        {percent}%
      </span>
    </span>
  );
}

function subscribeToClock(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}

const readClock = () =>
  new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const readClockOnServer = () => "";

const CHIP = { height: 22, padding: "0 8px" };

function CollapsedPill() {
  const time = useSyncExternalStore(subscribeToClock, readClock, readClockOnServer);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        gridTemplateColumns: "80px 1fr 80px",
        alignItems: "center",
        padding: "0 12px",
      }}
    >
      
      <div
        className="notch-tile"
        style={{
          justifySelf: "start",
          display: "flex",
          alignItems: "flex-end",
          gap: 2.5,
          height: CHIP.height,
          padding: CHIP.padding,
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        {[0, 0.2, 0.4].map((delay) => (
          <span
            key={delay}
            className="eq"
            style={{
              width: 2.5,
              height: 11,
              marginBottom: 4.5,
              borderRadius: 2,
              background: C.accentBright,
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </div>

      <span
        style={{
          justifySelf: "center",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "-.01em",
          color: C.primary,
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {time || " "}
      </span>

      <div style={{ justifySelf: "end", display: "flex" }}>
        <BatteryBadge chip={CHIP} />
      </div>
    </div>
  );
}

function Chevron({
  direction,
  label,
  onClick,
}: {
  direction: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        flex: "none",
        borderRadius: 6,
        background: hover ? C.hover : "transparent",
        transition: "background 140ms ease",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={14}
        height={14}
        fill="none"
        stroke={hover ? C.accent : C.muted}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "stroke 140ms ease" }}
      >
        {direction === "left" ? <path d="m14 6-6 6 6 6" /> : <path d="m10 6 6 6-6 6" />}
      </svg>
    </button>
  );
}

function NavArrows({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        width: "100%",
        padding: "0 12px",
      }}
    >
      <span aria-hidden />

      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <Chevron direction="left" label="Previous panel" onClick={onPrev} />
        <span style={{ ...sectionLabel, whiteSpace: "nowrap" }}>{label}</span>
        <Chevron direction="right" label="Next panel" onClick={onNext} />
      </div>

      <span style={{ display: "flex", justifyContent: "flex-end", minWidth: 0 }}>
        <BatteryBadge />
      </span>
    </div>
  );
}

const stroke = {
  fill: "none",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Glyph({
  children,
  size = 14,
}: {
  children: ReactNode;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      {...stroke}
      stroke="currentColor"
      style={{ flex: "none" }}
      aria-hidden
    >
      {children}
    </svg>
  );
}

function ModuleContent({ module }: { module: Module }) {
  if (module === "media") return <MediaPanel />;
  if (module === "launcher") return <LauncherPanel />;
  if (module === "files") return <FilesPanel />;
  if (module === "notifications") return <NotificationsPanel />;
  if (module === "system") return <SystemPanel />;
  if (module === "weather") return <WeatherPanel />;
  return <CalendarPanel />;
}

function MediaPanel() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: "14px 16px",
        display: "flex",
        gap: 14,
        color: C.strong,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 64,
          height: 64,
          borderRadius: 8,
          flex: "none",
          overflow: "hidden",
          background: C.artGradient,
          boxShadow: "0 4px 12px rgba(0,0,0,.45)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(48px 48px at 32% 30%,rgba(255,255,255,.18),transparent 70%)",
          }}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-.01em",
            color: C.strong,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          After Hours
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.secondary,
            marginTop: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          The Weeknd
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{ fontSize: 9.5, color: C.muted, fontVariantNumeric: "tabular-nums" }}
          >
            1:42
          </span>
          <div
            style={{
              position: "relative",
              height: 3,
              flex: 1,
              borderRadius: 99,
              background: C.scrubTrack,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: "0 auto 0 0",
                width: "42%",
                borderRadius: 99,
                background: C.accent,
              }}
            />
          </div>
          <span
            style={{ fontSize: 9.5, color: C.muted, fontVariantNumeric: "tabular-nums" }}
          >
            4:03
          </span>
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            color: C.strong,
          }}
        >
          <SkipBack width={15} height={15} />
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 28,
              height: 28,
              borderRadius: 99,
              background: C.accent,
              color: C.onAccent,
            }}
          >
            <Pause width={13} height={13} />
          </span>
          <SkipForward width={15} height={15} />
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
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          flex: "none",
          alignItems: "center",
          gap: 8,
          height: 30,
          padding: "0 10px",
          borderRadius: 8,
          background: C.inset,
          boxShadow: C.insetShadow,
          color: C.muted,
        }}
      >
        <Search width={13} height={13} />
        <span style={{ fontSize: 11.5 }}>Search apps</span>
        <span className="caret" style={{ marginLeft: -4, color: C.secondary }}>
          |
        </span>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          flex: "none",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 8,
        }}
      >
        {APPS.map(([initials, name]) => (
          <div
            key={name}
            className="notch-tile"
            style={{
              height: 62,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: 26,
                height: 26,
                borderRadius: 6,
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

      <div
        style={{
          marginTop: 14,
          display: "flex",
          flex: "none",
          alignItems: "center",
          gap: 6,
          ...sectionLabel,
        }}
      >
        <Clipboard width={11} height={11} />
        <span>Clipboard history</span>
      </div>

      <div style={{ marginTop: 4, minHeight: 0, flex: 1 }}>
        {[
          ["npm run tauri build", "2m ago"],
          ["https://tauri.app/start/", "14m ago"],
          ["rgba(47, 111, 237, 1)", "1h ago"],
        ].map(([text, when], i) => (
          <div
            key={text}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "7px 0",
              borderTop: i === 0 ? "none" : `1px solid ${C.divider}`,
            }}
          >
            <span
              style={{
                fontSize: 10.5,
                color: C.body,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {text}
            </span>
            <span style={{ marginLeft: 12, flex: "none", fontSize: 9, color: C.muted }}>
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
    <div style={{ width: "100%", height: "100%", padding: 16, display: "flex" }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          paddingRight: 14,
        }}
      >
        <div style={{ display: "flex", flex: "none", alignItems: "center", gap: 6, ...sectionLabel }}>
          <Files width={11} height={11} />
          <span>File shelf</span>
        </div>

        <div
          style={{
            marginTop: 8,
            flex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gridTemplateRows: "1fr 1fr",
            gap: 8,
          }}
        >
          {[
            ["PDF", C.danger, "spec.pdf"],
            ["PNG", C.accentBright, "notch.png"],
            ["ZIP", C.loadWarn, "build.zip"],
            ["MD", C.secondary, "notes.md"],
          ].map(([kind, tint, name]) => (
            <div
              key={name}
              className="notch-tile"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 26,
                  height: 32,
                  borderRadius: 6,
                  background: "rgba(255,255,255,.06)",
                  fontSize: 8,
                  fontWeight: 700,
                  color: tint,
                }}
              >
                {kind}
              </span>
              <span
                style={{
                  fontSize: 9,
                  color: C.secondary,
                  maxWidth: "100%",
                  padding: "0 4px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {name}
              </span>
            </div>
          ))}

          <div
            style={{
              gridColumn: "span 2",
              display: "grid",
              placeItems: "center",
              borderRadius: 8,
              border: `1px dashed ${C.dashed}`,
              fontSize: 9.5,
              color: C.muted,
            }}
          >
            Drop files here
          </div>
        </div>
      </div>

      <div style={{ flex: "none", width: 1, background: C.dividerStrong }} />

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          paddingLeft: 14,
        }}
      >
        <div style={{ display: "flex", flex: "none", alignItems: "center", gap: 6, ...sectionLabel }}>
          <Note width={11} height={11} />
          <span>Quick notes</span>
        </div>

        <div style={{ marginTop: 8, display: "flex", flex: "none", gap: 4 }}>
          {["Today", "Ideas", "Ship"].map((tab, i) => (
            <span
              key={tab}
              className={i === 0 ? undefined : "notch-tile"}
              style={{
                padding: "3px 8px",
                borderRadius: 6,
                fontSize: 9.5,
                fontWeight: i === 0 ? 600 : 500,
                color: i === 0 ? C.onAccent : C.secondary,
                background: i === 0 ? C.accent : undefined,
              }}
            >
              {tab}
            </span>
          ))}
        </div>

        <p
          style={{
            marginTop: 10,
            fontSize: 11,
            lineHeight: 1.6,
            color: C.body,
          }}
        >
          Ship the landing page
          <br />
          Check media scrub on Spotify
          <br />
          Notes autosave: no save button
          <span className="caret" style={{ color: C.accentBright }}>
            |
          </span>
        </p>
      </div>
    </div>
  );
}

const NOTIFICATIONS = [
  ["Cl", "Calendar", "Design review in 12 min", "now"],
  ["Dl", "Downloads", "Crest_0.6.9_x64-setup.exe finished", "4m"],
  ["Sl", "Slack", "Dany mentioned you in #releases", "12m"],
];

function NotificationsPanel() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: 16,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: 20,
          flex: "none",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={sectionLabel}>Notifications</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: C.muted }}>Clear all</span>
      </div>

      <div style={{ height: 10, flex: "none" }} />

      <div style={{ flex: 1, minHeight: 0 }}>
        {NOTIFICATIONS.map(([mark, app, text, when], i) => (
          <div
            key={app}
            style={{
              height: 44,
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderTop: i === 0 ? "none" : `1px solid ${C.divider}`,
            }}
          >
            <span
              className="notch-tile"
              style={{
                display: "grid",
                placeItems: "center",
                width: 26,
                height: 26,
                flex: "none",
                borderRadius: 6,
                fontSize: 9,
                fontWeight: 700,
                color: C.strong,
              }}
            >
              {mark}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.strong,
                }}
              >
                {app}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 10.5,
                  color: C.secondary,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {text}
              </span>
            </span>
            <span style={{ flex: "none", fontSize: 9.5, color: C.muted }}>{when}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const WARN_AT = 75;
const HOT_AT = 90;

function toneFor(percent: number) {
  if (percent >= HOT_AT) return C.danger;
  if (percent >= WARN_AT) return C.loadWarn;
  return C.accent;
}

function Meter({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <div
      style={{
        height: 34,
        flex: "none",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 5,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: C.secondary }}>{label}</span>
        <span style={{ flex: 1 }} />
        {detail && <span style={{ fontSize: 10.5, color: C.muted }}>{detail}</span>}
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: C.strong,
            fontVariantNumeric: "tabular-nums",
            minWidth: 34,
            textAlign: "right",
          }}
        >
          {value}%
        </span>
      </div>

      <div
        style={{ height: 5, borderRadius: 99, background: C.scrubTrack, overflow: "hidden" }}
      >
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            borderRadius: 99,
            background: toneFor(value),
          }}
        />
      </div>
    </div>
  );
}

function SystemPanel() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: 16,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{ height: 16, flex: "none", display: "flex", alignItems: "center", gap: 8 }}
      >
        <span style={sectionLabel}>System monitor</span>
        <span style={{ flex: 1 }} />
        
        <span
          className="notch-tile"
          style={{
            display: "flex",
            alignItems: "center",
            height: 16,
            padding: "0 7px",
            borderRadius: 99,
            overflow: "hidden",
            fontSize: 10.5,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            color: C.secondary,
          }}
        >
          52°C
        </span>
      </div>

      <div style={{ height: 10, flex: "none" }} />

      <Meter label="CPU" value={81} />
      <Meter label="Memory" value={64} detail="10.2 / 16.0 GB" />
      <Meter label="GPU" value={23} />
      <Meter label="Disk" value={7} />

      <div style={{ flex: 1, minHeight: 12 }} />

      
      <div style={{ height: 34, flex: "none", display: "flex", gap: 8 }}>
        {[
          [
            "Sleep",
            <Glyph key="s">
              <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5" />
            </Glyph>,
          ],
          [
            "Restart",
            <Glyph key="r">
              <path d="M20 12a8 8 0 1 1-2.5-5.8" />
              <path d="M20 4v5h-5" />
            </Glyph>,
          ],
          [
            "Shut down",
            <Glyph key="p">
              <path d="M12 3v9" />
              <path d="M6.5 7a8 8 0 1 0 11 0" />
            </Glyph>,
          ],
        ].map(([label, icon]) => (
          <span
            key={label as string}
            className="notch-tile"
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              height: "100%",
              fontSize: 11,
              fontWeight: 500,
              color: C.secondary,
            }}
          >
            {icon}
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

const FORECAST = [
  ["Mon", 31, 24],
  ["Tue", 33, 25],
  ["Wed", 32, 25],
  ["Thu", 29, 24],
  ["Fri", 30, 24],
  ["Sat", 33, 26],
  ["Sun", 34, 26],
] as const;

function WeatherPanel() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: 16,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: 76,
          flex: "none",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <span style={{ color: C.accentBright, flex: "none" }}>
          <Glyph size={44}>
            <circle cx="8.5" cy="8.5" r="3" />
            <path d="M8.5 2.6v1.4M3.1 8.5h1.4M4.6 4.6l1 1M12.4 4.6l-1 1" />
            <path d="M8.4 19.6a3.6 3.6 0 0 1-.4-7.2 5 5 0 0 1 9.7.4 3.4 3.4 0 0 1-.3 6.8z" />
          </Glyph>
        </span>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 34,
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: "-.02em",
              color: C.primary,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            31°
          </div>
          <div style={{ marginTop: 5, fontSize: 12, color: C.secondary }}>
            Partly cloudy
          </div>
        </div>

        <span style={{ flex: 1 }} />

        <div style={{ textAlign: "right", minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: C.strong }}>Chennai</div>
          <div style={{ marginTop: 3, fontSize: 10.5, color: C.muted }}>
            Tamil Nadu, India
          </div>
        </div>
      </div>

      <div style={{ height: 14, flex: "none" }} />

      <div style={{ height: 44, flex: "none", display: "flex", gap: 8 }}>
        {[
          ["Feels", "35°"],
          ["Humidity", "74%"],
          ["Wind", "12 km/h"],
          ["Rain", "20%"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="notch-tile"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
            }}
          >
            <span style={{ fontSize: 9, letterSpacing: ".06em", color: C.muted }}>
              {label.toUpperCase()}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.strong }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ height: 14, flex: "none" }} />

      <div style={{ height: 62, flex: "none", display: "flex", gap: 4 }}>
        {FORECAST.map(([day, high, low], i) => (
          <div
            key={day}
            className={i === 0 ? "notch-tile" : undefined}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 9.5, color: i === 0 ? C.strong : C.muted }}>
              {day}
            </span>
            <span style={{ color: C.accentBright }}>
              <Glyph size={14}>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
              </Glyph>
            </span>
            <span
              style={{
                fontSize: 10,
                color: C.body,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {high}° <span style={{ color: C.muted }}>{low}°</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarPanel() {
  const today = 14;
  const offset = 5;

  return (
    <div style={{ width: "100%", height: "100%", padding: 16, display: "flex", gap: 12 }}>
      <div style={{ width: 210, flex: "none", display: "flex", flexDirection: "column" }}>
        <div
          style={{ height: 24, flex: "none", display: "flex", alignItems: "center", gap: 4 }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: C.strong }}>August</span>
          <span style={{ fontSize: 12, color: C.muted }}>2026</span>
          <span style={{ flex: 1 }} />
          <span style={{ color: C.muted }}>
            <Glyph size={12}>
              <path d="m14 6-6 6 6 6" />
            </Glyph>
          </span>
          <span style={{ color: C.muted }}>
            <Glyph size={12}>
              <path d="m10 6 6 6-6 6" />
            </Glyph>
          </span>
        </div>

        <div style={{ height: 8, flex: "none" }} />

        <div
          style={{
            height: 16,
            flex: "none",
            display: "grid",
            gridTemplateColumns: "repeat(7,1fr)",
          }}
        >
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span
              key={i}
              style={{
                textAlign: "center",
                lineHeight: "16px",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: ".06em",
                color: C.muted,
              }}
            >
              {d}
            </span>
          ))}
        </div>

        <div
          style={{
            height: 30 * 6,
            flex: "none",
            display: "grid",
            gridTemplateColumns: "repeat(7,1fr)",
            gridTemplateRows: "repeat(6,30px)",
          }}
        >
          {Array.from({ length: 42 }, (_, i) => {
            const day = i - offset + 1;
            const inMonth = day >= 1 && day <= 31;
            const isToday = inMonth && day === today;
            const hasDot = inMonth && [6, 14, 21, 27].includes(day);

            return (
              <span
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 22,
                    height: 22,
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: isToday ? 600 : 400,
                    fontVariantNumeric: "tabular-nums",
                    color: isToday
                      ? C.onAccent
                      : inMonth
                        ? C.body
                        : "rgba(255,255,255,.18)",
                    background: isToday ? C.accent : "transparent",
                  }}
                >
                  {inMonth ? day : ""}
                </span>
                <span
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 99,
                    background: hasDot && !isToday ? C.accentBright : "transparent",
                  }}
                />
              </span>
            );
          })}
        </div>
      </div>

      <div style={{ flex: "none", width: 1, background: C.dividerStrong }} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ height: 24, flex: "none", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.strong }}>
            Friday 14 August
          </span>
        </div>

        <div style={{ height: 8, flex: "none" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            ["Ship the Display page", "17:30", false],
            ["Call with Priya", "18:15", false],
            ["Renew domain", "09:00", true],
          ].map(([title, time, done]) => (
            <div
              key={title as string}
              className="notch-tile"
              style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 8 }}
            >
              <span
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 14,
                  height: 14,
                  flex: "none",
                  marginTop: 1,
                  borderRadius: 4,
                  border: done ? "none" : `1.5px solid ${C.muted}`,
                  background: done ? C.accent : "transparent",
                  color: C.onAccent,
                }}
              >
                {done && (
                  <svg viewBox="0 0 24 24" width={10} height={10} {...stroke} strokeWidth={3} stroke="currentColor">
                    <path d="m5 13 4 4 10-10" />
                  </svg>
                )}
              </span>

              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: done ? C.muted : C.body,
                    textDecoration: done ? "line-through" : undefined,
                  }}
                >
                  {title}
                </span>
                
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 3,
                    padding: "2px 6px",
                    borderRadius: 99,
                    background: C.hover,
                    fontSize: 9,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    color: C.secondary,
                  }}
                >
                  {time}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
