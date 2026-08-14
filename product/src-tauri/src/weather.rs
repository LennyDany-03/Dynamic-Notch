//! Weather and forecast, from Open-Meteo.
//!
//! **This is the only part of Crest that talks to a server the user did not point
//! it at**, the updater aside, so the choices behind it are worth stating.
//!
//! *Open-Meteo* because it needs no API key. Every alternative wants one, which
//! would mean either shipping a key in a public binary — where it is not a
//! secret, and where one user's abuse rate-limits everybody — or asking the user
//! to go and register for one before they can see whether it is going to rain.
//!
//! *No automatic location.* Every way of guessing where the user is reaches
//! outside the machine: an IP lookup hands a third party their approximate
//! address the moment the app launches, and the Windows location API asks for a
//! capability the rest of Crest does not need. So the place is a preference the
//! user sets, the same rule `notifications.rs` follows for anything that reaches
//! outside the app. Nothing here runs until they have picked somewhere.
//!
//! *Fetched in Rust rather than with `fetch` in the webview.* The webview could
//! do it — the CSP is open — but then the request would be one the app cannot
//! see, cache or bound, and it would be the one piece of external I/O not behind
//! an `invoke`. Here it has a timeout, a user agent that says what it is, and a
//! cache that keeps a poll every few minutes from becoming a request every few
//! minutes.

use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use crate::settings::WeatherPlace;

/// Open-Meteo is generous but not infinite, and every Crest install polls it. A
/// forecast does not change faster than this and the module redraws from cache in
/// between.
const CACHE_TTL: Duration = Duration::from_secs(10 * 60);

/// Long enough for a slow connection, short enough that the card says "couldn't
/// reach the forecast" rather than spinning.
const TIMEOUT: Duration = Duration::from_secs(10);

const FORECAST_URL: &str = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_URL: &str = "https://geocoding-api.open-meteo.com/v1/search";

/// Identifies the client to Open-Meteo, which is the polite half of using a free
/// service without a key.
const USER_AGENT: &str = concat!("Crest/", env!("CARGO_PKG_VERSION"), " (dynamic-notch)");

// ── What the frontend gets ───────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurrentWeather {
    pub temperature: f64,
    pub apparent_temperature: f64,
    /// WMO weather code. Turned into words and a picture on the frontend, where
    /// the copy lives — see `types/weather.ts`.
    pub code: u8,
    pub is_day: bool,
    pub humidity: u8,
    pub wind_speed: f64,
    pub precipitation: f64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ForecastDay {
    /// `YYYY-MM-DD` in the *place's* zone, not this machine's.
    pub date: String,
    pub code: u8,
    pub high: f64,
    pub low: f64,
    /// Chance of precipitation, 0–100.
    pub precipitation_chance: u8,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Weather {
    pub place: String,
    pub current: CurrentWeather,
    /// Today first, then the next six days.
    pub forecast: Vec<ForecastDay>,
    /// Unix millis this was fetched. The card can say "as of…" rather than
    /// implying a cached reading is live.
    pub fetched_at: i64,
    /// True when this came from the in-process cache rather than the network.
    pub cached: bool,
}

/// One row of the place search.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Place {
    pub name: String,
    /// "Tamil Nadu, India" — what tells thirty Springfields apart.
    pub detail: String,
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: Option<String>,
}

// ── What Open-Meteo sends ────────────────────────────────────────────────────
//
// Mirrored as its own types rather than deserialised straight into the ones
// above: the API answers in parallel arrays (`daily.time[i]` goes with
// `daily.temperature_2m_max[i]`), which is a shape worth converting at the
// boundary rather than teaching the whole frontend about.

#[derive(Deserialize)]
struct ApiResponse {
    current: ApiCurrent,
    daily: ApiDaily,
}

#[derive(Deserialize)]
struct ApiCurrent {
    temperature_2m: Option<f64>,
    apparent_temperature: Option<f64>,
    relative_humidity_2m: Option<f64>,
    precipitation: Option<f64>,
    weather_code: Option<f64>,
    wind_speed_10m: Option<f64>,
    is_day: Option<f64>,
}

#[derive(Deserialize)]
struct ApiDaily {
    time: Vec<String>,
    weather_code: Vec<Option<f64>>,
    temperature_2m_max: Vec<Option<f64>>,
    temperature_2m_min: Vec<Option<f64>>,
    precipitation_probability_max: Vec<Option<f64>>,
}

