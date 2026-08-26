import type { SVGProps } from "react";
import type { SocialId } from "@/lib/site";

type Icon = (props: SVGProps<SVGSVGElement>) => React.ReactElement;

function base(props: SVGProps<SVGSVGElement>) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    width: 20,
    height: 20,
    "aria-hidden": true,
    ...props,
  };
}

export const Download: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M12 3v12" />
    <path d="m7 11 5 5 5-5" />
    <path d="M4 20h16" />
  </svg>
);

export const Github: Icon = (p) => (
  <svg {...base(p)} strokeWidth={0} fill="currentColor">
    <path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.47c.53.1.72-.23.72-.5v-1.82c-2.92.63-3.54-1.4-3.54-1.4-.48-1.22-1.17-1.55-1.17-1.55-.95-.65.07-.64.07-.64 1.06.08 1.61 1.09 1.61 1.09.94 1.6 2.46 1.14 3.06.87.1-.68.37-1.14.67-1.4-2.33-.27-4.78-1.17-4.78-5.2 0-1.15.41-2.09 1.09-2.82-.11-.27-.47-1.34.1-2.8 0 0 .89-.29 2.9 1.08a10 10 0 0 1 5.28 0c2.01-1.37 2.9-1.08 2.9-1.08.57 1.46.21 2.53.1 2.8.68.73 1.09 1.67 1.09 2.82 0 4.04-2.46 4.93-4.8 5.19.38.33.71.97.71 1.96v2.9c0 .28.19.61.72.5A10.5 10.5 0 0 0 12 1.5Z" />
  </svg>
);

export const Mail: Icon = (p) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.5 7.5 7.4 5.2a2 2 0 0 0 2.2 0l7.4-5.2" />
  </svg>
);

export const Music: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M9 18V6l11-2v12" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="17" cy="16" r="3" />
  </svg>
);

export const Grid: Icon = (p) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1.6" />
    <rect x="14" y="3" width="7" height="7" rx="1.6" />
    <rect x="3" y="14" width="7" height="7" rx="1.6" />
    <rect x="14" y="14" width="7" height="7" rx="1.6" />
  </svg>
);

export const Clipboard: Icon = (p) => (
  <svg {...base(p)}>
    <rect x="8" y="2" width="8" height="4" rx="1.2" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M9 13h6M9 17h4" />
  </svg>
);

export const Files: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
    <path d="M14 3v6h6" />
  </svg>
);

export const Note: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
    <path d="M8 12h8M8 16h5M8 8h4" />
  </svg>
);

export const Ghost: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M12 2a7 7 0 0 0-7 7v12l3-2 2 2 2-2 2 2 2-2 3 2V9a7 7 0 0 0-7-7Z" />
    <path d="M9.5 10h.01M14.5 10h.01" />
  </svg>
);

export const Clock: Icon = (p) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const Bolt: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />
  </svg>
);

export const Shield: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M12 2.5 4.5 5.5v6c0 4.5 3.1 8.6 7.5 10 4.4-1.4 7.5-5.5 7.5-10v-6Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const Windows: Icon = (p) => (
  <svg {...base(p)} strokeWidth={0} fill="currentColor">
    <path d="M3 5.6 10.4 4.6v7.1H3Zm0 12.8 7.4 1V11.9H3ZM11.4 4.4 21 3v8.7h-9.6Zm0 15.2L21 21v-8.6h-9.6Z" />
  </svg>
);

export const Check: Icon = (p) => (
  <svg {...base(p)}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const ChevronLeft: Icon = (p) => (
  <svg {...base(p)}>
    <path d="m14.5 5-7 7 7 7" />
  </svg>
);

export const ChevronRight: Icon = (p) => (
  <svg {...base(p)}>
    <path d="m9.5 5 7 7-7 7" />
  </svg>
);

export const ExternalLink: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </svg>
);

export const ArrowRight: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M4 12h15" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

export const Sparkles: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M12 3.5 13.7 8l4.5 1.7-4.5 1.7L12 15.9l-1.7-4.5L5.8 9.7 10.3 8Z" />
    <path d="M18.5 15.5 19.3 17.7l2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" />
  </svg>
);

