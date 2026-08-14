/**
 * Design tokens — Fluent 2 / Windows 11 surface.
 *
 * Every value here is ported from `Dynamic Notch v2.dc.html` (the locked Stitch
 * export). If a value looks wrong, fix it in the design file first — this file is
 * a transcription, not a place to make design decisions.
 *
 * The one exception is `spring`: the design export is static HTML and carries no
 * motion values, so those are chosen here and marked as such.
 *
 * **Every colour is a `var()`, and that is the whole theme mechanism.** The
 * export's literals live in `index.css`, in the `[data-theme='crest']` block that
 * is still the default; four other palettes sit beside it and `useTheme` picks
 * one with a single attribute on `:root`. This indirection is the same one the
 * accent has had since it became a preference, extended to the rest of the
 * palette for the same reason: the surface is read by every component in three
 * windows, and threading a palette through all of them would put a preference in
 * every component that happens to draw a hairline.
 *
 * So the values below are *names*, and the design decisions are in `index.css`.
 * The comments are what each name is for, which is what a caller needs in order
 * to pick the right one — a component choosing `divider` over `dividerStrong` is
 * saying what it is drawing, not what colour it wants.
 */

export const color = {
  /** Mica base surface. Sits over the wallpaper, never fully opaque. */
  micaBase: 'rgba(var(--mica-rgb),var(--mica-alpha))',
  /** Top-only hairline highlight on the Mica shell (::after, not a full border). */
  micaHighlight: 'var(--mica-highlight)',

  /** Inner tile fill. */
  tile: 'var(--tile)',
  /** Top-only hairline on an inner tile. */
  tileHighlight: 'var(--tile-highlight)',

  /**
   * The faintest wash there is — a pane set half a shade back from the one
   * beside it, and nothing more. Below `hover` on purpose, so a hover state
   * drawn on top of it is still a change.
   */
  wash: 'var(--wash)',

  /**
   * A row or tile under the cursor.
   *
   * Its own token rather than a literal at each call site, which is what it used
   * to be: a hover wash is white on the four dark themes and *black* on Daylight,
   * and a white one there is a hover state nobody can see.
   */
  hover: 'var(--hover)',
  /** The heavier step — a hovered tile that already sits on `tile`. */
  hoverStrong: 'var(--hover-strong)',

  /** Inset well — search field and anything that reads as "recessed". */
  inset: 'var(--inset)',
  insetShadow: 'var(--inset-shadow)',

  /**
   * Accent. Active states only — never a surface fill.
   *
   * Set by the theme and overridden by the `accentColor` preference, which
   * `useAccentColor` writes inline on `:root` — so picking a theme sets a
   * matching accent and picking an accent afterwards keeps it.
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
  /**
   * Text and glyphs drawn *on* an accent fill — a selected day, the knob of a
   * switch that is on, the app mark.
   *
   * White in the two themes whose accent is dark enough to carry it, and the
   * background colour in the three whose accent is not: Glacier's ice blue,
   * Ember's amber and Mono's near-white are all surfaces in their own right, and
   * white-on-white was what a hardcoded `#fff` gave them.
   */
  onAccent: 'var(--on-accent)',
  /** Full-card backdrop behind a sheet — the app picker, a notification detail. */
  scrim: 'var(--scrim)',
  /** A sheet or popup lifted off the card it covers. */
  popShadow: 'var(--pop-shadow)',

  /**
   * Stop. Error copy, the critical step of a load meter, the PDF glyph in the
   * file shelf — deliberately one red, so the colour means one thing.
   */
  fileRed: 'var(--danger)',

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
   * colour rather than in a warning. `warn` and `hot` are caution and stop, and
   * are deliberately not reachable from the accent preference: a user who set
   * their accent to red would otherwise have three reds that say different things.
   * They do move per *theme*, which is a different thing — amber-400 is invisible
   * on Daylight's white and indistinguishable from Ember's own accent, and a
   * warning that cannot be read is not a warning. `hot` is `fileRed`, so there is
   * one red in the app.
   */
  load: {
    busy: 'var(--accent)',
    warn: 'var(--load-warn)',
    hot: 'var(--danger)',
  },

  text: {
    primary: 'var(--text-primary)',
    /** Row text, app-tile glyphs. */
    strong: 'var(--text-strong)',
    /** Notes body. */
    body: 'var(--text-body)',
    /** Secondary / subtitle. */
    secondary: 'var(--text-secondary)',
    /** Row icons. */
    icon: 'var(--text-icon)',
    /** Section labels, timestamps, placeholders. */
    muted: 'var(--text-muted)',
  },

  /** Hairline between list rows. */
  divider: 'var(--divider)',
  /** Vertical hairline between panes. */
  dividerStrong: 'var(--divider-strong)',
  /** Dashed drop-target outline. */
  dashed: 'var(--dashed)',
  /** Dashed "add a pin" slot. */
  dashedStrong: 'var(--dashed-strong)',

  /** Inactive nav dot. */
  dotIdle: 'var(--dot-idle)',

  /** Unfilled portion of the media scrub bar. */
  scrubTrack: 'var(--scrub-track)',

  /** Album-art placeholder. Carries a white glyph in every theme. */
  artGradient: 'var(--art-gradient)',
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
   * right for that. It now carries a note list beside an editor, and a shelf that
   * wraps rather than scrolling sideways.
   *
   * 260 after a correction. This went to 346 first — the launcher's height, the
   * tallest card there is — on the reasoning that a four-line editor is a card
   * you cannot think in. That was true and it overshot: a shelf holding two files
   * drew a dashed box with about a hundred and fifty pixels of nothing in it, and
   * an empty stripe inside a card is the dead zone `layout.contentRect` warns
   * about, only self-inflicted. It holds the notch open over nothing.
   *
   * At 260 the shelf fits two rows of tiles with the box actually filled, and the
   * editor holds about nine lines inline — and the answer to "I need more room
   * than that" is the expansion, which takes the whole card, rather than a card
   * that is permanently sized for the longest note anyone might write.
   */
  files: { width: 440, height: 260 },
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