#[derive(Deserialize)]
struct GeocodeResponse {
    #[serde(default)]
    results: Vec<GeocodeResult>,
}

#[derive(Deserialize)]
struct GeocodeResult {
    name: String,
    latitude: f64,
    longitude: f64,
    timezone: Option<String>,
    admin1: Option<String>,
    country: Option<String>,
}

// ── Cache ────────────────────────────────────────────────────────────────────

struct Cached {
    /// Keyed on the coordinates, so changing the place in Settings does not serve
    /// the old city's forecast for the rest of the TTL.
    key: String,
    at: Instant,
    weather: Weather,
}

static CACHE: OnceLock<Mutex<Option<Cached>>> = OnceLock::new();

fn cache() -> &'static Mutex<Option<Cached>> {
    CACHE.get_or_init(|| Mutex::new(None))
}

/// Coordinates to four decimal places — about 11 metres, which is far finer than
/// a forecast grid and coarse enough that float noise cannot miss the cache.
fn cache_key(place: &WeatherPlace) -> String {
    format!("{:.4},{:.4}", place.latitude, place.longitude)
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(TIMEOUT)
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("couldn't start the request: {e}"))
}

/// Open-Meteo answers most numeric fields as nullable. A missing *current*
/// reading is a broken response and worth failing on; a missing day in the
/// forecast is one row that gets a sensible zero, since the other six are still
/// worth drawing.
fn required(value: Option<f64>, what: &str) -> Result<f64, String> {
    value.ok_or_else(|| format!("the forecast came back without {what}"))
}

/// Current conditions and a seven-day forecast for one place.
///
/// Served from the cache within `CACHE_TTL`, which is what makes the frontend's
/// poll cheap: the card refreshes on a timer and on every open, and neither
/// should be a network request.
#[tauri::command]
pub async fn get_weather(place: WeatherPlace, refresh: bool) -> Result<Weather, String> {
    let key = cache_key(&place);

    if !refresh {
        let guard = cache().lock().unwrap_or_else(|e| e.into_inner());
        if let Some(hit) = guard.as_ref() {
            if hit.key == key && hit.at.elapsed() < CACHE_TTL {
                let mut weather = hit.weather.clone();
                weather.cached = true;
                return Ok(weather);
            }
        }
    }

    // `timezone=auto` makes the daily buckets line up with the *place's* midnight
    // rather than UTC's, which is the difference between "today's high" meaning
    // today and meaning some slice of two local days.
    let timezone = place.timezone.clone().unwrap_or_else(|| "auto".to_string());
    let url = format!(
        "{FORECAST_URL}?latitude={lat:.4}&longitude={lon:.4}\
         &current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day\
         &daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max\
         &timezone={timezone}&forecast_days=7",
        lat = place.latitude,
        lon = place.longitude,
    );

    let response = client()?
        .get(&url)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "The forecast service didn't answer in time.".to_string()
            } else {
                "Couldn't reach the forecast service.".to_string()
            }
        })?;

    if !response.status().is_success() {
        return Err(format!(
            "The forecast service refused the request ({}).",
            response.status().as_u16()
        ));
    }

    let api: ApiResponse = response
        .json()
        .await
        .map_err(|_| "The forecast came back in a shape Crest didn't recognise.".to_string())?;

    let current = CurrentWeather {
        temperature: required(api.current.temperature_2m, "a temperature")?,
        apparent_temperature: api
            .current
            .apparent_temperature
            .unwrap_or(required(api.current.temperature_2m, "a temperature")?),
        code: api.current.weather_code.unwrap_or(0.0) as u8,
        is_day: api.current.is_day.unwrap_or(1.0) >= 0.5,
        humidity: api.current.relative_humidity_2m.unwrap_or(0.0).clamp(0.0, 100.0) as u8,
        wind_speed: api.current.wind_speed_10m.unwrap_or(0.0),
        precipitation: api.current.precipitation.unwrap_or(0.0),
    };

    // Zipped by index — the API's parallel-array shape. `get` rather than
    // indexing throughout: a short array is a malformed response, not a panic.
    let forecast = api
        .daily
        .time
        .iter()
        .enumerate()
        .map(|(i, date)| ForecastDay {
            date: date.clone(),
            code: api.daily.weather_code.get(i).copied().flatten().unwrap_or(0.0) as u8,
            high: api.daily.temperature_2m_max.get(i).copied().flatten().unwrap_or(0.0),
            low: api.daily.temperature_2m_min.get(i).copied().flatten().unwrap_or(0.0),
            precipitation_chance: api
                .daily
                .precipitation_probability_max
                .get(i)
                .copied()
                .flatten()
                .unwrap_or(0.0)
                .clamp(0.0, 100.0) as u8,
        })
        .collect();

    let weather = Weather {
        place: place.name.clone(),
        current,
        forecast,
        fetched_at: now_millis(),
        cached: false,
    };

    *cache().lock().unwrap_or_else(|e| e.into_inner()) = Some(Cached {
        key,
        at: Instant::now(),
        weather: weather.clone(),
    });

    Ok(weather)
}