export const Close: Icon = (p) => (
  <svg {...base(p)}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const Search: Icon = (p) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

export const Play: Icon = (p) => (
  <svg {...base(p)} strokeWidth={0} fill="currentColor">
    <path d="M8 5.5v13l11-6.5Z" />
  </svg>
);

export const Pause: Icon = (p) => (
  <svg {...base(p)} strokeWidth={0} fill="currentColor">
    <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
    <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
  </svg>
);

export const SkipBack: Icon = (p) => (
  <svg {...base(p)} strokeWidth={0} fill="currentColor">
    <path d="M17 5.5v13L8 12Z" />
    <rect x="5" y="5.5" width="2.2" height="13" rx="1.1" />
  </svg>
);

export const SkipForward: Icon = (p) => (
  <svg {...base(p)} strokeWidth={0} fill="currentColor">
    <path d="M7 5.5v13L16 12Z" />
    <rect x="16.8" y="5.5" width="2.2" height="13" rx="1.1" />
  </svg>
);

export const Bell: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M6 9a6 6 0 1 1 12 0c0 4 1.4 5.6 2 6.4H4c.6-.8 2-2.4 2-6.4Z" />
    <path d="M10 19.5a2.2 2.2 0 0 0 4 0" />
  </svg>
);

export const BellOff: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M8.2 5.4A6 6 0 0 1 18 9c0 4 1.4 5.6 2 6.4H9" />
    <path d="M6.1 8a6 6 0 0 0-.1 1c0 4-1.4 5.6-2 6.4h2" />
    <path d="M10 19.5a2.2 2.2 0 0 0 4 0" />
    <path d="m3.5 3.5 17 17" />
  </svg>
);

export const Position: Icon = (p) => (
  <svg {...base(p)}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.2" />
    <path d="M9 5h6v2.6a1.4 1.4 0 0 1-1.4 1.4h-3.2A1.4 1.4 0 0 1 9 7.6Z" fill="currentColor" strokeWidth={0} />
  </svg>
);

export const Target: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M4 4h16" />
    <path d="M12 20v-9" />
    <path d="m8 14 4-4 4 4" />
  </svg>
);

export const Layers: Icon = (p) => (
  <svg {...base(p)}>
    <path d="m12 2.5 8.5 4.5L12 11.5 3.5 7Z" />
    <path d="m3.5 12 8.5 4.5 8.5-4.5" />
    <path d="m3.5 17 8.5 4.5 8.5-4.5" />
  </svg>
);

export const Contrast: Icon = (p) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" strokeWidth={0} />
  </svg>
);

export const Sliders: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2.2" />
    <circle cx="9" cy="17" r="2.2" />
  </svg>
);

export const Pin: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M9 3h6l-1 6 3.5 3.5H6.5L10 9Z" />
    <path d="M12 12.5V21" />
  </svg>
);

export const Gauge: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M3 13h3.5l2-5 3 10 2.5-7 1.5 2H21" />
  </svg>
);

export const Cloud: Icon = (p) => (
  <svg {...base(p)}>
    <circle cx="8.5" cy="8.5" r="3" />
    <path d="M8.5 2.6v1.4M3.1 8.5h1.4M4.6 4.6l1 1M12.4 4.6l-1 1" />
    <path d="M8.4 19.6a3.6 3.6 0 0 1-.4-7.2 5 5 0 0 1 9.7.4 3.4 3.4 0 0 1-.3 6.8Z" />
  </svg>
);

export const Calendar: Icon = (p) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
    <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
    <circle cx="12" cy="15" r="1.4" fill="currentColor" strokeWidth={0} />
  </svg>
);

export const Palette: Icon = (p) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="13" height="13" rx="2.5" />
    <path d="M8 8h10a2.5 2.5 0 0 1 2.5 2.5V21h-10A2.5 2.5 0 0 1 8 18.5Z" />
    <path d="M8 16h8.5v5H10a2 2 0 0 1-2-2Z" fill="currentColor" strokeWidth={0} />
  </svg>
);

export const Droplet: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M12 3a9 9 0 0 0 0 18c1.4 0 2.2-.9 2.2-2 0-1-.7-1.6-.7-2.4 0-.7.6-1.3 1.4-1.3H17a4.5 4.5 0 0 0 4.5-4.6C21.5 6.3 17.3 3 12 3Z" />
    <circle cx="7.6" cy="11.4" r="1.1" fill="currentColor" strokeWidth={0} />
    <circle cx="11" cy="7.8" r="1.1" fill="currentColor" strokeWidth={0} />
    <circle cx="15.4" cy="8.8" r="1.1" fill="currentColor" strokeWidth={0} />
  </svg>
);

