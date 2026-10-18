import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type INestApplication } from '@nestjs/common';
import { adminMetricsSchema, outfitSchema } from '@vyra/shared';
import request from 'supertest';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MEN_CLOSET, withCloset } from './closet-fixtures';
import { createTestApp } from './create-test-app';
import { cleanupSuiteUsers, registerTestUser, type TestUser } from './helpers';

// Smallest valid WebP (1×1); the closet only checks the object exists.
const FAKE_WEBP = Buffer.from(
  'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=',
  'base64',
);

describe('Analytics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let analytics: AnalyticsService;

  const eventsOf = async (user: TestUser) => {
    await analytics.flush();
    return prisma.analyticsEvent.findMany({
      where: { userId: user.session.user.id },
      orderBy: { createdAt: 'asc' },
      select: { name: true, properties: true },
    });
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    analytics = app.get(AnalyticsService);
  });

  afterAll(async () => {
    await cleanupSuiteUsers(prisma);
    await app.close();
  });

  it('records the key journey events, once each, without personal data', async () => {
    const user = await registerTestUser(app, { firstName: 'Aminata' });
    const userId = user.session.user.id;

    await user
      .auth('put', '/api/profile/onboarding')
      .send({
        firstName: 'Aminata',
        genderPreference: 'WOMEN',
        preferredStyles: ['ELEGANT', 'SMART_CASUAL'],
        preferredColors: ['beige', 'gold'],
        preferredOccasions: ['WORK'],
        city: 'Dakar',
        countryCode: 'SN',
        timezone: 'Africa/Dakar',
      })
      .expect(200);

    const imageKey = `users/${userId}/clothing/blazer.webp`;
    const path = join(process.env.STORAGE_LOCAL_DIR!, imageKey);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, FAKE_WEBP);
    await user
      .auth('post', '/api/closet')
      .send({
        name: 'Blazer de Aminata',
        category: 'OUTERWEAR',
        color: 'navy',
        imageKey,
        metadata: { analysis: { name: 'Blazer' }, corrected: ['name', 'color'] },
      })
      .expect(201);

    // Fill the closet directly and generate.
    for (const piece of MEN_CLOSET) {
      await prisma.clothingItem.create({
        data: { ...piece, userId, imageKey: `users/${userId}/clothing/${piece.name}.webp` },
      });
    }
    const outfit = outfitSchema.parse(
      (
        await user
          .auth('post', '/api/ai/generate-outfit')
          .send({ occasion: 'WORK', style: 'SMART_CASUAL' })
          .expect(200)
      ).body.outfit,
    );
    const base = `/api/outfits/${outfit.id}`;
    await user.auth('patch', base).send({ isSaved: true }).expect(200);
    await user.auth('patch', base).send({ isSaved: true }).expect(200); // already saved
    await user.auth('post', `${base}/wear`).expect(200);
    await user.auth('post', `${base}/wear`).expect(200); // same day: one wear
    await user.auth('put', `${base}/feedback`).send({ rating: 'LOVE' }).expect(200);
    await user.auth('put', `${base}/feedback`).send({ rating: 'DISLIKE' }).expect(200);
    await user
      .auth('put', `${base}/feedback`)
      .send({ rating: 'DISLIKE', reason: 'COLORS' })
      .expect(200); // a reason added, not a new opinion
    await user
      .auth('post', '/api/analytics/events')
      .send({ name: 'paywall_viewed', properties: { reason: 'generations' } })
      .expect(202);
    await user.auth('post', '/api/subscriptions/checkout').send({ plan: 'PRO' }).expect(200);
    await user.auth('post', '/api/subscriptions/cancel').expect(200);

    const events = await eventsOf(user);
    expect(events.map((event) => event.name)).toEqual([
      'signup',
      'onboarding_completed',
      'item_added',
      'outfit_generated',
      'outfit_saved',
      'outfit_worn',
      'outfit_liked',
      'outfit_disliked',
      'paywall_viewed',
      'subscription_started',
      'subscription_cancelled',
    ]);
    const byName = Object.fromEntries(events.map((event) => [event.name, event.properties]));
    expect(byName.onboarding_completed).toEqual({ styles: 2, colors: 2, occasions: 1 });
    expect(byName.item_added).toEqual({ category: 'OUTERWEAR', aiPrefilled: true, corrections: 2 });
    expect(byName.outfit_generated).toMatchObject({
      occasion: 'WORK',
      style: 'SMART_CASUAL',
      planned: false,
      provider: 'mock',
    });
    expect(byName.outfit_disliked).toEqual({ occasion: 'WORK', reason: null });
    expect(byName.paywall_viewed).toEqual({ reason: 'generations', currentPlan: 'FREE' });
    expect(byName.subscription_started).toEqual({
      plan: 'PRO',
      previousPlan: 'FREE',
      provider: 'mock',
    });

    // Nothing personal anywhere in what was recorded.
    const recorded = JSON.stringify(events);
    for (const secret of [user.email, 'Aminata', 'Dakar', 'blazer.webp', outfit.id]) {
      expect(recorded).not.toContain(secret);
    }
  });

  it('does not record anything once the user turns analytics off', async () => {
    const user = await registerTestUser(app);
    expect((await eventsOf(user)).map((event) => event.name)).toEqual(['signup']);

    const profile = await user
      .auth('patch', '/api/profile')
      .send({ analyticsEnabled: false })
      .expect(200);
    expect(profile.body.analyticsEnabled).toBe(false);
    await user
      .auth('post', '/api/analytics/events')
      .send({ name: 'paywall_viewed', properties: { reason: null } })
      .expect(202);
    await user.auth('post', '/api/subscriptions/checkout').send({ plan: 'PRO' }).expect(200);
    expect((await eventsOf(user)).map((event) => event.name)).toEqual(['signup']);
  });

  it('erases an account’s events with the account', async () => {
    const user = await registerTestUser(app);
    const userId = user.session.user.id;
    await analytics.flush();
    expect(await prisma.analyticsEvent.count({ where: { userId } })).toBe(1);
    const before = await prisma.analyticsEvent.count({ where: { userId: null } });
    await prisma.user.delete({ where: { id: userId } });
    expect(await prisma.analyticsEvent.count({ where: { userId } })).toBe(0);
    // Not kept as anonymous leftovers either.
    expect(await prisma.analyticsEvent.count({ where: { userId: null } })).toBe(before);
  });

  it('only accepts the client event, with its own properties', async () => {
    const user = await registerTestUser(app);
    const send = (body: object) => user.auth('post', '/api/analytics/events').send(body);
    await send({ name: 'subscription_started', properties: { plan: 'PRO' } }).expect(400);
    await send({ name: 'paywall_viewed', properties: { reason: 'free text' } }).expect(400);
    await send({
      name: 'paywall_viewed',
      properties: { reason: null, email: user.email },
    }).expect(400);
    await request(app.getHttpServer())
      .post('/api/analytics/events')
      .send({ name: 'paywall_viewed', properties: { reason: null } })
      .expect(401);
  });

  it('serves basic metrics to admins only', async () => {
    const { user } = await withCloset(app, prisma, []);
    await user.auth('get', '/api/admin/metrics').expect(403);

    const admin = await registerTestUser(app);
    await prisma.user.update({ where: { id: admin.session.user.id }, data: { role: 'ADMIN' } });
    // The role travels in the access token: sign in again to get an admin one.
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'letters123' })
      .expect(200);
    const metrics = adminMetricsSchema.parse(
      (
        await request(app.getHttpServer())
          .get('/api/admin/metrics')
          .set('Authorization', `Bearer ${login.body.tokens.accessToken}`)
          .expect(200)
      ).body,
    );
    expect(metrics.users.total).toBeGreaterThan(0);
    expect(metrics.users.newLast7Days).toBeGreaterThan(0);
    expect(Object.keys(metrics.plans).sort()).toEqual(['FREE', 'PREMIUM', 'PRO']);
    expect(metrics.events.signup).toBeGreaterThan(0);
    expect(metrics.events).toHaveProperty('subscription_cancelled');
  });
});
