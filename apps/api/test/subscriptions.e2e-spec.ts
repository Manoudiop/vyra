import { type INestApplication } from '@nestjs/common';
import {
  checkoutResponseSchema,
  planOfferSchema,
  subscriptionSchema,
  usageResponseSchema,
} from '@vyra/shared';
import { z } from 'zod';
import { PrismaService } from '../src/prisma/prisma.service';
import { usageWindow } from '../src/usage/usage-period';
import { MEN_CLOSET, withCloset } from './closet-fixtures';
import { createTestApp } from './create-test-app';
import { cleanupSuiteUsers, type TestUser } from './helpers';

const DAY_MS = 86_400_000;

describe('Subscriptions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const me = async (user: TestUser) =>
    subscriptionSchema.parse((await user.auth('get', '/api/subscriptions/me').expect(200)).body);
  const checkout = async (user: TestUser, plan: string) =>
    checkoutResponseSchema.parse(
      (await user.auth('post', '/api/subscriptions/checkout').send({ plan }).expect(200)).body,
    );
  const planOfUsage = async (user: TestUser) =>
    usageResponseSchema.parse((await user.auth('get', '/api/usage').expect(200)).body).plan;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupSuiteUsers(prisma);
    await app.close();
  });

  it('lists the plans with their FCFA prices and limits', async () => {
    const { user } = await withCloset(app, prisma, []);
    const offers = z
      .array(planOfferSchema)
      .parse((await user.auth('get', '/api/subscriptions/plans').expect(200)).body);
    expect(offers.map((offer) => [offer.plan, offer.monthlyPriceXof])).toEqual([
      ['FREE', 0],
      ['PRO', 2500],
      ['PREMIUM', 5000],
    ]);
    expect(offers[0]!.metered).toContainEqual({
      metric: 'OUTFIT_GENERATION',
      limit: 3,
      period: 'WEEK',
    });
    expect(offers[2]!.features).toContain('STYLE_ANALYSIS');
  });

  it('upgrading lifts the limits at once', async () => {
    const { user } = await withCloset(app, prisma, MEN_CLOSET);
    const userId = user.session.user.id;
    expect(await me(user)).toMatchObject({ plan: 'FREE', currentPeriodEnd: null });
    await prisma.usage.create({
      data: {
        userId,
        metric: 'OUTFIT_GENERATION',
        periodStart: usageWindow('WEEK', 'UTC').start,
        count: 3,
      },
    });
    const generate = () =>
      user
        .auth('post', '/api/ai/generate-outfit')
        .send({ occasion: 'WORK', style: 'SMART_CASUAL' });
    await generate().expect(402);

    const result = await checkout(user, 'PRO');
    expect(result.status).toBe('COMPLETED');
    expect(result.subscription).toMatchObject({
      plan: 'PRO',
      status: 'ACTIVE',
      provider: 'mock',
      cancelAtPeriodEnd: false,
    });
    const start = Date.parse(result.subscription.currentPeriodStart!);
    const end = Date.parse(result.subscription.currentPeriodEnd!);
    expect((end - start) / DAY_MS).toBeGreaterThanOrEqual(28);
    expect((end - start) / DAY_MS).toBeLessThanOrEqual(31);

    // PRO counts per day: the weekly FREE usage no longer blocks.
    await generate().expect(200);
    expect(await planOfUsage(user)).toBe('PRO');
    // And the FREE calendar week limit is gone.
    const farDay = new Date(Date.now() + 20 * DAY_MS).toISOString().slice(0, 10);
    const outfit = await prisma.outfit.findFirstOrThrow({ where: { userId } });
    await user.auth('put', `/api/calendar/${farDay}`).send({ outfitId: outfit.id }).expect(200);
  });

  it('refuses a plan the user already has, and switches between paid plans', async () => {
    const { user } = await withCloset(app, prisma, []);
    await checkout(user, 'PRO');
    const again = await user
      .auth('post', '/api/subscriptions/checkout')
      .send({ plan: 'PRO' })
      .expect(409);
    expect(again.body.error.details).toEqual({ reason: 'ALREADY_SUBSCRIBED' });

    await user.auth('post', '/api/ai/analyze-style').expect(402);
    expect((await checkout(user, 'PREMIUM')).subscription.plan).toBe('PREMIUM');
    // Premium feature unlocked: now only lacking signals, not the plan.
    const analysis = await user.auth('post', '/api/ai/analyze-style').expect(422);
    expect(analysis.body.error.details.reason).toBe('NOT_ENOUGH_SIGNALS');
  });

  it('cancels at the end of the paid month, and can be undone until then', async () => {
    const { user } = await withCloset(app, prisma, []);
    await checkout(user, 'PRO');

    const canceled = subscriptionSchema.parse(
      (await user.auth('post', '/api/subscriptions/cancel').expect(200)).body,
    );
    expect(canceled).toMatchObject({ plan: 'PRO', cancelAtPeriodEnd: true });
    expect(canceled.canceledAt).not.toBeNull();
    // Still PRO for the month already paid.
    expect(await planOfUsage(user)).toBe('PRO');

    const resumed = subscriptionSchema.parse(
      (await user.auth('post', '/api/subscriptions/resume').expect(200)).body,
    );
    expect(resumed).toMatchObject({ plan: 'PRO', cancelAtPeriodEnd: false, canceledAt: null });

    // Choosing the same plan while canceling simply resumes it.
    await user.auth('post', '/api/subscriptions/cancel').expect(200);
    expect((await checkout(user, 'PRO')).subscription.cancelAtPeriodEnd).toBe(false);
  });

  it('expires a canceled plan when its month ends, and renews an active one', async () => {
    const expiring = await withCloset(app, prisma, []);
    const renewing = await withCloset(app, prisma, []);
    for (const { user } of [expiring, renewing]) await checkout(user, 'PRO');
    await expiring.user.auth('post', '/api/subscriptions/cancel').expect(200);

    // Jump past the paid month.
    const past = {
      currentPeriodStart: new Date(Date.now() - 40 * DAY_MS),
      currentPeriodEnd: new Date(Date.now() - 9 * DAY_MS),
    };
    for (const { user } of [expiring, renewing]) {
      await prisma.subscription.update({ where: { userId: user.session.user.id }, data: past });
    }

    expect(await planOfUsage(expiring.user)).toBe('FREE');
    expect(await me(expiring.user)).toMatchObject({
      plan: 'FREE',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    });

    const renewed = await me(renewing.user);
    expect(renewed.plan).toBe('PRO');
    expect(Date.parse(renewed.currentPeriodEnd!)).toBeGreaterThan(Date.now());
    expect(Date.parse(renewed.currentPeriodStart!)).toBeLessThanOrEqual(Date.now());
  });

  it('catches up on several missed months and keeps the billing day', async () => {
    const { user } = await withCloset(app, prisma, []);
    const first = await checkout(user, 'PRO');
    const end = new Date(first.subscription.currentPeriodEnd!);
    // Three months later, nobody opened the app in between.
    const shift = 3 * 31 * DAY_MS;
    await prisma.subscription.update({
      where: { userId: user.session.user.id },
      data: {
        currentPeriodStart: new Date(Date.parse(first.subscription.currentPeriodStart!) - shift),
        currentPeriodEnd: new Date(end.getTime() - shift),
      },
    });
    const renewed = await me(user);
    expect(renewed.plan).toBe('PRO');
    const newEnd = new Date(renewed.currentPeriodEnd!);
    expect(newEnd.getTime()).toBeGreaterThan(Date.now());
    expect(newEnd.getTime() - Date.now()).toBeLessThanOrEqual(31 * DAY_MS);
    expect(Date.parse(renewed.currentPeriodStart!)).toBeLessThanOrEqual(Date.now());
  });

  it('treats a second cancellation as a no-op', async () => {
    const { user } = await withCloset(app, prisma, []);
    await checkout(user, 'PRO');
    const once = (await user.auth('post', '/api/subscriptions/cancel').expect(200)).body;
    const twice = (await user.auth('post', '/api/subscriptions/cancel').expect(200)).body;
    expect(twice).toEqual(once);
  });

  it('explains what cannot be done', async () => {
    const { user } = await withCloset(app, prisma, []);
    expect(
      (await user.auth('post', '/api/subscriptions/cancel').expect(409)).body.error.details,
    ).toEqual({ reason: 'NOTHING_TO_CANCEL' });
    await checkout(user, 'PRO');
    expect(
      (await user.auth('post', '/api/subscriptions/resume').expect(409)).body.error.details,
    ).toEqual({ reason: 'NOTHING_TO_RESUME' });
    await user.auth('post', '/api/subscriptions/checkout').send({ plan: 'FREE' }).expect(400);
    await user.auth('post', '/api/subscriptions/checkout').send({ plan: 'GOLD' }).expect(400);
    await user.auth('get', '/api/subscriptions/me').set('Authorization', '').expect(401);
  });
});
