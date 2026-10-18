import { type INestApplication } from '@nestjs/common';
import { addDays, outfitSchema, weatherResponseSchema } from '@vyra/shared';
import { localDay } from '../src/common/time/local-day';
import { PrismaService } from '../src/prisma/prisma.service';
import { type DayWeather, WeatherProvider } from '../src/weather/weather.provider';
import { DINNER_CLOSET, MEN_CLOSET, withCloset } from './closet-fixtures';
import { createTestApp } from './create-test-app';
import { cleanupSuiteUsers, type TestUser } from './helpers';

const TZ = 'Africa/Dakar';

describe('Weather (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let provider: WeatherProvider;

  const today = () => localDay(new Date(), TZ);
  const day = (overrides: Partial<DayWeather>): DayWeather => ({
    temperatureC: 29,
    minC: 24,
    maxC: 30,
    feelsLikeC: null,
    condition: 'SUNNY',
    humidity: 70,
    rainProbability: 0.05,
    windKph: 10,
    ...overrides,
  });

  async function member(closet = MEN_CLOSET, city: string | null = 'Dakar') {
    const { user } = await withCloset(app, prisma, closet);
    await prisma.profile.update({
      where: { userId: user.session.user.id },
      data: { city, countryCode: city ? 'SN' : null, timezone: TZ },
    });
    return user;
  }
  const weatherOf = async (user: TestUser, query = '') =>
    weatherResponseSchema.parse((await user.auth('get', `/api/weather${query}`).expect(200)).body);
  const generate = async (user: TestUser, body: Record<string, unknown>) =>
    outfitSchema.parse(
      (await user.auth('post', '/api/ai/generate-outfit').send(body).expect(200)).body.outfit,
    );

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    provider = app.get(WeatherProvider);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await cleanupSuiteUsers(prisma);
    await app.close();
  });

  it('reports the weather in the user’s city, now and for upcoming days', async () => {
    const user = await member();
    const now = await weatherOf(user);
    expect(now.reason).toBeNull();
    expect(now.weather).toMatchObject({
      city: 'Dakar',
      kind: 'CURRENT',
      date: today(),
      provider: 'mock',
    });
    expect(now.weather!.maxC).toBeGreaterThan(20);

    const later = await weatherOf(user, `?date=${addDays(today(), 3)}`);
    expect(later.weather).toMatchObject({ kind: 'FORECAST', date: addDays(today(), 3) });

    expect(await weatherOf(user, `?date=${addDays(today(), 20)}`)).toEqual({
      weather: null,
      reason: 'OUT_OF_RANGE',
    });
    expect((await weatherOf(user, `?date=${addDays(today(), -1)}`)).reason).toBe('OUT_OF_RANGE');
    await user.auth('get', '/api/weather?date=demain').expect(400);
  });

  it('asks for a city before giving weather', async () => {
    const user = await member(MEN_CLOSET, null);
    expect(await weatherOf(user)).toEqual({ weather: null, reason: 'NO_CITY' });
  });

  it('keeps working when the provider is down', async () => {
    const user = await member(MEN_CLOSET, 'Ziguinchor');
    jest.spyOn(provider, 'getCurrentWeather').mockRejectedValue(new Error('timeout'));
    expect(await weatherOf(user)).toEqual({ weather: null, reason: 'UNAVAILABLE' });
    // The stylist composes without weather instead of failing.
    const outfit = await generate(user, { occasion: 'WORK', style: 'SMART_CASUAL' });
    expect(outfit.weather).toBeNull();
    expect(outfit.items.length).toBeGreaterThan(2);
  });

  it('keeps the sandals for a dry evening and swaps them in the rain', async () => {
    const dry = await member(DINNER_CLOSET, 'Saly');
    jest.spyOn(provider, 'getCurrentWeather').mockResolvedValue(day({ maxC: 30 }));
    const dryLook = await generate(dry, { occasion: 'DINNER', style: 'ELEGANT' });
    expect(dryLook.items.map((item) => item.name)).toContain('Sandales à talon dorées');
    expect(dryLook.weather).toEqual({
      temperatureC: 29,
      condition: 'SUNNY',
      rainProbability: 0.05,
    });

    const wet = await member(DINNER_CLOSET, 'Kaolack');
    jest
      .spyOn(provider, 'getCurrentWeather')
      .mockResolvedValue(day({ condition: 'RAIN', rainProbability: 0.85, maxC: 27 }));
    const wetLook = await generate(wet, { occasion: 'DINNER', style: 'ELEGANT' });
    const names = wetLook.items.map((item) => item.name);
    expect(names).not.toContain('Sandales à talon dorées');
    expect(names).toContain('Mocassins cognac');
    expect(wetLook.weather).toMatchObject({ condition: 'RAIN', rainProbability: 0.85 });
    expect(wetLook.reason).toMatch(/85 % de risque de pluie/);

    // Stored with the look.
    const stored = outfitSchema.parse(
      (await wet.auth('get', `/api/outfits/${wetLook.id}`).expect(200)).body,
    );
    expect(stored.weather).toEqual(wetLook.weather);
  });

  it('uses the forecast of the day a look is planned for', async () => {
    const user = await member(DINNER_CLOSET, 'Mbour');
    const target = addDays(today(), 4);
    const current = jest.spyOn(provider, 'getCurrentWeather');
    const daily = jest
      .spyOn(provider, 'getDailyForecast')
      .mockResolvedValue(day({ condition: 'STORM', rainProbability: 0.9 }));
    const look = await generate(user, { occasion: 'DINNER', style: 'ELEGANT', date: target });
    expect(daily).toHaveBeenCalledWith({ city: 'Mbour', countryCode: 'SN' }, target);
    expect(current).not.toHaveBeenCalled();
    expect(look.items.map((item) => item.name)).not.toContain('Sandales à talon dorées');
  });
});
