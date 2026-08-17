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
  /**
   * Outer shell and the collapsed pill.
   *
   * A `var()` rather than the export's 16 for exactly the reason every colour is:
   * it became a preference (`cornerRadius`), and it is one declaration read by
   * four windows' worth of Mica shells — the notch's cards, the tray popup, the
   * settings window and the notes sheet. Threading a number through all of them
   * would put a preference in every component that happens to draw a surface.
   * `useCornerRadius` writes it per window; `index.css` carries the export's own
   * 16 as the fallback.
   *
   * The inner radii below are deliberately *not* reachable from the preference.
   * They are the radius of a tile inside a card, and scaling them with the shell
   * would make a square-cornered notch square-corner its own list rows — which is
   * not what "corner radius" means to anyone, and which the design has opinions
   * about that a slider should not overrule.
   */
  shell: 'var(--radius-shell)',
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
   * NOT from the design export either. The tallest card in the app, tied with the
   * launcher — a month grid has six possible week rows and there is no honest way
   * to draw fewer — and now the widest outright.
   *
   * 26 nav + 16 padding + 24 month header + 8 + 16 weekday row + 6×30 grid + 16
   * padding = 286. The right pane rides alongside at the same height rather than
   * adding to it.
   *
   * 480 rather than the 440 it shipped at, and the only card that has ever been
   * widened after the fact. It is the one card carrying two panes: a month, whose
   * width is seven columns and not negotiable below about 30px a cell, and a list
   * of things the user typed, which was getting whatever was left — 155px, of
   * which a title saw 70. Every other way of finding room for it takes from the
   * month. The extra 40 costs nothing structural, because `contentRect` is
   * per-module and this card's rect only holds the notch open while the calendar
   * is the card on screen; 480 in the 560 canvas still leaves 40px either side.
   */
  calendar: { width: 480, height: 286 },
  /**
   * NOT from the design export either — it predates Quick Access entirely.
   *
   * Sized *to* its contents, like `system` and unlike `notifications`: two roles
   * is the whole card, and every box in the arithmetic is pinned in
   * `QuickAccessModule`. 26 nav + 8 padding + 14 header + 8 + 56 row + 6 + 56 row
   * + 12 padding = 186.
   *
   * It shipped at 238, sized to leave room under the second row for a dropdown
   * anchored to it. That is the dead zone `layout.contentRect` warns about, drawn
   * inside the visible card: fifty pixels of empty Mica under the last row, held
   * open over nothing whenever the picker was shut — which is nearly always. The
   * endpoint list is a full-card sheet now, so the card is only ever as tall as
   * what is in it. Do not re-reserve space here for a menu.
   *
   * 420 matches the notifications card, and it is what a Windows endpoint name
   * needs: "Speakers (High Definition Audio Device)" is not a string anyone gets
   * to shorten.
   */
  quickAccess: { width: 420, height: 186 },
  /**
   * NOT from the design export either — it predates the screenshot shelf.
   *
   * Sized *to* its contents like `system` and `quickAccess`, and every box in the
   * arithmetic is pinned in `ScreenshotsModule`: 26 nav + 12 padding + 101 tile row
   * + 8 gap + 101 tile row + 12 padding = 260.
   *
   * There is no header in that sum, and the card is the same 260 it was with one:
   * the section label said "Screenshots" directly under a nav strip already
   * reading `‹ SCREENSHOTS ›`, so it went and its 26px went to the tiles instead of
   * shrinking the card. See `ScreenshotsModule`.
   *
   * Two rows of three and then it scrolls, which is the same trade the file shelf
   * makes and for the same reason — this is the capture you took a minute ago, and
   * a wall of forty thumbnails is Explorer's job. A fixed two rows rather than a
   * height that follows the count (which is what `notifications` does) because a
   * grid that is *always* full is the normal case here: the folder has whatever
   * has accumulated in it, so the card would sit at its ceiling almost always and
   * the arithmetic would buy nothing.
   *
   * 420 matches the notifications and Quick Access cards. Three columns rather than
   * four because a screenshot is 16:9: at four the tile is squarer than the picture
   * in it and every capture is letterboxed into two-thirds of its own tile, which
   * is the difference between recognising a window and squinting at one.
   */
  screenshots: { width: 420, height: 260 },
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

/**
 * A spring, widened.
 *
 * Written out rather than derived from `spring` above, because `as const` makes
 * every number in that object its own literal type — so a derived type would say
 * a stiffness is `520 | 360 | 460`, and `scaleSpring` exists precisely to return
 * one that is none of those.
 */
export interface Spring {
  type: 'spring'
  stiffness: number
  damping: number
  mass: number
}

/**
 * Run one of the springs above at a different speed, as a percentage.
 *
 * **Stiffness by the square, damping by the factor**, and that pair is the whole
 * point of this function existing rather than callers multiplying a number. A
 * spring's character is its damping ratio, ζ = c / 2√(km): scale the stiffness
 * alone and ζ falls, so a "faster" notch would also start overshooting and
 * wobbling, which is a different animation rather than the same one in less time.
 * Scaling k by s² and c by s leaves ζ exactly where it was and moves only the
 * frequency — so at 150% the card settles in two-thirds the time with precisely
 * the design's own overshoot, and at 50% it is the same motion, slowly.
 *
 * Mass is untouched, being the third term the ratio is already balanced against.
 */
export function scaleSpring(base: Spring, percent: number): Spring {
  if (percent === 100) return base
  const factor = percent / 100
  return {
    ...base,
    stiffness: base.stiffness * factor * factor,
    damping: base.damping * factor,
  }
}

/**
 * The same scaling for the plain duration transitions — the panel cross-fade.
 *
 * Divided rather than multiplied: `percent` is a speed and this is a time, so
 * 200% is half as long. Floored well below anything perceptible rather than
 * allowed to reach zero, because a cross-fade of exactly 0 is a cut, and a card
 * swapping instantly under a stationary cursor reads as a glitch rather than as a
 * fast transition.
 */
export function scaleDuration(seconds: number, percent: number): number {
  return Math.max(0.02, seconds / (percent / 100))
}

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
  /**
   * How long the notch stays open after the last keystroke, once the cursor has
   * left the card.
   *
   * Typing is the one thing the user does on the notch that the cursor stops
   * reporting: the caret is in a field, the mouse has been let go of, and the
   * ordinary grace window would collapse the card out from under a half-typed
   * task. So a focused text field holds the notch open — and, exactly like the
   * pin, that hold is leased rather than open-ended, because a hold with no
   * expiry is how a card ends up on screen for the life of the process (see
   * `pinMs`). The other two releases need something to happen: the field losing
   * focus, or the window blurring, which only fires for a window that had focus
   * in the first place.
   *
   * Fifteen seconds is a pause for thought mid-sentence several times over,
   * while still being a short wait for a card someone typed into and walked away
   * from. Nothing is lost when it does expire — the draft is kept across the
   * collapse (see `useStickyState`), so this decides how long the card *stays*,
   * not whether the text survives.
   */
  typingMs: 15000,
  /**
   * How long a snoozed notification stays out of the list before it is announced
   * again.
   *
   * Five minutes because snooze is for "not while I am in the middle of this",
   * not for "tomorrow" — the notification is still in Windows' own centre the
   * whole time, so nothing is being deferred that could not be gone back to. It
   * is in-memory and deliberately not persisted: a snooze that survived a
   * relaunch would fire a banner for something the user last saw days ago.
   */
  snoozeMs: 5 * 60 * 1000,
} as const

/** Top-center trigger strip at the very top edge of the screen, in CSS px. */
export const hotzone = {
  width: 80,
  height: 6,
} as const
