import { z } from 'zod';
import { calendarDateSchema } from './calendar';

export const WEATHER_CONDITIONS = [
  'SUNNY',
  'PARTLY_CLOUDY',
  'CLOUDY',
  'FOG',
  'RAIN',
  'STORM',
  'SNOW',
] as const;
export const weatherConditionSchema = z.enum(WEATHER_CONDITIONS);
export type WeatherCondition = z.infer<typeof weatherConditionSchema>;

/** How far ahead a forecast is used (planning a look for a later day). */
export const FORECAST_DAYS = 14;

/**
 * Weather for one day in one city: live conditions for today, the daily
 * forecast for a later day. Temperatures in °C, rain probability in [0, 1].
 */
export const weatherSnapshotSchema = z.object({
  city: z.string(),
  date: calendarDateSchema,
  kind: z.enum(['CURRENT', 'FORECAST']),
  /** Now for CURRENT, the daytime high for FORECAST. */
  temperatureC: z.number(),
  minC: z.number(),
  maxC: z.number(),
  feelsLikeC: z.number().nullable(),
  condition: weatherConditionSchema,
  /** Relative humidity in % (0–100), when known. */
  humidity: z.number().min(0).max(100).nullable(),
  rainProbability: z.number().min(0).max(1),
  windKph: z.number().nullable(),
  provider: z.string(),
  fetchedAt: z.string(),
});
export type WeatherSnapshot = z.infer<typeof weatherSnapshotSchema>;

export const weatherQuerySchema = z.object({ date: calendarDateSchema.optional() });

export const weatherResponseSchema = z.object({
  weather: weatherSnapshotSchema.nullable(),
  /** Why there is no weather: no city in the profile, provider down, day too far. */
  reason: z.enum(['NO_CITY', 'UNAVAILABLE', 'OUT_OF_RANGE']).nullable(),
});
export type WeatherResponse = z.infer<typeof weatherResponseSchema>;

/** What a look was composed for, kept on the outfit. */
export const outfitWeatherSchema = z.object({
  temperatureC: z.number(),
  condition: weatherConditionSchema,
  rainProbability: z.number(),
});
export type OutfitWeather = z.infer<typeof outfitWeatherSchema>;

/** A rainy day as far as clothing is concerned. */
export function isRainy(weather: { condition: WeatherCondition; rainProbability: number }) {
  return (
    weather.condition === 'RAIN' || weather.condition === 'STORM' || weather.rainProbability >= 0.5
  );
}
