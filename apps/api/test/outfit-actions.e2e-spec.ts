import { type INestApplication } from '@nestjs/common';
import { type Outfit, outfitPageSchema, outfitSchema } from '@vyra/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { MEN_CLOSET, withCloset } from './closet-fixtures';
import { createTestApp } from './create-test-app';
import { cleanupSuiteUsers, type TestUser } from './helpers';

const DAY_MS = 86_400_000;

describe('Outfit actions: save, wear today, feedback (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const generate = async (user: TestUser, body: Record<string, unknown> = {}) => {
    const res = await user
      .auth('post', '/api/ai/generate-outfit')
      .send({ occasion: 'WORK', style: 'SMART_CASUAL', ...body })
      .expect(200);
    return outfitSchema.parse(res.body.outfit);
  };
  const parse = (body: unknown): Outfit => outfitSchema.parse(body);
  const names = (outfit: Outfit) => outfit.items.map((item) => item.name);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupSuiteUsers(prisma);
    await app.close();
  });

  it('starts unsaved, unrated and not worn', async () => {
    const { user } = await withCloset(app, prisma, MEN_CLOSET);
    const outfit = await generate(user);
    expect(outfit).toMatchObject({
      isSaved: false,
      feedback: null,
      wornToday: false,
      lastWornAt: null,
    });
  });

  it('saves and unsaves a look, and lists only saved looks', async () => {
    const { user } = await withCloset(app, prisma, MEN_CLOSET);
    const kept = await generate(user);
    const other = await generate(user, { excludeOutfitIds: [kept.id] });

    const saved = parse(
      (await user.auth('patch', `/api/outfits/${kept.id}`).send({ isSaved: true }).expect(200))
        .body,
    );
    expect(saved.isSaved).toBe(true);

    const page = outfitPageSchema.parse(
      (await user.auth('get', '/api/outfits?saved=true').expect(200)).body,
    );
    expect(page.items.map((outfit) => outfit.id)).toEqual([kept.id]);
    expect(page.items[0]!.items[0]!.imageUrl).toContain('sig=');

    const all = outfitPageSchema.parse((await user.auth('get', '/api/outfits').expect(200)).body);
    // Newest first.
    expect(all.items.map((outfit) => outfit.id)).toEqual([other.id, kept.id]);

    await user.auth('patch', `/api/outfits/${kept.id}`).send({ isSaved: false }).expect(200);
    const after = outfitPageSchema.parse(
      (await user.auth('get', '/api/outfits?saved=true').expect(200)).body,
    );
    expect(after.items).toEqual([]);
  });

  it('paginates the outfit list with a cursor', async () => {
    const { user } = await withCloset(app, prisma, MEN_CLOSET);
    const first = await generate(user);
    const second = await generate(user, { excludeOutfitIds: [first.id] });
    const third = await generate(user, { excludeOutfitIds: [first.id, second.id] });

    const page1 = outfitPageSchema.parse(
      (await user.auth('get', '/api/outfits?limit=2').expect(200)).body,
    );
    expect(page1.items.map((outfit) => outfit.id)).toEqual([third.id, second.id]);
    expect(page1.nextCursor).toBe(second.id);
    const page2 = outfitPageSchema.parse(
      (await user.auth('get', `/api/outfits?limit=2&cursor=${page1.nextCursor}`).expect(200)).body,
    );
    expect(page2.items.map((outfit) => outfit.id)).toEqual([first.id]);
    expect(page2.nextCursor).toBeNull();
  });

  it('records one wear per day, and undo only removes today', async () => {
    const { user } = await withCloset(app, prisma, MEN_CLOSET);
    const outfit = await generate(user);
    const userId = user.session.user.id;
    // Worn three days ago already.
    const earlier = new Date(Date.now() - 3 * DAY_MS);
    await prisma.wearHistory.create({ data: { userId, outfitId: outfit.id, wornAt: earlier } });
    expect(
      parse((await user.auth('get', `/api/outfits/${outfit.id}`).expect(200)).body),
    ).toMatchObject({ wornToday: false, lastWornAt: earlier.toISOString() });

    const worn = parse(
      (await user.auth('post', `/api/outfits/${outfit.id}/wear`).expect(200)).body,
    );
    expect(worn.wornToday).toBe(true);
    // A double tap does not count twice.
    await user.auth('post', `/api/outfits/${outfit.id}/wear`).expect(200);
    expect(await prisma.wearHistory.count({ where: { outfitId: outfit.id } })).toBe(2);

    const undone = parse(
      (await user.auth('delete', `/api/outfits/${outfit.id}/wear`).expect(200)).body,
    );
    expect(undone).toMatchObject({ wornToday: false, lastWornAt: earlier.toISOString() });
    expect(await prisma.wearHistory.count({ where: { outfitId: outfit.id } })).toBe(1);
  });

  it('wearing a look makes the next suggestion rotate its pieces', async () => {
    const { user } = await withCloset(app, prisma, MEN_CLOSET);
    const first = await generate(user);
    await user.auth('post', `/api/outfits/${first.id}/wear`).expect(200);

    // No exclusion here: only the wear history pushes the next look elsewhere.
    const next = await generate(user);
    const shirt = (outfit: Outfit) => names(outfit).find((name) => name.startsWith('Chemise'));
    expect(shirt(first)).toBeDefined();
    expect(shirt(next)).toBeDefined();
    expect(shirt(next)).not.toBe(shirt(first));
  });

  it('stores one rating per look, changeable, with an optional reason', async () => {
    const { user } = await withCloset(app, prisma, MEN_CLOSET);
    const outfit = await generate(user);
    const url = `/api/outfits/${outfit.id}/feedback`;

    const loved = parse((await user.auth('put', url).send({ rating: 'LOVE' }).expect(200)).body);
    expect(loved.feedback).toEqual({ rating: 'LOVE', reason: null });

    const disliked = parse(
      (await user.auth('put', url).send({ rating: 'DISLIKE', reason: 'COLORS' }).expect(200)).body,
    );
    expect(disliked.feedback).toEqual({ rating: 'DISLIKE', reason: 'COLORS' });
    expect(await prisma.outfitFeedback.count({ where: { outfitId: outfit.id } })).toBe(1);

    // Going back to "love" drops the dislike reason.
    const again = parse((await user.auth('put', url).send({ rating: 'LOVE' }).expect(200)).body);
    expect(again.feedback).toEqual({ rating: 'LOVE', reason: null });

    const cleared = parse((await user.auth('delete', url).expect(200)).body);
    expect(cleared.feedback).toBeNull();
    expect(await prisma.outfitFeedback.count({ where: { outfitId: outfit.id } })).toBe(0);
  });

  it('"not for me" keeps the next suggestions away from its main pieces', async () => {
    const { user } = await withCloset(app, prisma, MEN_CLOSET);
    const disliked = await generate(user);
    await user
      .auth('put', `/api/outfits/${disliked.id}/feedback`)
      .send({ rating: 'DISLIKE', reason: 'NOT_MY_STYLE' })
      .expect(200);

    const main = (outfit: Outfit) =>
      outfit.items
        .filter((item) => item.category === 'TOPS' || item.category === 'BOTTOMS')
        .map((item) => item.id)
        .sort()
        .join('+');
    const next = await generate(user);
    expect(main(next)).not.toBe(main(disliked));
  });

  it('rejects invalid feedback and save payloads', async () => {
    const { user } = await withCloset(app, prisma, MEN_CLOSET);
    const outfit = await generate(user);
    await user
      .auth('put', `/api/outfits/${outfit.id}/feedback`)
      .send({ rating: 'MEH' })
      .expect(400);
    // A reason only makes sense for "not for me".
    await user
      .auth('put', `/api/outfits/${outfit.id}/feedback`)
      .send({ rating: 'LOVE', reason: 'COLORS' })
      .expect(400);
    await user.auth('patch', `/api/outfits/${outfit.id}`).send({ isSaved: 'yes' }).expect(400);
    await user.auth('get', '/api/outfits?cursor=not-a-uuid').expect(400);
  });

  it("never lets a user act on someone else's look", async () => {
    const alice = await withCloset(app, prisma, MEN_CLOSET);
    const bob = await withCloset(app, prisma, MEN_CLOSET);
    const outfit = await generate(alice.user);
    const base = `/api/outfits/${outfit.id}`;

    await bob.user.auth('patch', base).send({ isSaved: true }).expect(404);
    await bob.user.auth('post', `${base}/wear`).expect(404);
    await bob.user.auth('delete', `${base}/wear`).expect(404);
    await bob.user.auth('put', `${base}/feedback`).send({ rating: 'DISLIKE' }).expect(404);
    await bob.user.auth('delete', `${base}/feedback`).expect(404);

    const bobList = outfitPageSchema.parse(
      (await bob.user.auth('get', '/api/outfits').expect(200)).body,
    );
    expect(bobList.items).toEqual([]);
    // Nothing was written on Alice's look.
    expect(parse((await alice.user.auth('get', base).expect(200)).body)).toMatchObject({
      isSaved: false,
      feedback: null,
      wornToday: false,
    });
    expect(await prisma.wearHistory.count({ where: { outfitId: outfit.id } })).toBe(0);
  });
});
