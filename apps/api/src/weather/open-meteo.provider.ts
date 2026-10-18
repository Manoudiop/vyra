import { type WeatherCondition } from '@vyra/shared';
import { type DayWeather, type Place, WeatherProvider } from './weather.provider';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 5000;
const GEOCODE_TTL_MS = 24 * 3_600_000;

type Fetch = typeof fetch;

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface ForecastPayload {
  current?: {
    temperature_2m: number;
    apparent_temperature: number | null;
    relative_humidity_2m: number | null;
    weather_code: number;
    wind_speed_10m: number | null;
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    apparent_temperature_max: (number | null)[];
    precipitation_probability_max: (number | null)[];
  };
}

/** WMO weather interpretation codes → VYRA conditions. */
export function conditionFromWmo(code: number): WeatherCondition {
  if (code === 0) return 'SUNNY';
  if (code <= 2) return 'PARTLY_CLOUDY';
  if (code === 3) return 'CLOUDY';
  if (code === 45 || code === 48) return 'FOG';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'SNOW';
  if (code >= 95) return 'STORM';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'RAIN';
  return 'CLOUDY';
}

/**
 * Real weather from Open-Meteo (open data, free, no API key — so no secret to
 * manage). City names are geocoded once and cached; the API's daily
 * forecast covers the next 16 days in the city's local time.
 */
export class OpenMeteoWeatherProvider extends WeatherProvider {
  readonly name = 'open-meteo';
  private readonly places = new Map<string, { at: number; coordinates: Coordinates }>();

  constructor(private readonly fetchFn: Fetch = (input, init) => fetch(input, init)) {
    super();
  }

  async getCurrentWeather(place: Place): Promise<DayWeather> {
    const payload = await this.forecast(place);
    const current = payload.current;
    const today = this.dailyAt(payload, 0);
    if (!current || !today) throw new Error('Open-Meteo: incomplete current weather');
    return {
      ...today,
      temperatureC: current.temperature_2m,
      feelsLikeC: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      windKph: current.wind_speed_10m,
      condition: conditionFromWmo(current.weather_code),
    };
  }

  async getDailyForecast(place: Place, date: string): Promise<DayWeather> {
    const payload = await this.forecast(place);
    const index = payload.daily?.time.indexOf(date) ?? -1;
    const day = index >= 0 ? this.dailyAt(payload, index) : null;
    if (!day) throw new Error(`Open-Meteo: no forecast for ${date}`);
    return day;
  }

  private dailyAt(payload: ForecastPayload, index: number): DayWeather | null {
    const daily = payload.daily;
    if (!daily || daily.time[index] === undefined) return null;
    const maxC = daily.temperature_2m_max[index]!;
    return {
      temperatureC: maxC,
      minC: daily.temperature_2m_min[index]!,
      maxC,
      feelsLikeC: daily.apparent_temperature_max[index] ?? null,
      condition: conditionFromWmo(daily.weather_code[index]!),
      humidity: null,
      rainProbability: (daily.precipitation_probability_max[index] ?? 0) / 100,
      windKph: null,
    };
  }

  private async forecast(place: Place): Promise<ForecastPayload> {
    const { latitude, longitude } = await this.locate(place);
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current:
        'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
      daily:
        'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: '16',
    });
    return this.getJson<ForecastPayload>(`${FORECAST_URL}?${params.toString()}`);
  }

  private async locate(place: Place): Promise<Coordinates> {
    const key = `${place.city.trim().toLowerCase()}|${place.countryCode ?? ''}`;
    const cached = this.places.get(key);
    if (cached && Date.now() - cached.at < GEOCODE_TTL_MS) return cached.coordinates;

    const params = new URLSearchParams({ name: place.city.trim(), count: '1', format: 'json' });
    if (place.countryCode) params.set('countryCode', place.countryCode);
    const payload = await this.getJson<{ results?: Coordinates[] }>(
      `${GEOCODING_URL}?${params.toString()}`,
    );
    const first = payload.results?.[0];
    if (!first) throw new Error(`Open-Meteo: unknown city "${place.city}"`);
    const coordinates = { latitude: first.latitude, longitude: first.longitude };
    this.places.set(key, { at: Date.now(), coordinates });
    return coordinates;
  }

  private async getJson<T>(url: string): Promise<T> {
    const response = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Open-Meteo: HTTP ${response.status}`);
    return (await response.json()) as T;
  }
}
