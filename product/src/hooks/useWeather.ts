import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Weather, WeatherPlace } from '../types/weather'

/**
 * The forecast for wherever the user said.
 *
 * Unlike every other poll in this directory, this one talks to a server, and the
 * cadence is set by that rather than by how fast the data moves. Rust holds a
 * ten-minute cache (`weather.rs`), so this asks every five and gets an answer off
 * the network roughly every other time — which means the card is instant on open
 * and Open-Meteo sees one request per install per ten minutes.
 *
 * Nothing runs at all until a place is set. There is deliberately no guess: every
 * way of working out where the user is reaches outside the machine, and this app's
 * rule for that is that the user asks first. The module says so and points at
 * Settings.
 *
 * `error` is state rather than a thrown promise because a forecast that could not
 * be fetched is a normal condition — a laptop wakes on a captive-portal Wi-Fi and
 * this fails for a minute — and the card should say "couldn't reach the forecast"
 * over the *last good reading* rather than clearing itself.
 */

/** How often to ask Rust. Rust decides how often that becomes a request. */
const POLL_MS = 5 * 60_000

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

export interface WeatherFeed {
  weather: Weather | null
  /** False until the first attempt settles, either way. */
  loaded: boolean
  /** Why the last attempt failed, or null. The previous reading is kept. */
  error: string | null
  /** In flight. Drawn only for a user-initiated refresh, never for the poll. */
  refreshing: boolean
  /** Ask now, bypassing Rust's cache. */
  refresh: () => void
}

export function useWeather(place: WeatherPlace | null | undefined, active: boolean): WeatherFeed {
  const [weather, setWeather] = useState<Weather | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Coordinates rather than the object: `useSettings` builds a fresh `settings`
  // on every broadcast, so the place is a new object identity several times a
  // session and an effect keyed on it would refetch each time.
  const key = place ? `${place.latitude.toFixed(4)},${place.longitude.toFixed(4)}` : null
  const placeRef = useRef(place)
  placeRef.current = place

  const load = useCallback(async (force: boolean) => {
    const current = placeRef.current
    if (!current || !isTauri()) return

    if (force) setRefreshing(true)
    try {
      const next = await invoke<Weather>('get_weather', { place: current, refresh: force })
      setWeather(next)
      setError(null)
    } catch (reason) {
      // The reading is left standing. An hour-old temperature over an honest
      // "couldn't reach the forecast" is worth more than an empty card.
      setError(typeof reason === 'string' && reason ? reason : "Couldn't reach the forecast.")
    } finally {
      setLoaded(true)
      if (force) setRefreshing(false)
    }
  }, [])

  const refresh = useCallback(() => void load(true), [load])

  useEffect(() => {
    if (!key) {
      // The place was cleared in Settings. Drop the reading with it, or the card
      // would show yesterday's city under a "pick a place" prompt.
      setWeather(null)
      setError(null)
      setLoaded(false)
      return
    }

    void load(false)
    const id = setInterval(() => void load(false), POLL_MS)
    return () => clearInterval(id)
  }, [key, load])

  // Opening the card asks again. Cheap — Rust answers from cache almost always —
  // and it is the moment the user is most likely to care that it is current.
  useEffect(() => {
    if (active && key) void load(false)
  }, [active, key, load])

  return { weather, loaded, error, refreshing, refresh }
}
