import { useState } from 'react'
import WeatherIcon from '../weather/WeatherGlyphs'
import type { WeatherFeed } from '../../hooks/useWeather'
import { color, radius, sectionLabel } from '../../tokens'
import { describeCode, formatTemp, weekdayOf } from '../../types/weather'

/**
 * Weather now, and the rest of the week.
 *
 * Three bands, in the order the questions are actually asked: what is it like
 * *right now* (the big number, which is most of why anyone looks), what does that
 * mean in practice (feels-like, humidity, wind, rain), and what about later (a
 * seven-column strip). The strip is columns rather than rows because a week is a
 * shape — you read the run of rain across Thursday and Friday without reading any
 * of the numbers.
 *
 * **Every box is pinned**, as in the other fixed-content modules: `size.weather`
 * is the sum of them and the state machine hit-tests that number. The arithmetic
 * is written out at the token.
 *
 * The card owns no fetching. `useWeather` polls, Rust caches, and this draws
 * whatever the last good answer was — including while an error is showing, which
 * is deliberate: an hour-old temperature under an honest "couldn't reach the
 * forecast" is worth more than a blank card.
 */

const CONDITIONS_H = 76
const DETAIL_H = 44
const FORECAST_H = 62

/** Centred one-liner for every reason there is nothing to draw. */
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        placeItems: 'center',
        padding: '0 28px',
        textAlign: 'center',
        fontSize: 11.5,
        lineHeight: 1.55,
        color: color.text.muted,
      }}
    >
      {children}
    </div>
  )
}

/** One of the four qualifiers under the headline. */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <span style={{ ...sectionLabel, fontSize: 9 }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: color.text.strong,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </span>
    </div>
  )
}

export default function WeatherModule({ feed }: { feed: WeatherFeed }) {
  const { weather, loaded, error, refreshing, refresh } = feed
  const [hovered, setHovered] = useState(false)

  const conditions = weather ? describeCode(weather.current.code) : null

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {!weather ? (
        <Empty>
          {!loaded
            ? ''
            : error
              ? error
              : // No place set. Said as the reason rather than as an error,
                // because nothing has gone wrong — Crest has deliberately not
                // guessed where the user is. See `weather.rs`.
                'Crest doesn’t know where you are yet. Pick a place in Settings → Weather and the forecast lands here.'}
        </Empty>
      ) : (
        <>
          {/* ── Now ─────────────────────────────────────────────────────────── */}
          <div
            style={{
              height: CONDITIONS_H,
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <WeatherIcon code={weather.current.code} size={44} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 34,
                    fontWeight: 300,
                    letterSpacing: '-.03em',
                    lineHeight: 1,
                    color: color.text.primary,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatTemp(weather.current.temperature)}
                </span>
                <span style={{ fontSize: 12.5, color: color.text.secondary }}>
                  {conditions?.label}
                </span>
              </div>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 11,
                  color: color.text.muted,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {weather.place}
                {error && (
                  // The reading stays; the note says how old it might be. A card
                  // that cleared itself on a dropped Wi-Fi would be less useful
                  // than one that admits to being stale.
                  <span style={{ color: color.fileRed }}> · offline</span>
                )}
              </div>
            </div>

            <button
              type="button"
              title="Refresh now"
              aria-label="Refresh the forecast"
              onClick={refresh}
              onPointerEnter={() => setHovered(true)}
              onPointerLeave={() => setHovered(false)}
              style={{
                width: 24,
                height: 24,
                flex: 'none',
                display: 'grid',
                placeItems: 'center',
                borderRadius: radius.small,
                padding: 0,
                background: hovered ? color.tile : 'transparent',
                transition: 'background 90ms linear',
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width={14}
                height={14}
                fill="none"
                stroke={hovered ? color.accent : color.text.icon}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transition: 'stroke 140ms ease',
                  // A spinner only while a *user-initiated* refresh is running.
                  // Spinning for the five-minute poll would make a card nobody
                  // touched look busy.
                  animation: refreshing ? 'spin 900ms linear infinite' : undefined,
                }}
              >
                <path d="M20 12a8 8 0 1 1-2.5-5.8" />
                <path d="M20 4v4h-4" />
              </svg>
            </button>
          </div>

          {/* ── What that means ─────────────────────────────────────────────── */}
          <div
            style={{
              height: DETAIL_H,
              flex: 'none',
              display: 'flex',
              gap: 10,
              padding: '0 12px',
              borderRadius: radius.tile,
              background: color.tile,
            }}
          >
            <Detail label="Feels like" value={formatTemp(weather.current.apparentTemperature)} />
            <Detail label="Humidity" value={`${weather.current.humidity}%`} />
            <Detail label="Wind" value={`${Math.round(weather.current.windSpeed)} km/h`} />
            <Detail
              label="Rain today"
              value={`${weather.forecast[0]?.precipitationChance ?? 0}%`}
            />
          </div>

          <div style={{ height: 14, flex: 'none' }} />

          {/* ── The week ────────────────────────────────────────────────────── */}
          <div style={{ height: FORECAST_H, flex: 'none', display: 'flex', gap: 4 }}>
            {weather.forecast.map((day, index) => (
              <div
                key={day.date}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBlock: 2,
                  borderRadius: radius.small,
                  // Today is the only column that gets a surface, so the eye has
                  // a starting point for the run left to right.
                  background: index === 0 ? color.tile : 'transparent',
                }}
              >
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 600,
                    letterSpacing: '.04em',
                    textTransform: 'uppercase',
                    color: index === 0 ? color.text.secondary : color.text.muted,
                  }}
                >
                  {weekdayOf(day.date, index)}
                </span>

                <WeatherIcon code={day.code} size={20} muted={index !== 0} />

                <span
                  style={{
                    fontSize: 10.5,
                    fontVariantNumeric: 'tabular-nums',
                    color: color.text.strong,
                  }}
                >
                  {Math.round(day.high)}°
                  <span style={{ color: color.text.muted }}> {Math.round(day.low)}°</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
