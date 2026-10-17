import { type Occasion, type OutfitConstraints, type Style } from '@vyra/shared';
import {
  baseKeyOf,
  colorHarmony,
  comboKey,
  type EngineContext,
  type EngineItem,
  generateCandidates,
  recencyPenalty,
  slotOf,
} from './candidate-engine';

let counter = 0;
const item = (overrides: Partial<EngineItem> & Pick<EngineItem, 'category'>): EngineItem => ({
  id: `item-${(counter += 1).toString().padStart(3, '0')}`,
  name: 'Piece',
  subcategory: null,
  color: 'black',
  style: 'CASUAL',
  season: 'ALL_SEASON',
  isFavorite: false,
  ...overrides,
});

const oxford = item({
  category: 'TOPS',
  name: 'Chemise oxford',
  subcategory: 'shirt',
  color: 'blue',
  style: 'SMART_CASUAL',
});
const tee = item({
  category: 'TOPS',
  name: 'T-shirt blanc',
  subcategory: 't-shirt',
  color: 'white',
  style: 'CASUAL',
});
const chinos = item({
  category: 'BOTTOMS',
  name: 'Chino beige',
  subcategory: 'chinos',
  color: 'beige',
  style: 'SMART_CASUAL',
});
const jeans = item({
  category: 'BOTTOMS',
  name: 'Jean brut',
  subcategory: 'jeans',
  color: 'navy',
  style: 'CASUAL',
});
const derbies = item({
  category: 'SHOES',
  name: 'Derbies',
  subcategory: 'derbies',
  color: 'brown',
  style: 'FORMAL',
});
const sneakers = item({
  category: 'SHOES',
  name: 'Baskets blanches',
  subcategory: 'sneakers',
  color: 'white',
  style: 'CASUAL',
});
const heels = item({
  category: 'SHOES',
  name: 'Sandales à talon',
  subcategory: 'heels',
  color: 'gold',
  style: 'ELEGANT',
});
const blazer = item({
  category: 'OUTERWEAR',
  name: 'Blazer marine',
  subcategory: 'blazer',
  color: 'navy',
  style: 'SMART_CASUAL',
});
const watch = item({
  category: 'ACCESSORIES',
  name: 'Montre',
  subcategory: 'watch',
  color: 'silver',
  style: 'SMART_CASUAL',
});
const boubou = item({
  category: 'TRADITIONAL',
  name: 'Grand boubou brodé',
  subcategory: 'boubou',
  color: 'cream',
  style: 'TRADITIONAL',
});
const dashiki = item({
  category: 'TRADITIONAL',
  name: 'Chemise dashiki',
  subcategory: 'dashiki',
  color: 'orange',
  style: 'TRADITIONAL',
});

const CLOSET = [
  oxford,
  tee,
  chinos,
  jeans,
  derbies,
  sneakers,
  heels,
  blazer,
  watch,
  boubou,
  dashiki,
];

function context(
  occasion: Occasion,
  style: Style,
  overrides: Omit<Partial<EngineContext>, 'constraints'> & {
    constraints?: Partial<OutfitConstraints>;
  } = {},
): EngineContext {
  const { constraints, ...rest } = overrides;
  return {
    occasion,
    style,
    constraints: { avoidColors: [], avoidKinds: [], ...constraints },
    preferences: { colors: [], styles: [], dislikedItemIds: [] },
    lastWornDaysAgo: new Map(),
    lovedItemIds: new Set(),
    recentCombos: new Set(),
    dislikedCombos: new Set(),
    excludedCombos: new Set(),
    dislikedBases: new Set(),
    excludedBases: new Set(),
    seed: 1,
    ...rest,
  };
}

const best = (result: ReturnType<typeof generateCandidates>) => {
  if (!result.ok) throw new Error(`expected candidates, got ${result.reason}`);
  return result.candidates[0]!;
};
const names = (candidate: { items: EngineItem[] }) => candidate.items.map((piece) => piece.name);

describe('slots', () => {
  it('treats boubous and dresses as one-piece outfits and dashikis as tops', () => {
    expect(slotOf(boubou)).toBe('onePiece');
    expect(slotOf(dashiki)).toBe('top');
    expect(slotOf(item({ category: 'OTHER', name: 'Robe nuisette', subcategory: 'dress' }))).toBe(
      'onePiece',
    );
    expect(slotOf(item({ category: 'OTHER', name: 'Ceinture', subcategory: 'belt' }))).toBeNull();
  });
});

