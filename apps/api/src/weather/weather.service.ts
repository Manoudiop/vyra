import { Injectable, Logger } from '@nestjs/common';
import {
  daysBetween,
  FORECAST_DAYS,
  type WeatherResponse,
  type WeatherSnapshot,
} from '@vyra/shared';
import { localDay } from '../common/time/local-day';
import { PrismaService } from '../prisma/prisma.service';
import { type Place, WeatherProvider } from './weather.provider';

/** Weather barely changes within half an hour; providers are not hammered. */
const TTL_MS = 30 * 60_000;
/** After a failure, wait a little before asking the provider again. */
const FAILURE_TTL_MS = 2 * 60_000;

type Cached = { at: number; ttl: number; snapshot: WeatherSnapshot | null };

/**
 * Weather for the app, on top of any `WeatherProvider`. Weather is a bonus,
 * never a dependency: a provider failure returns `null` (and the stylist
 * composes without it), it never fails a request.
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly cache = new Map<string, Cached>();

  constructor(
    private readonly provider: WeatherProvider,
    private readonly prisma: PrismaService,
  ) {}

  /** Weather in the user's city for a day (today by default, their timezone). */
  async forUser(userId: string, date?: string): Promise<WeatherResponse> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { city: true, countryCode: true, timezone: true },
    });
    if (!profile?.city) return { weather: null, reason: 'NO_CITY' };
    const today = localDay(new Date(), profile.timezone);
    const ahead = daysBetween(today, date ?? today);
    if (ahead < 0 || ahead >= FORECAST_DAYS) return { weather: null, reason: 'OUT_OF_RANGE' };

    const weather = await this.forPlace(
      { city: profile.city, countryCode: profile.countryCode },
      date ?? today,
      ahead === 0,
    );
    return { weather, reason: weather ? null : 'UNAVAILABLE' };
  }

  async forPlace(place: Place, date: string, isToday: boolean): Promise<WeatherSnapshot | null> {
    const key = `${this.provider.name}|${place.city.trim().toLowerCase()}|${place.countryCode ?? ''}|${date}|${isToday}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < cached.ttl) return cached.snapshot;

    let snapshot: WeatherSnapshot | null = null;
    try {
      const day = isToday
        ? await this.provider.getCurrentWeather(place)
        : await this.provider.getDailyForecast(place, date);
      snapshot = {
        city: place.city,
        date,
        kind: isToday ? 'CURRENT' : 'FORECAST',
        temperatureC: round(day.temperatureC),
        minC: round(day.minC),
        maxC: round(day.maxC),
        feelsLikeC: day.feelsLikeC === null ? null : round(day.feelsLikeC),
        condition: day.condition,
        humidity: day.humidity === null ? null : Math.round(day.humidity),
        rainProbability: Math.min(1, Math.max(0, Math.round(day.rainProbability * 100) / 100)),
        windKph: day.windKph === null ? null : Math.round(day.windKph),
        provider: this.provider.name,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.warn(
        `Weather unavailable for ${place.city} (${this.provider.name}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    this.cache.set(key, { at: Date.now(), ttl: snapshot ? TTL_MS : FAILURE_TTL_MS, snapshot });
    if (this.cache.size > 2000) this.cache.delete(this.cache.keys().next().value!);
    return snapshot;
  }
}

const round = (value: number) => Math.round(value * 10) / 10;