/// Look a place up by name.
///
/// Open-Meteo's geocoder, so the same service answers both halves and there is
/// one host to trust rather than two. Returns several rows on purpose — picking
/// between them is the user's job, and a search that silently took the first
/// "Springfield" would be wrong roughly twenty-nine times out of thirty.
#[tauri::command]
pub async fn search_places(query: String) -> Result<Vec<Place>, String> {
    let query = query.trim();
    // Below two characters the geocoder returns essentially the whole world.
    if query.len() < 2 {
        return Ok(Vec::new());
    }

    let url = format!(
        "{GEOCODE_URL}?name={}&count=6&language=en&format=json",
        urlencoding(query)
    );

    let response = client()?
        .get(&url)
        .send()
        .await
        .map_err(|_| "Couldn't reach the place search.".to_string())?;

    if !response.status().is_success() {
        return Err("The place search refused the request.".to_string());
    }

    let body: GeocodeResponse = response
        .json()
        .await
        .map_err(|_| "The place search came back in a shape Crest didn't recognise.".to_string())?;

    Ok(body
        .results
        .into_iter()
        .map(|result| Place {
            // Region then country, skipping whichever is missing — an island
            // nation has no `admin1`, and a row reading "Malé, , Maldives" looks
            // like a bug in the app rather than a gap in the data.
            detail: [result.admin1, result.country]
                .into_iter()
                .flatten()
                .filter(|part| !part.is_empty())
                .collect::<Vec<_>>()
                .join(", "),
            name: result.name,
            latitude: result.latitude,
            longitude: result.longitude,
            timezone: result.timezone,
        })
        .collect())
}

/// Percent-encode a search term.
///
/// Hand-rolled rather than pulling a crate in for it: this escapes exactly one
/// query parameter, place names are short, and the unreserved set from RFC 3986
/// is four lines. Spaces become `%20` rather than `+` because this is a path-style
/// query value, not a form body.
fn urlencoding(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for byte in raw.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_a_query() {
        assert_eq!(urlencoding("São Paulo"), "S%C3%A3o%20Paulo");
        assert_eq!(urlencoding("Stoke-on-Trent"), "Stoke-on-Trent");
    }

    /// Talks to the real Open-Meteo, so it is `#[ignore]`d: a network test that
    /// runs by default turns somebody else's outage into a failing build. Run it
    /// by hand (`cargo test -- --ignored`) after touching the URLs or the
    /// response shapes, which are the two things here that no type checks.
    #[tokio::test]
    #[ignore = "hits the network"]
    async fn fetches_a_real_forecast() {
        let found = search_places("Chennai".into())
            .await
            .expect("the geocoder should answer");
        assert!(!found.is_empty(), "no places came back for a real city");
        println!("found: {} ({})", found[0].name, found[0].detail);

        let place = WeatherPlace {
            name: found[0].name.clone(),
            latitude: found[0].latitude,
            longitude: found[0].longitude,
            timezone: found[0].timezone.clone(),
        };

        let weather = get_weather(place.clone(), true)
            .await
            .expect("the forecast should answer");

        println!(
            "{}: {:.1}°C, code {}, {} days",
            weather.place,
            weather.current.temperature,
            weather.current.code,
            weather.forecast.len()
        );
        for day in &weather.forecast {
            println!("  {} {:.0}/{:.0} {}%", day.date, day.high, day.low, day.precipitation_chance);
        }

        assert_eq!(weather.forecast.len(), 7, "a week is seven days");
        assert!(!weather.cached, "a forced refresh must not come from cache");

        // The second call must come out of the cache — that is what keeps a
        // five-minute poll from being a five-minute request.
        let again = get_weather(place, false).await.expect("cached read");
        assert!(again.cached, "the second read should have been cached");
    }
}
