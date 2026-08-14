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

  /**
   * Accent. Active states only — never a surface fill.
   *
   * A CSS variable rather than the export's `#7C3AED` literal, because the accent
   * is a preference now (`accentColor`). Inline styles take `var()` perfectly
   * well, so every existing `color.accent` reader picks the change up for free
   * and no component has to learn what the preference is. The literal survives as
   * the `:root` fallback in `index.css` and as the Rust default.
   */
  accent: 'var(--accent)',
  /**
   * Brighter accent, used only for the equalizer bars. Derived from `--accent`
   * in CSS, so a custom hue keeps the same relationship the export had between
   * these two rather than pinning `#A855F7` next to an unrelated colour.
   */
  accentBright: 'var(--accent-bright)',
  /** Faint accent fill behind an active glyph — a tile that is "lit". */
  accentWash: 'var(--accent-wash)',
  /** The faintest step: a live drop target, a hovered accented row. */
  accentWashSoft: 'var(--accent-wash-soft)',
  /** PDF glyph tint in the file shelf. */
  fileRed: '#F87171',

  /**
   * NOT from the design export — it has no system monitor. Severity for the load
   * meters, and the one place in the app where colour carries meaning on its own
   * rather than marking an active state.
   *
   * That is a deliberate exception to the accent rule, and it is narrow: a meter
   * has no state to be active in, and "your machine is struggling" is exactly the
   * message a colour is better at than a number. Three steps and no more, because
   * a gradient would say a machine at 71% is meaningfully different from one at
   * 69% — it is not, and the eye would keep asking.
   *
   * `busy` is the accent, so an ordinary working machine is drawn in the app's own
   * colour — the user's own colour, since the accent is a preference — rather than
   * in a warning. `warn` and `hot` borrow Fluent's caution and critical hues and
   * are deliberately *not* customisable: they mean "caution" and "stop", and a
   * user who set their accent to red would otherwise have three reds that say
   * different things. `hot` is `fileRed`, so there is one red in the app.
   */
  load: {
    busy: 'var(--accent)',
    warn: '#FBBF24',
    hot: '#F87171',
  },

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
  /**
   * The resting pill. **Deliberately not the design export's 200×32.**
   *
   * The export's pill carried one thing — a track title — and 200 was generous
   * for it. It now carries three: a music mark, the clock, and the charge. At 200
   * the battery badge came within a pixel or two of the clock, and the whole pill
   * read as crowded rather than resting (which is what the redesign was asked to
   * fix). 264 gives each of the three its own column with air between them; 34
   * lets the two chips sit inside it without touching the edges.
   *
   * The ceiling is `announce`'s 300: the banner has to stay visibly larger than
   * the pill, or the notch reporting something looks the same as the notch simply
   * being there. Anything that wants more room than this belongs in a card.
   */
  peek: { width: 264, height: 34 },
  /**
   * NOT from the design export — the export has no notification state. Sized to
   * the content it carries (44px art, two lines of type, an equalizer) and kept
   * deliberately short of the media card's 380: a banner that reported a track
   * at the same width as the player would read as the player opening itself.
   */
  announce: { width: 300, height: 64 },
  media: { width: 380, height: 164 },
  launcher: { width: 400, height: 346 },
  /**
   * The file shelf and notes card. **Deliberately not the export's 206.**
   *
   * The export drew a single-line note pane beside a one-row shelf, and 206 was
   * right for that. It now carries a note *list* beside an editor, and a shelf
   * that wraps to a second row — and the editor was the complaint: four visible
   * lines is a card you cannot think in, which is what "larger expansion for
   * notes" asked for. At 346 the editor holds about fourteen lines, and the full
   * card's worth is one click away in the expanded sheet.
   *
   * 346 exactly, matching the launcher, because that is the tallest card there
   * is: going past it would grow the region that holds the notch open for every
   * module, which `layout.contentRect` exists to avoid.
   */
  files: { width: 440, height: 346 },
  /**
   * NOT from the design export either — see `NotchModule`. The height is a
   * *ceiling*, not the card: this is the one module sized to its contents, and
   * `notificationsCardHeight` in `layout.ts` grows it a row at a time up to this
   * and then scrolls. Deliberately no taller than the launcher and no wider than
   * the file shelf, which are the largest cards in each axis — anything past them
   * enlarges the region that holds the notch open.
   */
  notifications: { width: 420, height: 300 },
  /**
   * NOT from the design export either — the export predates the system monitor.
   *
   * Every number in it is load-bearing, because unlike `notifications` this card
   * has fixed contents and so it is sized *to* them rather than the other way
   * round. Vertically: 26 nav + 16 padding + 16 header + 10 + four 34px meters +
   * 12 + 34 power row + 16 padding = 266. `SystemModule` pins every one of those
   * boxes, so changing a row height here without changing it there leaves a
   * stripe of empty Mica holding the notch open — the dead zone `layout.ts`
   * warns about.
   *
   * 380 wide, matching the media card rather than reaching for the file shelf's
   * 440: four meters and three buttons need less room than the shelf, and the
   * widest card is what sets how much desktop the expanded notch covers.
   */
  system: { width: 380, height: 266 },
  /**
   * NOT from the design export — it predates the weather module.
   *
   * 26 nav + 16 padding + 76 conditions block + 14 + 44 detail strip + 14 + 62
   * forecast strip + 16 padding = 268. Wide enough for seven forecast columns at
   * 48px with the gaps, which is the number that makes "the rest of the week"
   * mean a week.
   */
  weather: { width: 400, height: 268 },
  /**
   * NOT from the design export either. The tallest and widest card in the app,
   * tied with the launcher and the file shelf respectively — a month grid has six
   * possible week rows and there is no honest way to draw fewer.
   *
   * 26 nav + 16 padding + 24 month header + 8 + 16 weekday row + 6×30 grid + 16
   * padding = 286. The right pane rides alongside at the same height rather than
   * adding to it.
   */
  calendar: { width: 440, height: 286 },
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
   * How long a banner the user did not ask for stays up before retracting — a
   * track starting, a notification arriving.
   *
   * Long enough to read a message and reach for the notch, short enough that it
   * still reads as a report rather than the overlay opening itself. Two seconds
   * was the first cut and ran out while you were still reading the second line.
   */
  announceMs: 3000,
  /**
   * How long a card opened by something other than the cursor holds itself open
   * before the ordinary rules resume.
   *
   * The tray is at the bottom of the screen and the notch at the top, so the pin
   * has to outlast the trip; four seconds is that trip several times over. It is
   * a ceiling, not a delay — the cursor arriving releases the pin at once. What
   * it prevents is a card opened from the tray and then ignored staying expanded
   * and topmost for the life of the process, which is what happened when the pin
   * had no expiry.
   */
  pinMs: 4000,
} as const

/** Top-center trigger strip at the very top edge of the screen, in CSS px. */
export const hotzone = {
  width: 80,
  height: 6,
} as const
