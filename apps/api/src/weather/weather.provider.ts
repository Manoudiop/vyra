import { type WeatherCondition } from '@vyra/shared';

/** Where to get the weather: the city from the user's profile. */
export interface Place {
  city: string;
  /** ISO 3166-1 alpha-2, helps tell Paris (FR) from Paris (US). */
  countryCode: string | null;
}

/** One day's weather as a provider reports it. */
export interface DayWeather {
  temperatureC: number;
  minC: number;
  maxC: number;
  feelsLikeC: number | null;
  condition: WeatherCondition;
  humidity: number | null;
  rainProbability: number;
  windKph: number | null;
}

/**
 * The only weather interface the app knows (spec: getCurrentWeather(city)).
 * Implementations: `MockWeatherProvider` (default, offline, deterministic)
 * and `OpenMeteoWeatherProvider` (real data, free, no API key). Selected by
 * `WEATHER_PROVIDER`.
 */
export abstract class WeatherProvider {
  abstract readonly name: string;
  /** Conditions now, with today's low/high and rain probability. */
  abstract getCurrentWeather(place: Place): Promise<DayWeather>;
  /** Daily forecast for a later day ("YYYY-MM-DD", the city's local day). */
  abstract getDailyForecast(place: Place, date: string): Promise<DayWeather>;
}