describe('generateCandidates', () => {
  it('builds a complete, office-appropriate outfit for work', () => {
    const outfit = best(generateCandidates(CLOSET, context('WORK', 'SMART_CASUAL')));
    expect(names(outfit)).toEqual(
      expect.arrayContaining(['Chemise oxford', 'Chino beige', 'Derbies']),
    );
    expect(outfit.slots).toContain('shoes');
    expect(names(outfit)).not.toContain('Baskets blanches');
  });

  it('dresses a wedding in the traditional piece', () => {
    const outfit = best(generateCandidates(CLOSET, context('WEDDING', 'TRADITIONAL')));
    expect(names(outfit)).toContain('Grand boubou brodé');
    expect(outfit.slots).not.toContain('top');
  });

  it('keeps a casual day casual', () => {
    const outfit = best(generateCandidates(CLOSET, context('CASUAL', 'CASUAL')));
    expect(names(outfit)).toEqual(
      expect.arrayContaining(['T-shirt blanc', 'Jean brut', 'Baskets blanches']),
    );
  });

  it('honours "avoid jeans", "avoid black" and "no heels"', () => {
    const result = generateCandidates(
      CLOSET,
      context('CASUAL', 'CASUAL', {
        constraints: { avoidKinds: ['jeans', 'heels'], avoidColors: ['black'] },
      }),
    );
    if (!result.ok) throw new Error(result.reason);
    for (const candidate of result.candidates) {
      expect(names(candidate)).not.toContain('Jean brut');
      expect(names(candidate)).not.toContain('Sandales à talon');
      expect(candidate.items.every((piece) => piece.color !== 'black')).toBe(true);
    }
  });

  it('builds every candidate around "use this item"', () => {
    const result = generateCandidates(
      CLOSET,
      context('DINNER', 'ELEGANT', { constraints: { requiredItemId: blazer.id } }),
    );
    if (!result.ok) throw new Error(result.reason);
    expect(result.candidates.every((candidate) => candidate.items.includes(blazer))).toBe(true);
  });

  it('refuses a required item that the constraints exclude', () => {
    const result = generateCandidates(
      CLOSET,
      context('CASUAL', 'CASUAL', {
        constraints: { requiredItemId: jeans.id, avoidKinds: ['jeans'] },
      }),
    );
    expect(result).toEqual({ ok: false, reason: 'REQUIRED_ITEM_UNAVAILABLE' });
  });

  it('rotates to an equally suitable piece when one was worn yesterday', () => {
    const linen = item({
      category: 'TOPS',
      name: 'Chemise en lin',
      subcategory: 'shirt',
      color: 'white',
      style: 'SMART_CASUAL',
    });
    const closet = [...CLOSET, linen];
    const fresh = best(generateCandidates(closet, context('WORK', 'SMART_CASUAL')));
    const wornTop = names(fresh).find((name) => name.startsWith('Chemise'))!;
    const worn = closet.find((piece) => piece.name === wornTop)!;
    const next = best(
      generateCandidates(
        closet,
        context('WORK', 'SMART_CASUAL', { lastWornDaysAgo: new Map([[worn.id, 1]]) }),
      ),
    );
    expect(names(next)).not.toContain(wornTop);
    expect(names(next).some((name) => name.startsWith('Chemise'))).toBe(true);
  });

  it('still prefers a fitting piece worn yesterday over an unsuitable one', () => {
    const outfit = best(
      generateCandidates(
        CLOSET,
        context('WORK', 'SMART_CASUAL', { lastWornDaysAgo: new Map([[oxford.id, 1]]) }),
      ),
    );
    expect(names(outfit)).toContain('Chemise oxford');
  });

  it('never proposes an excluded combination again ("try another")', () => {
    const first = best(generateCandidates(CLOSET, context('WORK', 'SMART_CASUAL')));
    const second = best(
      generateCandidates(
        CLOSET,
        context('WORK', 'SMART_CASUAL', { excludedCombos: new Set([first.key]) }),
      ),
    );
    expect(second.key).not.toBe(first.key);
  });

  it('pushes disliked combinations down and skips disliked items entirely', () => {
    const first = best(generateCandidates(CLOSET, context('WORK', 'SMART_CASUAL')));
    const afterDislike = best(
      generateCandidates(
        CLOSET,
        context('WORK', 'SMART_CASUAL', { dislikedCombos: new Set([first.key]) }),
      ),
    );
    expect(afterDislike.key).not.toBe(first.key);

    const result = generateCandidates(
      CLOSET,
      context('WORK', 'SMART_CASUAL', {
        preferences: { colors: [], styles: [], dislikedItemIds: [chinos.id] },
      }),
    );
    if (!result.ok) throw new Error(result.reason);
    expect(result.candidates.every((candidate) => !candidate.items.includes(chinos))).toBe(true);
  });

  it('does not re-propose disliked main pieces dressed up with another layer', () => {
    const first = best(generateCandidates(CLOSET, context('WORK', 'SMART_CASUAL')));
    const base = baseKeyOf(first.items);
    const next = best(
      generateCandidates(
        CLOSET,
        context('WORK', 'SMART_CASUAL', { dislikedBases: new Set([base]) }),
      ),
    );
    expect(baseKeyOf(next.items)).not.toBe(base);
  });

  it('makes "another look" change the main pieces, not just the accessories', () => {
    const linen = item({
      category: 'TOPS',
      name: 'Chemise en lin',
      subcategory: 'shirt',
      color: 'white',
      style: 'SMART_CASUAL',
    });
    const closet = [...CLOSET, linen];
    const first = best(generateCandidates(closet, context('WORK', 'SMART_CASUAL')));
    const next = best(
      generateCandidates(
        closet,
        context('WORK', 'SMART_CASUAL', {
          excludedCombos: new Set([first.key]),
          excludedBases: new Set([baseKeyOf(first.items)]),
        }),
      ),
    );
    expect(baseKeyOf(next.items)).not.toBe(baseKeyOf(first.items));
  });

  it('returns varied candidates with distinct main pieces', () => {
    const result = generateCandidates(CLOSET, context('CASUAL', 'CASUAL'));
    if (!result.ok) throw new Error(result.reason);
    expect(result.candidates.length).toBeGreaterThan(1);
    const bases = result.candidates.map((candidate) =>
      comboKey(
        candidate.items
          .filter((_, index) => ['top', 'bottom', 'onePiece'].includes(candidate.slots[index]!))
          .map((piece) => piece.id),
      ),
    );
    expect(new Set(bases).size).toBe(bases.length);
    const scores = result.candidates.map((candidate) => candidate.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('is deterministic for a given seed', () => {
    const a = generateCandidates(CLOSET, context('PARTY', 'ELEGANT', { seed: 42 }));
    const b = generateCandidates(CLOSET, context('PARTY', 'ELEGANT', { seed: 42 }));
    expect(a).toEqual(b);
  });

  it('explains what is missing when the closet cannot make an outfit', () => {
    expect(generateCandidates([oxford, chinos], context('WORK', 'SMART_CASUAL'))).toEqual({
      ok: false,
      reason: 'INCOMPLETE_CLOSET',
      missing: ['SHOES'],
    });
    expect(generateCandidates([derbies], context('WORK', 'SMART_CASUAL'))).toMatchObject({
      reason: 'INCOMPLETE_CLOSET',
      missing: ['TOP', 'BOTTOM'],
    });
    // Shoes exist, but the constraints rule them all out.
    expect(
      generateCandidates(
        [oxford, chinos, sneakers],
        context('CASUAL', 'CASUAL', { constraints: { avoidKinds: ['sneakers'] } }),
      ),
    ).toEqual({ ok: false, reason: 'NO_MATCH' });
  });
});

describe('scoring helpers', () => {
  it('fades the recency penalty over about a week', () => {
    expect(recencyPenalty(undefined)).toBe(0);
    expect(recencyPenalty(0)).toBeCloseTo(0.35);
    expect(recencyPenalty(7)).toBeLessThan(0.07);
    expect(recencyPenalty(1)).toBeGreaterThan(recencyPenalty(3));
  });

  it('rewards one accent on neutrals and penalizes clashes', () => {
    const slots = ['top', 'bottom', 'shoes'] as const;
    const one = colorHarmony([dashiki, chinos, derbies], [...slots]);
    const clash = colorHarmony(
      [
        item({ category: 'TOPS', color: 'red' }),
        item({ category: 'BOTTOMS', color: 'pink' }),
        derbies,
      ],
      [...slots],
    );
    expect(one).toBeGreaterThan(0);
    expect(clash).toBeLessThan(0);
  });
});
