/**
 * Weather, and the words for it.
 *
 * Mirrors `Weather` in `src-tauri/src/weather.rs`. Rust fetches, caches and
 * reshapes; everything a *reader* sees — what code 61 is called, which glyph it
 * gets — is decided here, because it is copy and copy belongs next to the other
 * copy rather than in a Rust match arm.
 */

export interface CurrentWeather {
  temperature: number
  apparentTemperature: number
  /** WMO weather code. See `WEATHER_CODES`. */
  code: number
  isDay: boolean
  humidity: number
  windSpeed: number
  precipitation: number
}

export interface ForecastDay {
  /** `YYYY-MM-DD` in the *place's* zone. Never parsed as a Date without care. */
  date: string
  code: number
  high: number
  low: number
  precipitationChance: number
}

export interface Weather {
  place: string
  current: CurrentWeather
  /** Today first, then the next six days. */
  forecast: ForecastDay[]
  fetchedAt: number
  /** Served from Rust's cache rather than the network. */
  cached: boolean
}

/** One row of the place search in Settings. Mirrors `Place` in `weather.rs`. */
export interface Place {
  name: string
  /** "Tamil Nadu, India" — what tells thirty Springfields apart. */
  detail: string
  latitude: number
  longitude: number
  timezone: string | null
}

/** The stored preference. Mirrors `WeatherPlace` in `settings.rs`. */
export interface WeatherPlace {
  name: string
  latitude: number
  longitude: number
  timezone: string | null
}

/**
 * WMO code → the words and the picture.
 *
 * The full table has around thirty entries that collapse into nine pictures: the
 * difference between "light drizzle" and "moderate drizzle" is real to a
 * meteorologist and not to someone deciding whether to take a coat. So codes are
 * grouped by what you would *do* about them, and the label keeps the distinction
 * that the glyph drops.
 *
 * `glyph` names a drawing in `WeatherGlyphs`; `day` and `night` differ only where
 * the picture would — a clear night is a moon, a thunderstorm is a thunderstorm.
 */
export type WeatherGlyph =
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'showers'
  | 'thunder'

interface CodeInfo {
  label: string
  glyph: WeatherGlyph
}

const CODES: Record<number, CodeInfo> = {
  0: { label: 'Clear', glyph: 'clear' },
  1: { label: 'Mainly clear', glyph: 'partly' },
  2: { label: 'Partly cloudy', glyph: 'partly' },
  3: { label: 'Overcast', glyph: 'cloudy' },
  45: { label: 'Fog', glyph: 'fog' },
  48: { label: 'Freezing fog', glyph: 'fog' },
  51: { label: 'Light drizzle', glyph: 'drizzle' },
  53: { label: 'Drizzle', glyph: 'drizzle' },
  55: { label: 'Heavy drizzle', glyph: 'drizzle' },
  56: { label: 'Freezing drizzle', glyph: 'drizzle' },
  57: { label: 'Freezing drizzle', glyph: 'drizzle' },
  61: { label: 'Light rain', glyph: 'rain' },
  63: { label: 'Rain', glyph: 'rain' },
  65: { label: 'Heavy rain', glyph: 'rain' },
  66: { label: 'Freezing rain', glyph: 'rain' },
  67: { label: 'Freezing rain', glyph: 'rain' },
  71: { label: 'Light snow', glyph: 'snow' },
  73: { label: 'Snow', glyph: 'snow' },
  75: { label: 'Heavy snow', glyph: 'snow' },
  77: { label: 'Snow grains', glyph: 'snow' },
  80: { label: 'Light showers', glyph: 'showers' },
  81: { label: 'Showers', glyph: 'showers' },
  82: { label: 'Violent showers', glyph: 'showers' },
  85: { label: 'Snow showers', glyph: 'snow' },
  86: { label: 'Heavy snow showers', glyph: 'snow' },
  95: { label: 'Thunderstorm', glyph: 'thunder' },
  96: { label: 'Thunderstorm, hail', glyph: 'thunder' },
  99: { label: 'Thunderstorm, hail', glyph: 'thunder' },
}

/**
 * An unknown code is drawn as cloud rather than as a gap.
 *
 * WMO adds codes and Open-Meteo passes through whatever the model produced. A
 * card that went blank on an unrecognised number would fail on exactly the
 * unusual weather someone would most want to look at.
 */
export function describeCode(code: number): CodeInfo {
  return CODES[code] ?? { label: 'Unsettled', glyph: 'cloudy' }
}

/** Rounded, with the degree sign. Never a decimal — nobody dresses by tenths. */
export function formatTemp(celsius: number): string {
  return `${Math.round(celsius)}°`
}

/**
 * The weekday for a forecast row.
 *
 * The date is a plain `YYYY-MM-DD` in the *place's* zone, so it is split by hand
 * rather than handed to `new Date(string)` — that parses a bare date as UTC
 * midnight, which lands on the previous day for anyone west of Greenwich and
 * would label every row wrong by one.
 */
export function weekdayOf(date: string, index: number): string {
  if (index === 0) return 'Today'
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return ''
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short' })
}
