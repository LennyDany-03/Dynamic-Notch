import { color } from '../../tokens'
import { describeCode, type WeatherGlyph } from '../../types/weather'

/**
 * The pictures on the weather card.
 *
 * Unlike `SystemGlyphs`, these do not animate. That file's rule is that the
 * *movement* is the message, because a banner is on screen for three seconds and
 * reports something that just happened. Weather is the opposite: the card is
 * looked at deliberately, nothing has "just happened", and eight glyphs drawing
 * themselves in every time the card opens would be decoration rather than
 * information. They are still stroke-only, so they sit in the same family.
 *
 * Nine pictures for thirty WMO codes — the grouping is in `types/weather.ts`,
 * next to the labels, because "which codes look alike" and "what do we call them"
 * are one decision.
 *
 * Colour is carried, not invented: rain and snow take the accent so the card has
 * one accented thing on it, and everything else is drawn in the ordinary icon
 * grey. A sun in yellow and a cloud in blue would be a second palette competing
 * with the one the rest of the app uses — and with whatever accent the user has
 * chosen.
 */

const stroke = {
  fill: 'none',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** The cloud every overcast picture is built on. */
const CLOUD = 'M7.5 18.5a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17.8 11a3.75 3.75 0 0 1-.3 7.5z'

function paths(glyph: WeatherGlyph, accent: string) {
  switch (glyph) {
    case 'clear':
      return (
        <>
          <circle cx="12" cy="12" r="4.2" />
          {/* Eight rays rather than a ring, so the sun reads as a sun at 20px. */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <path
              key={deg}
              d="M12 3.2v2.1"
              transform={`rotate(${deg} 12 12)`}
            />
          ))}
        </>
      )
    case 'partly':
      return (
        <>
          <circle cx="9" cy="9" r="3.2" />
          <path d="M9 2.6v1.6M3.4 9H5M13 9h1.6M5.05 5.05l1.13 1.13M12.82 5.05l-1.13 1.13" />
          <path d={CLOUD} />
        </>
      )
    case 'cloudy':
      return (
        <>
          <path d={CLOUD} />
          {/* A second, offset cloud edge — the difference between one cloud and
              an overcast sky, in one stroke. */}
          <path d="M5.4 13.2a4.4 4.4 0 0 1 3-4.9" />
        </>
      )
    case 'fog':
      return (
        <>
          <path d="M6.6 14.6a4 4 0 0 1 .5-7.6 5.5 5.5 0 0 1 10.4.4" />
          <path d="M4 16.5h16M6.5 19.5h11" />
        </>
      )
    case 'drizzle':
      return (
        <>
          <path d={CLOUD} />
          <path d="M9 20.4v.6M12 20.4v.6M15 20.4v.6" stroke={accent} />
        </>
      )
    case 'rain':
      return (
        <>
          <path d={CLOUD} />
          <path d="M9 20v1.8M12.5 20v1.8M16 20v1.8" stroke={accent} />
        </>
      )
    case 'showers':
      return (
        <>
          <circle cx="8.5" cy="7.4" r="2.6" />
          <path d={CLOUD} />
          <path d="M10 20.2l-.8 1.6M14.2 20.2l-.8 1.6" stroke={accent} />
        </>
      )
    case 'snow':
      return (
        <>
          <path d={CLOUD} />
          {/* Six-pointed rather than dots: a snowflake is the one weather glyph
              everybody recognises from its shape alone. */}
          <path
            d="M12 19.4v3.2M10.6 20.2l2.8 1.6M13.4 20.2l-2.8 1.6"
            stroke={accent}
          />
        </>
      )
    case 'thunder':
      return (
        <>
          <path d={CLOUD} />
          <path d="M12.8 19.6l-2.4 2.6h2l-.4 1.8" stroke={accent} />
        </>
      )
  }
}

export default function WeatherIcon({
  code,
  size = 24,
  /** Overrides the accent used for precipitation — the forecast strip dims it. */
  tint = color.accent,
  muted = false,
}: {
  code: number
  size?: number
  tint?: string
  muted?: boolean
}) {
  const { glyph } = describeCode(code)

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      {...stroke}
      stroke={muted ? color.text.icon : color.text.strong}
      style={{ flex: 'none', opacity: muted ? 0.85 : 1 }}
    >
      {paths(glyph, muted ? color.text.icon : tint)}
    </svg>
  )
}
