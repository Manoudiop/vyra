import { MockWeatherProvider } from './mock-weather.provider';
import { conditionFromWmo, OpenMeteoWeatherProvider } from './open-meteo.provider';
import { type DayWeather, WeatherProvider } from './weather.provider';
import { WeatherService } from './weather.service';

const DAKAR = { city: 'Dakar', countryCode: 'SN' };
const PARIS = { city: 'Paris', countryCode: 'FR' };

describe('MockWeatherProvider', () => {
  const mock = new MockWeatherProvider();

  it('is stable per city and day, and varies across days', async () => {
    const a = await mock.getDailyForecast(DAKAR, '2026-10-20');
    expect(
      await mock.getDailyForecast({ city: ' dakar ', countryCode: null }, '2026-10-20'),
    ).toEqual(a);
    const week = await Promise.all(
      ['21', '22', '23', '24', '25'].map((day) => mock.getDailyForecast(DAKAR, `2026-10-${day}`)),
    );
    expect(new Set(week.map((day) => day.maxC)).size).toBeGreaterThan(1);
  });

  it('gives plausible, city-specific weather', async () => {
    const dakar = await mock.getDailyForecast(DAKAR, '2026-10-20');
    const paris = await mock.getDailyForecast(PARIS, '2026-10-20');
    expect(dakar.maxC).toBeGreaterThan(25);
    expect(paris.maxC).toBeLessThan(19);
    for (const day of [dakar, paris]) {
      expect(day.minC).toBeLessThan(day.maxC);
      expect(day.rainProbability).toBeGreaterThanOrEqual(0);
      expect(day.rainProbability).toBeLessThanOrEqual(1);
    }
    // Accents and unknown cities are fine.
    expect(
      (await mock.getCurrentWeather({ city: 'Montréal', countryCode: 'CA' })).maxC,
    ).toBeLessThan(14);
    expect(
      (await mock.getCurrentWeather({ city: 'Ouagadougou', countryCode: 'BF' })).maxC,
    ).toBeGreaterThan(17);
  });
});

describe('OpenMeteoWeatherProvider', () => {
  const geocoding = { results: [{ latitude: 14.69, longitude: -17.44 }] };
  const forecast = {
    current: {
      temperature_2m: 29.4,
      apparent_temperature: 33.1,
      relative_humidity_2m: 74,
      weather_code: 2,
      wind_speed_10m: 14.2,
    },
    daily: {
      time: ['2026-10-18', '2026-10-19', '2026-10-20'],
      weather_code: [2, 61, 95],
      temperature_2m_max: [31, 30, 28.5],
      temperature_2m_min: [24, 25, 24.5],
      apparent_temperature_max: [35, null, 32],
      precipitation_probability_max: [10, 80, null],
    },
  };

  function fakeFetch(overrides: { geocoding?: unknown; status?: number } = {}) {
    const calls: string[] = [];
    const fetchFn = jest.fn(async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      const body = url.includes('geocoding') ? (overrides.geocoding ?? geocoding) : forecast;
      return new Response(JSON.stringify(body), { status: overrides.status ?? 200 });
    }) as unknown as typeof fetch;
    return { fetchFn, calls };
  }

  it('geocodes the city, then reads current conditions and today', async () => {
    const { fetchFn, calls } = fakeFetch();
    const provider = new OpenMeteoWeatherProvider(fetchFn);
    const now = await provider.getCurrentWeather(DAKAR);
    expect(now).toEqual<DayWeather>({
      temperatureC: 29.4,
      minC: 24,
      maxC: 31,
      feelsLikeC: 33.1,
      condition: 'PARTLY_CLOUDY',
      humidity: 74,
      rainProbability: 0.1,
      windKph: 14.2,
    });
    expect(calls[0]).toContain('name=Dakar');
    expect(calls[0]).toContain('countryCode=SN');
    expect(calls[1]).toContain('latitude=14.69');
    expect(calls[1]).toContain('timezone=auto');
  });

  it('reads the daily forecast of a later day and caches the geocoding', async () => {
    const { fetchFn, calls } = fakeFetch();
    const provider = new OpenMeteoWeatherProvider(fetchFn);
    const rainy = await provider.getDailyForecast(DAKAR, '2026-10-19');
    expect(rainy).toMatchObject({ condition: 'RAIN', rainProbability: 0.8, maxC: 30, minC: 25 });
    const stormy = await provider.getDailyForecast(DAKAR, '2026-10-20');
    expect(stormy).toMatchObject({ condition: 'STORM', rainProbability: 0 });
    expect(calls.filter((url) => url.includes('geocoding'))).toHaveLength(1);
    await expect(provider.getDailyForecast(DAKAR, '2026-11-30')).rejects.toThrow(/no forecast/);
  });

  it('fails clearly on unknown cities and HTTP errors', async () => {
    await expect(
      new OpenMeteoWeatherProvider(fakeFetch({ geocoding: {} }).fetchFn).getCurrentWeather({
        city: 'Nowhere',
        countryCode: null,
      }),
    ).rejects.toThrow(/unknown city/);
    await expect(
      new OpenMeteoWeatherProvider(fakeFetch({ status: 503 }).fetchFn).getCurrentWeather(DAKAR),
    ).rejects.toThrow(/HTTP 503/);
  });

  it('maps WMO codes', () => {
    expect([0, 1, 3, 45, 53, 66, 81, 73, 86, 96].map(conditionFromWmo)).toEqual([
      'SUNNY',
      'PARTLY_CLOUDY',
      'CLOUDY',
      'FOG',
      'RAIN',
      'RAIN',
      'RAIN',
      'SNOW',
      'SNOW',
      'STORM',
    ]);
  });
});

describe('WeatherService', () => {
  class CountingProvider extends WeatherProvider {
    readonly name = 'counting';
    calls = 0;
    fail = false;
    getCurrentWeather(): Promise<DayWeather> {
      return this.answer();
    }
    getDailyForecast(): Promise<DayWeather> {
      return this.answer();
    }
    private answer(): Promise<DayWeather> {
      this.calls += 1;
      if (this.fail) return Promise.reject(new Error('down'));
      return Promise.resolve({
        temperatureC: 27.46,
        minC: 22,
        maxC: 29,
        feelsLikeC: null,
        condition: 'RAIN',
        humidity: 80.4,
        rainProbability: 1.4,
        windKph: null,
      });
    }
  }
  const prisma = {} as never;

  it('normalizes, caches and survives provider failures', async () => {
    const provider = new CountingProvider();
    const service = new WeatherService(provider, prisma);
    const snapshot = await service.forPlace(DAKAR, '2026-10-18', true);
    expect(snapshot).toMatchObject({
      kind: 'CURRENT',
      temperatureC: 27.5,
      humidity: 80,
      rainProbability: 1,
      provider: 'counting',
      city: 'Dakar',
    });
    await service.forPlace(DAKAR, '2026-10-18', true);
    expect(provider.calls).toBe(1);

    provider.fail = true;
    expect(await service.forPlace(PARIS, '2026-10-19', false)).toBeNull();
    // The failure is remembered briefly instead of retried on every request.
    expect(await service.forPlace(PARIS, '2026-10-19', false)).toBeNull();
    expect(provider.calls).toBe(2);
  });
});
