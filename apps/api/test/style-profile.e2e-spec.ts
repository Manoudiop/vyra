import { type INestApplication } from '@nestjs/common';
import { outfitSchema, styleAnalysisSchema, styleProfileSchema } from '@vyra/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { MEN_CLOSET, withCloset } from './closet-fixtures';
import { createTestApp } from './create-test-app';
import { cleanupSuiteUsers, type TestUser } from './helpers';

describe('Style learning (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function member(plan: 'FREE' | 'PRO' | 'PREMIUM' = 'FREE') {
    const { user, ids } = await withCloset(app, prisma, MEN_CLOSET);
    const userId = user.session.user.id;
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, plan, status: 'ACTIVE' },
      update: { plan, status: 'ACTIVE' },
    });
    /** A look made of named closet pieces (stored as an older look). */
    const look = (names: string[], occasion: 'WORK' | 'WEDDING' | 'CASUAL' = 'WORK') =>
      prisma.outfit.create({
        data: {
          userId,
          name: names.join(' + '),
          occasion,
          style: occasion === 'WEDDING' ? 'TRADITIONAL' : 'SMART_CASUAL',
          reason: 'Test',
          createdAt: new Date(Date.now() - 30 * 86_400_000),
          items: {
            create: names.map((name, position) => ({ clothingItemId: ids.get(name)!, position })),
          },
        },
      });
    return { user, ids, userId, look };
  }

  const profile = async (user: TestUser) =>
    styleProfileSchema.parse((await user.auth('get', '/api/style-profile').expect(200)).body);
  const rate = (user: TestUser, outfitId: string, body: Record<string, unknown>) =>
    user.auth('put', `/api/outfits/${outfitId}/feedback`).send(body).expect(200);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupSuiteUsers(prisma);
    await app.close();
  });

  it('starts empty and still learning', async () => {
    const { user } = await member();
    const result = await profile(user);
    expect(result.ready).toBe(false);
    expect(result.signals).toEqual({ loves: 0, dislikes: 0, wears: 0, saves: 0 });
    expect(result.learned.colors).toEqual([]);
    expect(result.analysis).toBeNull();
    expect(result.canAnalyze).toBe(false);
    expect(result.computedAt).not.toBeNull();
  });

  it('learns from ratings, wears and saves made through the app', async () => {
    const { user, look, ids } = await member();
    const office = await look(['Blazer marine', 'Chemise oxford', 'Chino beige', 'Derbies marron']);
    const wedding = await look(['Agbada brodé', 'Derbies marron'], 'WEDDING');

    await rate(user, office.id, { rating: 'LOVE' });
    await user.auth('post', `/api/outfits/${office.id}/wear`).expect(200);
    await user.auth('patch', `/api/outfits/${wedding.id}`).send({ isSaved: true }).expect(200);
    await rate(user, wedding.id, { rating: 'LOVE' });

    // Read right away: the pending recompute is applied before answering.
    const result = await profile(user);
    expect(result.signals).toEqual({ loves: 2, dislikes: 0, wears: 1, saves: 1 });
    expect(result.ready).toBe(true);
    expect(result.learned.colors.map((entry) => entry.value)).toEqual(
      expect.arrayContaining(['navy', 'brown']),
    );
    expect(result.learned.styles[0]?.value).toBe('SMART_CASUAL');
    expect(result.learned.occasionStyles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ occasion: 'WEDDING', style: 'TRADITIONAL' }),
      ]),
    );
    expect(result.learned.favoritePieces.map((piece) => piece.id)).toContain(
      ids.get('Derbies marron'),
    );
    // Declared preferences are untouched by learning.
    expect(result.declared).toEqual({ styles: [], colors: [], occasions: [] });
  });

  it('places the blame where the reason says, and recomputes from scratch', async () => {
    const { user, look } = await member();
    const black = await look(['T-shirt noir', 'Jean brut', 'Baskets blanches'], 'CASUAL');
    await rate(user, black.id, { rating: 'DISLIKE', reason: 'COLORS' });
    const disliked = await profile(user);
    expect(disliked.learned.avoidedColors.map((entry) => entry.value)).toContain('black');
    expect(disliked.learned.avoidedStyles).toEqual([]);

    // Changing one's mind removes the signal entirely.
    await user.auth('delete', `/api/outfits/${black.id}/feedback`).expect(200);
    const cleared = await profile(user);
    expect(cleared.signals.dislikes).toBe(0);
    expect(cleared.learned.avoidedColors).toEqual([]);
  });

  it('stops suggesting a piece the user keeps rejecting', async () => {
    const { user, look, ids } = await member();
    const oxford = ids.get('Chemise oxford')!;
    for (const others of [
      ['Chino beige', 'Derbies marron'],
      ['Jean brut', 'Derbies marron'],
      ['Chino beige', 'Baskets blanches'],
    ]) {
      const outfit = await look(['Chemise oxford', ...others]);
      await rate(user, outfit.id, { rating: 'DISLIKE' });
    }
    const result = await profile(user);
    expect(result.learned.avoidedPieces.map((piece) => piece.id)).toEqual([oxford]);

    const seen: string[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const res = await user
        .auth('post', '/api/ai/generate-outfit')
        .send({ occasion: 'WORK', style: 'SMART_CASUAL', excludeOutfitIds: seen })
        .expect(200);
      const outfit = outfitSchema.parse(res.body.outfit);
      expect(outfit.items.map((item) => item.id)).not.toContain(oxford);
      seen.push(outfit.id);
    }
  });

  it('keeps the style analysis for PREMIUM, with enough signals', async () => {
    const free = await member('FREE');
    const res = await free.user.auth('post', '/api/ai/analyze-style').expect(402);
    expect(res.body.error).toMatchObject({
      code: 'LIMIT_REACHED',
      details: { feature: 'STYLE_ANALYSIS', suggestedPlan: 'PREMIUM' },
    });
    const pro = await member('PRO');
    await pro.user.auth('post', '/api/ai/analyze-style').expect(402);

    const premium = await member('PREMIUM');
    const early = await premium.user.auth('post', '/api/ai/analyze-style').expect(422);
    expect(early.body.error.details).toMatchObject({ reason: 'NOT_ENOUGH_SIGNALS' });

    const office = await premium.look([
      'Blazer marine',
      'Chemise en lin',
      'Chino beige',
      'Derbies marron',
    ]);
    const wedding = await premium.look(['Agbada brodé', 'Derbies marron'], 'WEDDING');
    await rate(premium.user, office.id, { rating: 'LOVE' });
    await rate(premium.user, wedding.id, { rating: 'LOVE' });
    await premium.user.auth('post', `/api/outfits/${office.id}/wear`).expect(200);

    const analysis = styleAnalysisSchema.parse(
      (await premium.user.auth('post', '/api/ai/analyze-style').expect(200)).body,
    );
    expect(analysis.summary).toMatch(/^Ton style penche vers/);
    expect(analysis.summary).toContain('Pour la cérémonie, tu passes au traditionnel.');
    expect(analysis.dominantStyles[0]).toBe('SMART_CASUAL');
    expect(analysis.suggestions.length).toBeGreaterThan(0);

    const stored = await profile(premium.user);
    expect(stored.canAnalyze).toBe(true);
    expect(stored.analysis).toEqual(analysis);
  });

  it('requires authentication', async () => {
    const { user } = await member();
    await user.auth('get', '/api/style-profile').set('Authorization', '').expect(401);
  });
});
