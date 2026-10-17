import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type INestApplication } from '@nestjs/common';
import {
  closetPageSchema,
  closetSummarySchema,
  clothingItemDetailSchema,
  clothingItemSchema,
} from '@vyra/shared';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './create-test-app';
import { cleanupSuiteUsers, registerTestUser, type TestUser } from './helpers';

// Smallest valid WebP-ish payload is not needed: the file route only streams bytes.
const FAKE_WEBP = Buffer.from('RIFF0000WEBPVP8 test-image');

describe('Closet (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const keyFor = (user: TestUser, name: string) =>
    `users/${user.session.user.id}/clothing/${name}.webp`;

  function writeImage(key: string) {
    const path = join(process.env.STORAGE_LOCAL_DIR!, key);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, FAKE_WEBP);
  }

  async function addItem(
    user: TestUser,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; name: string }> {
    const name =
      (overrides.name as string | undefined) ?? `Item ${Math.random().toString(36).slice(2, 8)}`;
    const imageKey = keyFor(user, name.replace(/\W+/g, '-'));
    writeImage(imageKey);
    const res = await user
      .auth('post', '/api/closet')
      .send({ name, category: 'TOPS', color: 'white', imageKey, ...overrides })
      .expect(201);
    return clothingItemSchema.parse(res.body);
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupSuiteUsers(prisma);
    await app.close();
  });

  describe('create', () => {
    it('adds an item with signed image URLs', async () => {
      const user = await registerTestUser(app);
      const item = await addItem(user, {
        name: 'Chemise en lin',
        colorHex: '#f5f2ea',
        style: 'SMART_CASUAL',
        season: 'SUMMER',
      });
      const detail = await user.auth('get', `/api/closet/${item.id}`).expect(200);
      expect(clothingItemDetailSchema.parse(detail.body)).toMatchObject({
        name: 'Chemise en lin',
        colorHex: '#F5F2EA',
        season: 'SUMMER',
        isFavorite: false,
        stats: { outfitCount: 0, wearCount: 0, lastWornAt: null },
      });

      // The signed URL is directly usable, without any auth header.
      const url = new URL(detail.body.imageUrl);
      const image = await request(app.getHttpServer())
        .get(`${url.pathname}${url.search}`)
        .expect(200);
      expect(image.headers['content-type']).toBe('image/webp');
      expect(image.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(Buffer.from(image.body).equals(FAKE_WEBP)).toBe(true);
    });

    it('refuses image keys outside the caller’s namespace', async () => {
      const alice = await registerTestUser(app);
      const bob = await registerTestUser(app);
      const res = await alice
        .auth('post', '/api/closet')
        .send({ name: 'Stolen', category: 'TOPS', color: 'white', imageKey: keyFor(bob, 'x') })
        .expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('validates fields against the shared vocabulary', async () => {
      const user = await registerTestUser(app);
      const res = await user
        .auth('post', '/api/closet')
        .send({ name: '', category: 'HATS', color: 'midnight blue', imageKey: keyFor(user, 'x') })
        .expect(400);
      const paths = res.body.error.details.issues.map((issue: { path: string }) => issue.path);
      expect(paths).toEqual(expect.arrayContaining(['name', 'category', 'color']));
    });

    it('enforces the FREE plan closet limit with paywall details', async () => {
      const user = await registerTestUser(app);
      await prisma.clothingItem.createMany({
        data: Array.from({ length: 30 }, (_, index) => ({
          userId: user.session.user.id,
          name: `Bulk ${index}`,
          category: 'TOPS' as const,
          color: 'black',
          imageKey: keyFor(user, `bulk-${index}`),
        })),
      });
      const res = await user
        .auth('post', '/api/closet')
        .send({
          name: 'One too many',
          category: 'TOPS',
          color: 'black',
          imageKey: keyFor(user, 'extra'),
        })
        .expect(402);
      expect(res.body.error).toMatchObject({
        code: 'LIMIT_REACHED',
        details: {
          metric: 'CLOSET_ITEMS',
          limit: 30,
          used: 30,
          currentPlan: 'FREE',
          suggestedPlan: 'PRO',
        },
      });
    });
  });

  describe('list', () => {
    let user: TestUser;

    beforeAll(async () => {
      user = await registerTestUser(app);
      await addItem(user, { name: 'Chemise en lin blanche', category: 'TOPS', color: 'white' });
      await addItem(user, { name: 'Jean brut', category: 'BOTTOMS', color: 'blue' });
      await addItem(user, {
        name: 'Pantalon noir',
        category: 'BOTTOMS',
        color: 'black',
        isFavorite: true,
      });
      await addItem(user, {
        name: 'Boubou brodé',
        category: 'TRADITIONAL',
        color: 'cream',
        subcategory: 'boubou',
      });
      await addItem(user, { name: 'Baskets', category: 'SHOES', color: 'white' });
    });

    it('returns newest first and paginates without gaps or duplicates', async () => {
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const res: request.Response = await user
          .auth('get', `/api/closet?limit=2${cursor ? `&cursor=${cursor}` : ''}`)
          .expect(200);
        const page = closetPageSchema.parse(res.body);
        expect(page.items.length).toBeLessThanOrEqual(2);
        seen.push(...page.items.map((item) => item.name));
        cursor = page.nextCursor;
      } while (cursor);

      expect(seen).toEqual([
        'Baskets',
        'Boubou brodé',
        'Pantalon noir',
        'Jean brut',
        'Chemise en lin blanche',
      ]);
    });

    it('filters by category, favorites and case-insensitive search', async () => {
      const names = async (query: string) =>
        (await user.auth('get', `/api/closet?${query}`).expect(200)).body.items.map(
          (item: { name: string }) => item.name,
        );

      expect(await names('category=BOTTOMS')).toEqual(['Pantalon noir', 'Jean brut']);
      expect(await names('favorite=true')).toEqual(['Pantalon noir']);
      expect(await names('search=LIN')).toEqual(['Chemise en lin blanche']);
      expect(await names('search=boubou')).toEqual(['Boubou brodé']); // subcategory
      expect(await names('search=white&category=SHOES')).toEqual(['Baskets']); // color
    });

    it('summarizes counts per category with the plan limit', async () => {
      const res = await user.auth('get', '/api/closet/summary').expect(200);
      expect(closetSummarySchema.parse(res.body)).toMatchObject({
        total: 5,
        favorites: 1,
        limit: 30,
        byCategory: { TOPS: 1, BOTTOMS: 2, TRADITIONAL: 1, SHOES: 1, OUTERWEAR: 0 },
      });
    });

    it('rejects malformed query parameters', async () => {
      await user.auth('get', '/api/closet?limit=999').expect(400);
      await user.auth('get', '/api/closet?category=HATS').expect(400);
    });
  });

  describe('update and delete', () => {
    it('edits an item and toggles favorite', async () => {
      const user = await registerTestUser(app);
      const item = await addItem(user);
      const res = await user
        .auth('patch', `/api/closet/${item.id}`)
        .send({ name: 'Veste en jean', category: 'OUTERWEAR', color: 'blue', isFavorite: true })
        .expect(200);
      expect(res.body).toMatchObject({
        name: 'Veste en jean',
        category: 'OUTERWEAR',
        isFavorite: true,
      });

      await user.auth('patch', `/api/closet/${item.id}`).send({ color: 'plaid' }).expect(400);
      await user.auth('patch', `/api/closet/${item.id}`).send({}).expect(400);
    });

    it('archives on delete while past outfits keep the piece', async () => {
      const user = await registerTestUser(app);
      const item = await addItem(user, { name: 'Robe wax' });
      const outfit = await prisma.outfit.create({
        data: {
          userId: user.session.user.id,
          name: 'Mariage',
          occasion: 'WEDDING',
          style: 'TRADITIONAL',
          reason: 'test',
          items: { create: [{ clothingItemId: item.id }] },
        },
      });
      await prisma.wearHistory.create({
        data: {
          userId: user.session.user.id,
          outfitId: outfit.id,
          wornAt: new Date('2026-10-10T08:00:00Z'),
        },
      });

      const before = await user.auth('get', `/api/closet/${item.id}`).expect(200);
      expect(before.body.stats).toEqual({
        outfitCount: 1,
        wearCount: 1,
        lastWornAt: '2026-10-10T08:00:00.000Z',
      });

      await user.auth('delete', `/api/closet/${item.id}`).expect(204);
      await user.auth('get', `/api/closet/${item.id}`).expect(404);
      await user.auth('delete', `/api/closet/${item.id}`).expect(404);
      const list = await user.auth('get', '/api/closet').expect(200);
      expect(list.body.items).toHaveLength(0);

      const kept = await prisma.outfitItem.findMany({ where: { outfitId: outfit.id } });
      expect(kept).toHaveLength(1);
    });
  });

  describe('ownership', () => {
    it('makes another user’s items indistinguishable from missing ones', async () => {
      const alice = await registerTestUser(app);
      const bob = await registerTestUser(app);
      const item = await addItem(alice, { name: 'Private piece' });

      for (const [method, body] of [
        ['get', undefined],
        ['patch', { name: 'Hacked' }],
        ['delete', undefined],
      ] as const) {
        const req = bob.auth(method, `/api/closet/${item.id}`);
        const res = await (body ? req.send(body) : req).expect(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
      }

      const bobList = await bob.auth('get', '/api/closet').expect(200);
      expect(bobList.body.items).toHaveLength(0);
      const intact = await alice.auth('get', `/api/closet/${item.id}`).expect(200);
      expect(intact.body.name).toBe('Private piece');
    });

    it('answers 404 for malformed ids and requires authentication', async () => {
      const user = await registerTestUser(app);
      await user.auth('get', '/api/closet/not-a-uuid').expect(404);
      await request(app.getHttpServer()).get('/api/closet').expect(401);
    });

    it('serves images only with a valid signature', async () => {
      const user = await registerTestUser(app);
      const item = await addItem(user);
      const detail = await user.auth('get', `/api/closet/${item.id}`).expect(200);
      const url = new URL(detail.body.imageUrl);

      const tampered = url.search.replace(
        /sig=([0-9a-f])/,
        (_m, c: string) => `sig=${c === 'a' ? 'b' : 'a'}`,
      );
      await request(app.getHttpServer()).get(`${url.pathname}${tampered}`).expect(403);
      await request(app.getHttpServer()).get(url.pathname).expect(403);
      await request(app.getHttpServer())
        .get(url.pathname.replace(user.session.user.id, 'someone-else') + url.search)
        .expect(403);
    });
  });
});
