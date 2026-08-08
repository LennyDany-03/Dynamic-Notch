/**
 * Design tokens — Fluent 2 / Windows 11 surface.
 *
 * Every value here is ported verbatim from `Dynamic Notch v2.dc.html` (the locked
 * Stitch export). If a value looks wrong, fix it in the design file first — this
 * file is a transcription, not a place to make design decisions.
 *
 * The one exception is `spring`: the design export is static HTML and carries no
 * motion values, so those are chosen here and marked as such.
 */

export const color = {
  /** Mica base surface. Sits over the wallpaper, never fully opaque. */
  micaBase: 'rgba(32,32,32,.80)',
  /** Top-only hairline highlight on the Mica shell (::after, not a full border). */
  micaHighlight: 'rgba(255,255,255,.10)',

  /** Inner tile fill. */
  tile: 'rgba(255,255,255,.055)',
  /** Top-only hairline on an inner tile. */
  tileHighlight: 'rgba(255,255,255,.12)',

  /** Inset well — search field and anything that reads as "recessed". */
  inset: 'rgba(0,0,0,.28)',
  insetShadow: 'inset 0 1px 2px rgba(0,0,0,.4)',

  /** Accent. Active states only — never a surface fill. */
  accent: '#7C3AED',
  /** Brighter accent, used only for the equalizer bars. */
  accentBright: '#A855F7',
  /** PDF glyph tint in the file shelf. */
  fileRed: '#F87171',

  text: {
    primary: '#fff',
    /** Row text, app-tile glyphs. */
    strong: 'rgba(255,255,255,.9)',
    /** Notes body. */
    body: 'rgba(255,255,255,.8)',
    /** Secondary / subtitle. */
    secondary: 'rgba(255,255,255,.6)',
    /** Row icons. */
    icon: 'rgba(255,255,255,.55)',
    /** Section labels, timestamps, placeholders. */
    muted: 'rgba(255,255,255,.4)',
  },

  /** Hairline between list rows. */
  divider: 'rgba(255,255,255,.06)',
  /** Vertical hairline between panes. */
  dividerStrong: 'rgba(255,255,255,.08)',
  /** Dashed drop-target outline. */
  dashed: 'rgba(255,255,255,.15)',
  /** Dashed "add a pin" slot. */
  dashedStrong: 'rgba(255,255,255,.18)',

  /** Inactive nav dot. */
  dotIdle: 'rgba(255,255,255,.2)',

  /** Unfilled portion of the media scrub bar. */
  scrubTrack: 'rgba(255,255,255,.15)',

  /** Album-art placeholder. */
  artGradient: 'linear-gradient(135deg,#4b3f6b,#241d38)',
} as const

export const radius = {
  /** Outer shell and the collapsed pill. */
  shell: 16,
  /** Inner tiles, buttons, search field. */
  tile: 8,
  /** Small chips, file-type icons. */
  small: 6,
  /** Fully round. */
  pill: 99,
} as const

export const font = {
  sans: "'Segoe UI Variable','Segoe UI','Inter',system-ui,sans-serif",
  mono: 'ui-monospace,Menlo,monospace',
} as const

/**
 * Section label — 10px/600, .14em tracking, uppercase, muted.
 * Note: uppercase is a *rendering* treatment; the underlying strings stay
 * sentence case per the type rules.
 */
export const sectionLabel = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  color: color.text.muted,
} as const

/**
 * Card dimensions per state.
 *
 * Widths are the design export's. Heights are the design's content height plus
 * `navStripHeight`, because the nav row now lives inside the card (see layout.ts).
 *
 * Media is the exception: the design labels state 02 "380 × 110" and draws the
 * card at 124, but its own contents measure ~104px and the card only offers 96
 * after padding — so the design file overflows itself and clips the transport
 * row. 138 is the smallest content height that fits the design's own margins with
 * a little slack. Everything else is unchanged.
 */
export const size = {
  peek: { width: 200, height: 32 },
  /**
   * NOT from the design export — the export has no notification state. Sized to
   * the content it carries (44px art, two lines of type, an equalizer) and kept
   * deliberately short of the media card's 380: a banner that reported a track
   * at the same width as the player would read as the player opening itself.
   */
  announce: { width: 300, height: 64 },
  media: { width: 380, height: 164 },
  launcher: { width: 400, height: 346 },
  files: { width: 440, height: 206 },
} as const

/** Springs — NOT from the design export (it is static). Tuned for Fluent motion. */
export const spring = {
  /** hidden → peek, and peek → hidden. Snappy. */
  peek: { type: 'spring' as const, stiffness: 520, damping: 34, mass: 0.9 },
  /** peek ↔ expanded, and module → module resize. Slightly softer. */
  expand: { type: 'spring' as const, stiffness: 360, damping: 28, mass: 1 },
  /** Content cross-fade inside an expanded card. */
  content: { type: 'spring' as const, stiffness: 460, damping: 34, mass: 0.8 },
} as const

/** Interaction timings from the master spec. */
export const timing = {
  /** Continuous dwell in hotzone/pill before auto-expanding. */
  dwellMs: 600,
  /** Grace period after the cursor leaves, before stepping down a state. */
  graceMs: 300,
  /**
   * How long a card the user did not open stays up before retracting — today,
   * the media card announcing a track that has just started playing.
   *
   * Long enough to read a title and reach for the notch, short enough that it
   * reads as a notification rather than the overlay opening itself.
   */
  announceMs: 2000,
} as const

/** Top-center trigger strip at the very top edge of the screen, in CSS px. */
export const hotzone = {
  width: 80,
  height: 6,
} as const
