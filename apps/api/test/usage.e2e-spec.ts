import { type INestApplication } from '@nestjs/common';
import { type UsageMetric, usageLimitDetailsSchema, usageResponseSchema } from '@vyra/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { usageWindow } from '../src/usage/usage-period';
import { MEN_CLOSET, withCloset } from './closet-fixtures';
import { createTestApp } from './create-test-app';
import { cleanupSuiteUsers, type TestUser } from './helpers';

const TZ = 'Africa/Dakar';
const WORK = { occasion: 'WORK', style: 'SMART_CASUAL' };

describe('Usage limits (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function member(plan: 'FREE' | 'PRO' | 'PREMIUM' = 'FREE', closet = MEN_CLOSET) {
    const { user } = await withCloset(app, prisma, closet);
    const userId = user.session.user.id;
    await prisma.profile.update({ where: { userId }, data: { timezone: TZ } });
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, plan, status: 'ACTIVE' },
      update: { plan, status: 'ACTIVE' },
    });
    return { user, userId };
  }
  /** Pretends `count` units were already used in the current window. */
  const preset = (
    userId: string,
    metric: UsageMetric,
    period: 'DAY' | 'WEEK' | 'MONTH',
    count: number,
  ) =>
    prisma.usage.upsert({
      where: {
        userId_metric_periodStart: { userId, metric, periodStart: usageWindow(period, TZ).start },
      },
      create: { userId, metric, periodStart: usageWindow(period, TZ).start, count },
      update: { count },
    });
  const usage = async (user: TestUser) =>
    usageResponseSchema.parse((await user.auth('get', '/api/usage').expect(200)).body);
  const meter = async (user: TestUser, metric: UsageMetric) =>
    (await usage(user)).meters.find((entry) => entry.metric === metric)!;
  const generate = (user: TestUser) => user.auth('post', '/api/ai/generate-outfit').send(WORK);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupSuiteUsers(prisma);
    await app.close();
  });

  it('shows the plan’s meters for the current periods', async () => {
    const { user } = await member('FREE');
    const result = await usage(user);
    expect(result.plan).toBe('FREE');
    expect(result.meters).toEqual([
      {
        metric: 'OUTFIT_GENERATION',
        used: 0,
        limit: 3,
        remaining: 3,
        period: 'WEEK',
        resetsAt: usageWindow('WEEK', TZ).resetsAt.toISOString(),
      },
      {
        metric: 'CLOTHING_ANALYSIS',
        used: 0,
        limit: 30,
        remaining: 30,
        period: 'MONTH',
        resetsAt: usageWindow('MONTH', TZ).resetsAt.toISOString(),
      },
    ]);
  });

  it('counts FREE generations and blocks the 4th with everything needed to explain it', async () => {
    const { user } = await member('FREE');
    for (let index = 0; index < 3; index += 1) await generate(user).expect(200);
    expect(await meter(user, 'OUTFIT_GENERATION')).toMatchObject({ used: 3, remaining: 0 });

    const res = await generate(user).expect(402);
    expect(res.body.error.code).toBe('LIMIT_REACHED');
    expect(usageLimitDetailsSchema.parse(res.body.error.details)).toEqual({
      metric: 'OUTFIT_GENERATION',
      limit: 3,
      used: 3,
      period: 'WEEK',
      resetsAt: usageWindow('WEEK', TZ).resetsAt.toISOString(),
      currentPlan: 'FREE',
      suggestedPlan: 'PRO',
    });
    // The refusal itself is not counted.
    expect((await meter(user, 'OUTFIT_GENERATION')).used).toBe(3);
  });

  it('does not count a generation that could not be delivered', async () => {
    const { user } = await member(
      'FREE',
      MEN_CLOSET.filter((piece) => piece.category !== 'SHOES'),
    );
    const res = await generate(user).expect(422);
    expect(res.body.error.details.reason).toBe('INCOMPLETE_CLOSET');
    await user.auth('post', '/api/ai/generate-outfit').send({ occasion: 'BRUNCH' }).expect(400);
    expect((await meter(user, 'OUTFIT_GENERATION')).used).toBe(0);
  });

  it('never goes past the limit under parallel requests', async () => {
    const { user, userId } = await member('FREE');
    await preset(userId, 'OUTFIT_GENERATION', 'WEEK', 2);
    const statuses = (await Promise.all(Array.from({ length: 5 }, () => generate(user)))).map(
      (res) => res.status,
    );
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 402)).toHaveLength(4);
    expect((await meter(user, 'OUTFIT_GENERATION')).used).toBe(3);
  });

  it('gives PRO a daily allowance and points to PREMIUM at the limit', async () => {
    const { user, userId } = await member('PRO');
    expect(await meter(user, 'OUTFIT_GENERATION')).toMatchObject({ limit: 5, period: 'DAY' });
    await preset(userId, 'OUTFIT_GENERATION', 'DAY', 5);
    const res = await generate(user).expect(402);
    expect(res.body.error.details).toMatchObject({
      limit: 5,
      period: 'DAY',
      currentPlan: 'PRO',
      suggestedPlan: 'PREMIUM',
      resetsAt: usageWindow('DAY', TZ).resetsAt.toISOString(),
    });
  });

  it('starts every period from zero', async () => {
    const { user, userId } = await member('FREE');
    const lastWeek = new Date(usageWindow('WEEK', TZ).start.getTime() - 7 * 86_400_000);
    await prisma.usage.create({
      data: { userId, metric: 'OUTFIT_GENERATION', periodStart: lastWeek, count: 3 },
    });
    expect((await meter(user, 'OUTFIT_GENERATION')).used).toBe(0);
    await generate(user).expect(200);
    expect((await meter(user, 'OUTFIT_GENERATION')).used).toBe(1);
  });

  it('meters clothing analyses too, and only successful ones', async () => {
    const { user, userId } = await member('FREE');
    const missing = `users/${userId}/clothing/missing.webp`;
    const failed = await user
      .auth('post', '/api/ai/analyze-clothing')
      .send({ imageKey: missing })
      .expect((res) => expect(res.status).toBeGreaterThanOrEqual(400));
    expect(failed.body.error.details?.reason).toBe('IMAGE_NOT_FOUND');
    expect((await meter(user, 'CLOTHING_ANALYSIS')).used).toBe(0);

    await preset(userId, 'CLOTHING_ANALYSIS', 'MONTH', 30);
    const res = await user
      .auth('post', '/api/ai/analyze-clothing')
      .send({ imageKey: missing })
      .expect(402);
    expect(res.body.error.details).toMatchObject({
      metric: 'CLOTHING_ANALYSIS',
      limit: 30,
      period: 'MONTH',
      suggestedPlan: 'PRO',
    });
  });
});
