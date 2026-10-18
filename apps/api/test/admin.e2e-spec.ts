import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type INestApplication } from '@nestjs/common';
import {
  adminSubscriptionsSchema,
  adminUserDetailSchema,
  adminUsersPageSchema,
} from '@vyra/shared';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { MEN_CLOSET, withCloset } from './closet-fixtures';
import { createTestApp } from './create-test-app';
import { cleanupSuiteUsers, registerTestUser, type TestUser } from './helpers';

describe('Admin and account deletion (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  const asAdmin = (path: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${adminToken}`);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const admin = await registerTestUser(app, { firstName: 'Admin' });
    await prisma.user.update({ where: { id: admin.session.user.id }, data: { role: 'ADMIN' } });
    // The role travels in the access token: sign in again to get an admin one.
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'letters123' })
      .expect(200);
    adminToken = login.body.tokens.accessToken;
  });

  afterAll(async () => {
    await cleanupSuiteUsers(prisma);
    await app.close();
  });

  describe('admin', () => {
    it('is closed to regular users and to anonymous requests', async () => {
      const user = await registerTestUser(app);
      for (const path of [
        '/api/admin/users',
        `/api/admin/users/${user.session.user.id}`,
        '/api/admin/subscriptions',
        '/api/admin/metrics',
      ]) {
        await user.auth('get', path).expect(403);
        await request(app.getHttpServer()).get(path).expect(401);
      }
    });

    it('finds users by email or first name, filters by plan and paginates', async () => {
      const marker = `zoe${Date.now()}`;
      const zoe = await registerTestUser(app, { firstName: marker });
      const pro = await registerTestUser(app);
      await pro.auth('post', '/api/subscriptions/checkout').send({ plan: 'PRO' }).expect(200);

      const byName = adminUsersPageSchema.parse(
        (await asAdmin(`/api/admin/users?search=${marker.toUpperCase()}`).expect(200)).body,
      );
      expect(byName.items.map((row) => row.id)).toEqual([zoe.session.user.id]);
      expect(byName.items[0]).toMatchObject({ plan: 'FREE', onboarded: false, items: 0 });

      const byEmail = adminUsersPageSchema.parse(
        (await asAdmin(`/api/admin/users?search=${encodeURIComponent(pro.email)}`).expect(200))
          .body,
      );
      expect(byEmail.items[0]).toMatchObject({ id: pro.session.user.id, plan: 'PRO' });

      const proOnly = adminUsersPageSchema.parse(
        (await asAdmin('/api/admin/users?plan=PRO&limit=100').expect(200)).body,
      );
      expect(proOnly.items.every((row) => row.plan === 'PRO')).toBe(true);
      expect(proOnly.items.map((row) => row.id)).toContain(pro.session.user.id);

      const first = adminUsersPageSchema.parse(
        (await asAdmin('/api/admin/users?limit=2').expect(200)).body,
      );
      expect(first.items).toHaveLength(2);
      const second = adminUsersPageSchema.parse(
        (await asAdmin(`/api/admin/users?limit=2&cursor=${first.nextCursor}`).expect(200)).body,
      );
      expect(second.items.map((row) => row.id)).not.toContain(first.items[0]!.id);
    });

    it('shows one user’s plan, AI usage, closet and outfits', async () => {
      const { user } = await withCloset(app, prisma, MEN_CLOSET);
      const userId = user.session.user.id;
      const generated = await user
        .auth('post', '/api/ai/generate-outfit')
        .send({ occasion: 'WORK', style: 'SMART_CASUAL' })
        .expect(200);
      await user
        .auth('put', `/api/outfits/${generated.body.outfit.id}/feedback`)
        .send({ rating: 'LOVE' })
        .expect(200);

      const detail = adminUserDetailSchema.parse(
        (await asAdmin(`/api/admin/users/${userId}`).expect(200)).body,
      );
      expect(detail.counts).toMatchObject({ items: MEN_CLOSET.length, outfits: 1, loves: 1 });
      expect(detail.usage.find((meter) => meter.metric === 'OUTFIT_GENERATION')?.used).toBe(1);
      expect(detail.recentItems).toHaveLength(8);
      expect(detail.recentItems[0]!.thumbnailUrl).toContain('sig=');
      expect(detail.recentOutfits[0]).toMatchObject({
        occasion: 'WORK',
        pieces: expect.any(Number),
      });
      // Nothing secret leaks to the admin.
      expect(JSON.stringify(detail)).not.toMatch(/passwordHash|tokenHash|refreshToken/);

      await asAdmin('/api/admin/users/00000000-0000-4000-8000-000000000000').expect(404);
      await asAdmin('/api/admin/users/not-an-id').expect(404);
    });

    it('lists paid subscriptions with the monthly revenue', async () => {
      const premium = await registerTestUser(app);
      await premium
        .auth('post', '/api/subscriptions/checkout')
        .send({ plan: 'PREMIUM' })
        .expect(200);
      const canceling = await registerTestUser(app);
      await canceling.auth('post', '/api/subscriptions/checkout').send({ plan: 'PRO' }).expect(200);
      await canceling.auth('post', '/api/subscriptions/cancel').expect(200);

      const all = adminSubscriptionsSchema.parse(
        (await asAdmin('/api/admin/subscriptions').expect(200)).body,
      );
      const ids = all.items.map((row) => row.userId);
      expect(ids).toEqual(
        expect.arrayContaining([premium.session.user.id, canceling.session.user.id]),
      );
      expect(all.mrrXof).toBeGreaterThanOrEqual(5000);

      const onlyCanceling = adminSubscriptionsSchema.parse(
        (await asAdmin('/api/admin/subscriptions?status=canceling').expect(200)).body,
      );
      expect(onlyCanceling.items.every((row) => row.cancelAtPeriodEnd)).toBe(true);
      expect(onlyCanceling.items.map((row) => row.userId)).toContain(canceling.session.user.id);
      expect(onlyCanceling.items.map((row) => row.userId)).not.toContain(premium.session.user.id);
    });

    it('reports content and AI usage in the metrics', async () => {
      const metrics = (await asAdmin('/api/admin/metrics').expect(200)).body;
      expect(metrics.content.clothingItems).toBeGreaterThan(0);
      expect(metrics.aiUsage.OUTFIT_GENERATION).toBeGreaterThan(0);
    });
  });

  describe('account deletion', () => {
    async function fullAccount(): Promise<{ user: TestUser; userId: string; photo: string }> {
      const { user } = await withCloset(app, prisma, MEN_CLOSET);
      const userId = user.session.user.id;
      await user
        .auth('post', '/api/ai/generate-outfit')
        .send({ occasion: 'WORK', style: 'SMART_CASUAL' })
        .expect(200);
      const photo = join(process.env.STORAGE_LOCAL_DIR!, `users/${userId}/clothing/photo.webp`);
      mkdirSync(dirname(photo), { recursive: true });
      writeFileSync(photo, 'x');
      return { user, userId, photo };
    }

    it('requires the password', async () => {
      const { user, userId } = await fullAccount();
      const res = await user
        .auth('delete', '/api/users/me')
        .send({ password: 'wrong-one1' })
        .expect(403);
      expect(res.body.error.details).toEqual({ reason: 'WRONG_PASSWORD' });
      await user.auth('delete', '/api/users/me').send({}).expect(400);
      expect(await prisma.user.count({ where: { id: userId } })).toBe(1);
    });

    it('erases the account, its data, its photos and its sessions', async () => {
      const { user, userId, photo } = await fullAccount();
      expect(existsSync(photo)).toBe(true);
      await user.auth('delete', '/api/users/me').send({ password: 'letters123' }).expect(204);

      const leftovers = await Promise.all([
        prisma.user.count({ where: { id: userId } }),
        prisma.clothingItem.count({ where: { userId } }),
        prisma.outfit.count({ where: { userId } }),
        prisma.refreshToken.count({ where: { userId } }),
        prisma.usage.count({ where: { userId } }),
        prisma.analyticsEvent.count({ where: { userId } }),
        prisma.subscription.count({ where: { userId } }),
      ]);
      expect(leftovers).toEqual([0, 0, 0, 0, 0, 0, 0]);
      expect(existsSync(dirname(dirname(photo)))).toBe(false);

      // The old session is dead and the credentials no longer work.
      await user.auth('get', '/api/users/me').expect(401);
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: user.session.tokens.refreshToken })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: user.email, password: 'letters123' })
        .expect(401);
    });
  });
});
