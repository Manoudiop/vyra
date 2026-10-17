import { type INestApplication } from '@nestjs/common';
import { generateOutfitResponseSchema, outfitSchema } from '@vyra/shared';
import request from 'supertest';
import { AIProvider } from '../src/ai/ai.provider';
import { type ClothingCategory, type Style } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './create-test-app';
import { cleanupSuiteUsers, registerTestUser, type TestUser } from './helpers';

interface PieceSpec {
  name: string;
  category: ClothingCategory;
  subcategory: string;
  color: string;
  style: Style;
}

const MEN_CLOSET: PieceSpec[] = [
  {
    name: 'Chemise oxford',
    category: 'TOPS',
    subcategory: 'shirt',
    color: 'blue',
    style: 'SMART_CASUAL',
  },
  {
    name: 'Chemise en lin',
    category: 'TOPS',
    subcategory: 'shirt',
    color: 'white',
    style: 'SMART_CASUAL',
  },
  {
    name: 'T-shirt noir',
    category: 'TOPS',
    subcategory: 't-shirt',
    color: 'black',
    style: 'STREETWEAR',
  },
  {
    name: 'Chino beige',
    category: 'BOTTOMS',
    subcategory: 'chinos',
    color: 'beige',
    style: 'SMART_CASUAL',
  },
  { name: 'Jean brut', category: 'BOTTOMS', subcategory: 'jeans', color: 'navy', style: 'CASUAL' },
  {
    name: 'Derbies marron',
    category: 'SHOES',
    subcategory: 'derbies',
    color: 'brown',
    style: 'FORMAL',
  },
  {
    name: 'Baskets blanches',
    category: 'SHOES',
    subcategory: 'sneakers',
    color: 'white',
    style: 'CASUAL',
  },
  {
    name: 'Blazer marine',
    category: 'OUTERWEAR',
    subcategory: 'blazer',
    color: 'navy',
    style: 'SMART_CASUAL',
  },
  {
    name: 'Agbada brodé',
    category: 'TRADITIONAL',
    subcategory: 'agbada',
    color: 'navy',
    style: 'TRADITIONAL',
  },
];

