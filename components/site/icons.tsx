import type { SVGProps } from "react";

/*
  Hand-rolled so the marketing site stays dependency-free. The app itself uses
  lucide-react; these trace the same 24×24 grid and 2px stroke so the two read
  as one family.
*/

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
