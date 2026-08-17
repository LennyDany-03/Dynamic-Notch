import { useState } from 'react'
import RowShell from './RowShell'
import { usePlaceSearch } from '../../hooks/useSettings'
import { color, radius } from '../../tokens'
import type { Place, WeatherPlace } from '../../types/weather'

/**
 * Where the weather module looks.
 *
 * A search rather than a "use my location" button, and that is the whole design
 * decision here. Every automatic answer reaches outside the machine — an IP
 * lookup hands a third party the user's approximate address the moment Crest
 * starts, and the Windows location capability is a permission prompt for a
 * feature that has not been asked for yet. Crest's rule for anything that reaches
 * outside itself is that the user asks first (see `notifications.rs`), and a city
 * is two seconds of typing.
 *
 * The rows show region and country because that is what tells thirty Springfields
 * apart, and picking one stores the coordinates it came with — the name is never
 * re-resolved, so the choice made here is the choice that sticks.
 */
export default function WeatherLocation({
  place,
  onChange,
}: {
  place: WeatherPlace | null
  onChange: (place: WeatherPlace | null) => void
}) {
  const [query, setQuery] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)
  const { results, searching } = usePlaceSearch(query)

  const select = (found: Place) => {
    onChange({
      name: found.detail ? `${found.name}, ${found.detail}` : found.name,
      latitude: found.latitude,
      longitude: found.longitude,
      timezone: found.timezone,
    })
    // The field clears itself: the answer is now shown above it as the chosen
    // place, and leaving the query behind would make the list sit there looking
    // like it was still asking a question.
    setQuery('')
  }

  return (
    <RowShell
      title="Weather location"
      body="Crest doesn’t guess where you are — every way of doing that would send your whereabouts somewhere before you asked. Type a town or city and pick it from the list; the forecast comes from Open-Meteo, which needs no account. Once it’s set, the temperature also sits on the resting pill beside the clock."
      icon={
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.6" />
        </svg>
      }
    >
      {place && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            padding: '7px 8px 7px 11px',
            borderRadius: radius.small,
            background: color.tile,
          }}
        >
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 12,
              color: color.text.strong,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {place.name}
          </span>
          <span style={{ flex: 'none', fontSize: 10.5, color: color.text.muted, fontVariantNumeric: 'tabular-nums' }}>
            {place.latitude.toFixed(2)}, {place.longitude.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Forget this place"
            style={{
              flex: 'none',
              height: 22,
              padding: '0 8px',
              borderRadius: radius.small,
              fontSize: 11,
              color: color.text.secondary,
              background: color.hover,
            }}
          >
            Clear
          </button>
        </div>
      )}

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={place ? 'Search for somewhere else…' : 'Search for a town or city…'}
        spellCheck={false}
        aria-label="Search for a place"
        style={{
          width: '100%',
          height: 30,
          border: 'none',
          outline: 'none',
          padding: '0 10px',
          borderRadius: radius.small,
          background: color.inset,
          boxShadow: color.insetShadow,
          fontFamily: 'inherit',
          fontSize: 12,
          color: color.text.primary,
          caretColor: color.accent,
          userSelect: 'text',
          WebkitUserSelect: 'text',
        }}
      />

      {query.trim().length >= 2 && (
        <div style={{ marginTop: 6 }}>
          {results.length === 0 ? (
            <div style={{ padding: '6px 10px', fontSize: 11.5, color: color.text.muted }}>
              {/* "Searching" and "nothing found" are different answers and the
                  second one is only true once the first has finished. */}
              {searching ? 'Searching…' : 'Nothing found. Try the nearest larger town.'}
            </div>
          ) : (
            results.map((found) => {
              const id = `${found.latitude},${found.longitude}`
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => select(found)}
                  onMouseEnter={() => setHovered(id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                    padding: '7px 10px',
                    borderRadius: radius.small,
                    textAlign: 'left',
                    background: hovered === id ? color.tile : 'transparent',
                    transition: 'background 90ms linear',
                  }}
                >
                  <span style={{ fontSize: 12, color: color.text.primary, flex: 'none' }}>
                    {found.name}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 11,
                      color: color.text.muted,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {found.detail}
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </RowShell>
  )
}