export const Screen: Icon = (p) => (
  <svg {...base(p)}>
    <rect x="2.5" y="4.5" width="19" height="13" rx="2.5" />
    <path d="M9 4.7h6v1.8a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z" fill="currentColor" strokeWidth={0} />
    <path d="M8.5 20.5h7" />
  </svg>
);

export const Displays: Icon = (p) => (
  <svg {...base(p)}>
    <rect x="2" y="5" width="11" height="8" rx="1.8" />
    <rect x="11" y="11" width="11" height="8" rx="1.8" />
    <path d="M5.5 5.2h4v1.1a.7.7 0 0 1-.7.7H6.2a.7.7 0 0 1-.7-.7Z" fill="currentColor" strokeWidth={0} />
    <path d="M14.5 11.2h4v1.1a.7.7 0 0 1-.7.7h-2.6a.7.7 0 0 1-.7-.7Z" fill="currentColor" strokeWidth={0} />
  </svg>
);

export const List: Icon = (p) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="6" rx="2" />
    <rect x="3" y="14" width="11" height="6" rx="2" />
    <path d="M17.5 17H21" />
  </svg>
);

export const Scroll: Icon = (p) => (
  <svg {...base(p)}>
    <rect x="8" y="3" width="8" height="13" rx="4" />
    <path d="M12 6.5v2.5" />
    <path d="m9.5 20.5 2.5-2.5 2.5 2.5" />
  </svg>
);

export const Refresh: Icon = (p) => (
  <svg {...base(p)}>
    <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
    <path d="M20.5 4.5V10H15" />
  </svg>
);

export const Users: Icon = (p) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4" />
    <path d="M18 14.4A6.5 6.5 0 0 1 21.5 20" />
  </svg>
);

export const Discord: Icon = (p) => (
  <svg {...base(p)} strokeWidth={0} fill="currentColor">
    <path d="M19.3 5.6A16.4 16.4 0 0 0 15.2 4.3l-.2.4a15 15 0 0 0-5.9 0l-.2-.4a16.4 16.4 0 0 0-4.1 1.3C2 9.6 1.3 13.5 1.6 17.3a16.6 16.6 0 0 0 5 2.6l1.1-1.8a10.8 10.8 0 0 1-1.7-.8l.4-.3a11.9 11.9 0 0 0 10.1 0l.4.3a10.8 10.8 0 0 1-1.7.8l1.1 1.8a16.5 16.5 0 0 0 5-2.6c.4-4.4-.7-8.3-3-11.7ZM8.4 15c-1 0-1.8-.9-1.8-2.1s.8-2.1 1.8-2.1 1.9.9 1.8 2.1S9.4 15 8.4 15Zm7.2 0c-1 0-1.8-.9-1.8-2.1s.8-2.1 1.8-2.1 1.9.9 1.8 2.1-.8 2.1-1.8 2.1Z" />
  </svg>
);

export const Instagram: Icon = (p) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" strokeWidth={0} />
  </svg>
);

export const X: Icon = (p) => (
  <svg {...base(p)} strokeWidth={0} fill="currentColor">
    <path d="M17.5 3h3.2l-7 8 8.2 10h-6.4l-5-6.1L4.7 21H1.5l7.5-8.6L1.1 3h6.6l4.5 5.6Zm-1.1 16h1.8L7.7 4.8H5.8Z" />
  </svg>
);

export const YouTube: Icon = (p) => (
  <svg {...base(p)} strokeWidth={0} fill="currentColor">
    <path d="M22.2 7.2a2.7 2.7 0 0 0-1.9-1.9C18.6 4.8 12 4.8 12 4.8s-6.6 0-8.3.5A2.7 2.7 0 0 0 1.8 7.2 28 28 0 0 0 1.3 12a28 28 0 0 0 .5 4.8 2.7 2.7 0 0 0 1.9 1.9c1.7.5 8.3.5 8.3.5s6.6 0 8.3-.5a2.7 2.7 0 0 0 1.9-1.9 28 28 0 0 0 .5-4.8 28 28 0 0 0-.5-4.8ZM9.9 15.2V8.8l5.5 3.2Z" />
  </svg>
);

export const SOCIAL_ICONS: Record<SocialId, Icon> = {
  discord: Discord,
  github: Github,
  instagram: Instagram,
  x: X,
  youtube: YouTube,
};