describe('AI stylist (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function withCloset(
    pieces: PieceSpec[],
  ): Promise<{ user: TestUser; ids: Map<string, string> }> {
    const user = await registerTestUser(app);
    const ids = new Map<string, string>();
    for (const piece of pieces) {
      const created = await prisma.clothingItem.create({
        data: {
          ...piece,
          userId: user.session.user.id,
          imageKey: `users/${user.session.user.id}/clothing/${piece.name.replace(/\W+/g, '-')}.webp`,
        },
      });
      ids.set(piece.name, created.id);
    }
    return { user, ids };
  }

  const generate = (user: TestUser, body: Record<string, unknown>) =>
    user.auth('post', '/api/ai/generate-outfit').send(body);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupSuiteUsers(prisma);
    await app.close();
  });

  it('generates and stores a complete, explained outfit from real closet pieces', async () => {
    const { user, ids } = await withCloset(MEN_CLOSET);
    const res = await generate(user, { occasion: 'WORK', style: 'SMART_CASUAL' }).expect(200);
    const { outfit, provider, candidateCount } = generateOutfitResponseSchema.parse(res.body);

    expect(provider).toBe('mock');
    expect(candidateCount).toBeGreaterThan(1);
    const names = outfit.items.map((item) => item.name);
    expect(names).toEqual(expect.arrayContaining(['Chino beige', 'Derbies marron']));
    expect(names.some((name) => name.startsWith('Chemise'))).toBe(true);
    expect(names).not.toContain('Baskets blanches');
    // Every piece belongs to the user and is shown with its signed photo.
    expect(outfit.items.every((item) => [...ids.values()].includes(item.id))).toBe(true);
    expect(outfit.items.every((item) => item.imageUrl.includes('sig='))).toBe(true);
    // Display order: layer, top, bottom, shoes.
    expect(outfit.items.at(-1)?.name).toBe('Derbies marron');
    expect(outfit.name.length).toBeGreaterThan(3);
    expect(outfit.reason).toContain('bureau');

    const stored = await user.auth('get', `/api/outfits/${outfit.id}`).expect(200);
    expect(outfitSchema.parse(stored.body)).toEqual(outfit);
  });

  it('dresses a wedding in the traditional piece', async () => {
    const { user } = await withCloset(MEN_CLOSET);
    const res = await generate(user, { occasion: 'WEDDING', style: 'TRADITIONAL' }).expect(200);
    const names = res.body.outfit.items.map((item: { name: string }) => item.name);
    expect(names).toContain('Agbada brodé');
    expect(names).not.toContain('Chino beige');
  });

  it('proposes a different combination on "try another"', async () => {
    const { user } = await withCloset(MEN_CLOSET);
    const first = (await generate(user, { occasion: 'CASUAL', style: 'CASUAL' }).expect(200)).body
      .outfit;
    const second = (
      await generate(user, {
        occasion: 'CASUAL',
        style: 'CASUAL',
        excludeOutfitIds: [first.id],
      }).expect(200)
    ).body.outfit;
    const key = (outfit: { items: { id: string }[] }) =>
      outfit.items
        .map((item) => item.id)
        .sort()
        .join();
    expect(key(second)).not.toBe(key(first));
  });

  it('honours constraints and "use this item"', async () => {
    const { user, ids } = await withCloset(MEN_CLOSET);
    const res = await generate(user, {
      occasion: 'CASUAL',
      style: 'CASUAL',
      constraints: { avoidKinds: ['jeans'], requiredItemId: ids.get('Blazer marine') },
    }).expect(200);
    const names = res.body.outfit.items.map((item: { name: string }) => item.name);
    expect(names).toContain('Blazer marine');
    expect(names).not.toContain('Jean brut');
    expect(res.body.outfit.constraints).toMatchObject({ avoidKinds: ['jeans'] });
  });

  it('explains what is missing when the closet cannot make an outfit', async () => {
    const { user } = await withCloset(MEN_CLOSET.filter((piece) => piece.category !== 'SHOES'));
    const res = await generate(user, { occasion: 'WORK', style: 'SMART_CASUAL' }).expect(422);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { reason: 'INCOMPLETE_CLOSET', missing: ['SHOES'] },
    });
  });

  it('never uses another user’s pieces or shows another user’s outfit', async () => {
    const alice = await withCloset(MEN_CLOSET);
    const bob = await withCloset(MEN_CLOSET);

    const res = await generate(bob.user, {
      occasion: 'WORK',
      style: 'SMART_CASUAL',
      constraints: { requiredItemId: alice.ids.get('Blazer marine') },
    }).expect(422);
    expect(res.body.error.details).toMatchObject({ reason: 'REQUIRED_ITEM_UNAVAILABLE' });

    const aliceOutfit = (
      await generate(alice.user, { occasion: 'WORK', style: 'SMART_CASUAL' }).expect(200)
    ).body.outfit;
    await bob.user.auth('get', `/api/outfits/${aliceOutfit.id}`).expect(404);
    // Another user's outfit id in "try another" is silently ignored, not leaked.
    await generate(bob.user, {
      occasion: 'WORK',
      style: 'SMART_CASUAL',
      excludeOutfitIds: [aliceOutfit.id],
    }).expect(200);
  });

  it('falls back to the engine’s best outfit when the provider fails or misbehaves', async () => {
    const { user } = await withCloset(MEN_CLOSET);
    const provider = app.get(AIProvider);
    const spy = jest
      .spyOn(provider, 'generateOutfit')
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ candidateIndex: 42, name: '', reason: '' });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await generate(user, { occasion: 'DINNER', style: 'ELEGANT' }).expect(200);
      expect(res.body.outfit.reason.length).toBeGreaterThan(20);
      expect(res.body.outfit.items.length).toBeGreaterThanOrEqual(3);
    }
    spy.mockRestore();
  });

  it('validates the request', async () => {
    const { user } = await withCloset(MEN_CLOSET);
    await generate(user, { occasion: 'BRUNCH', style: 'CASUAL' }).expect(400);
    await generate(user, {
      occasion: 'WORK',
      style: 'CASUAL',
      constraints: { avoidColors: ['plaid'] },
    }).expect(400);
    await request(app.getHttpServer())
      .post('/api/ai/generate-outfit')
      .send({ occasion: 'WORK', style: 'CASUAL' })
      .expect(401);
  });
});
