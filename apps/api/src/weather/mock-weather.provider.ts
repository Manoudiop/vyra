import { type WeatherCondition } from '@vyra/shared';
import { type DayWeather, type Place, WeatherProvider } from './weather.provider';

interface Climate {
  /** Typical daytime temperature (°C). */
  temperature: number;
  /** Typical chance of rain on a given day. */
  rain: number;
  humidity: number;
}

/**
 * Rough autumn climates for the cities VYRA users are most likely in. The
 * mock is for development and demos: plausible, stable per city and day, and
 * never calling the network. Unknown cities get a mild default.
 */
const CLIMATES: Record<string, Climate> = {
  dakar: { temperature: 30, rain: 0.15, humidity: 72 },
  abidjan: { temperature: 29, rain: 0.45, humidity: 82 },
  lagos: { temperature: 29, rain: 0.5, humidity: 80 },
  accra: { temperature: 29, rain: 0.35, humidity: 78 },
  douala: { temperature: 28, rain: 0.6, humidity: 85 },
  kinshasa: { temperature: 29, rain: 0.5, humidity: 78 },
  bamako: { temperature: 33, rain: 0.15, humidity: 50 },
  lome: { temperature: 29, rain: 0.35, humidity: 78 },
  cotonou: { temperature: 29, rain: 0.4, humidity: 80 },
  casablanca: { temperature: 22, rain: 0.15, humidity: 70 },
  tunis: { temperature: 23, rain: 0.15, humidity: 65 },
  nairobi: { temperature: 23, rain: 0.3, humidity: 65 },
  johannesburg: { temperature: 22, rain: 0.25, humidity: 50 },
  paris: { temperature: 14, rain: 0.45, humidity: 80 },
  lyon: { temperature: 15, rain: 0.4, humidity: 75 },
  marseille: { temperature: 19, rain: 0.25, humidity: 65 },
  bruxelles: { temperature: 13, rain: 0.5, humidity: 82 },
  london: { temperature: 13, rain: 0.5, humidity: 80 },
  montreal: { temperature: 9, rain: 0.4, humidity: 70 },
  'new york': { temperature: 15, rain: 0.35, humidity: 65 },
};
const DEFAULT_CLIMATE: Climate = { temperature: 22, rain: 0.3, humidity: 65 };

const normalize = (city: string) =>
  city
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

/** Deterministic number in [0, 1) for a key. */
function unit(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

function conditionFor(rain: number, roll: number): WeatherCondition {
  if (rain >= 0.75) return roll > 0.6 ? 'STORM' : 'RAIN';
  if (rain >= 0.5) return 'RAIN';
  if (rain >= 0.3) return 'CLOUDY';
  if (rain >= 0.15) return 'PARTLY_CLOUDY';
  return 'SUNNY';
}

export class MockWeatherProvider extends WeatherProvider {
  readonly name = 'mock';

  getCurrentWeather(place: Place): Promise<DayWeather> {
    const today = new Date().toISOString().slice(0, 10);
    const day = this.day(place, today);
    // "Now" sits a little below the daytime high.
    return Promise.resolve({ ...day, temperatureC: Math.round((day.maxC - 1) * 10) / 10 });
  }

  getDailyForecast(place: Place, date: string): Promise<DayWeather> {
    return Promise.resolve(this.day(place, date));
  }

  private day(place: Place, date: string): DayWeather {
    const city = normalize(place.city);
    const climate = CLIMATES[city] ?? DEFAULT_CLIMATE;
    const key = `${city}:${date}`;
    const maxC = Math.round((climate.temperature + (unit(`${key}:t`) - 0.5) * 6) * 10) / 10;
    const rainProbability =
      Math.round(Math.min(0.95, Math.max(0, climate.rain + (unit(`${key}:r`) - 0.5) * 0.5)) * 100) /
      100;
    return {
      temperatureC: maxC,
      minC: Math.round((maxC - 6) * 10) / 10,
      maxC,
      feelsLikeC: Math.round((maxC + (climate.humidity > 75 ? 2 : 0)) * 10) / 10,
      condition: conditionFor(rainProbability, unit(`${key}:c`)),
      humidity: climate.humidity,
      rainProbability,
      windKph: Math.round(8 + unit(`${key}:w`) * 17),
    };
  }
}
