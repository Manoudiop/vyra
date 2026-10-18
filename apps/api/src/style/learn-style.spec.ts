import { avoidedItemIds, learnStyle, readLearned, type StyleSignal } from './learn-style';

const NOW = new Date('2026-10-18T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

const blazer = { id: 'blazer', color: 'navy' };
const oxford = { id: 'oxford', color: 'blue' };
const chinos = { id: 'chinos', color: 'beige' };
const redShirt = { id: 'red-shirt', color: 'red' };
const cargo = { id: 'cargo', color: 'olive' };
const agbada = { id: 'agbada', color: 'navy' };

const signal = (
  kind: StyleSignal['kind'],
  items: StyleSignal['items'],
  extra: Partial<StyleSignal> = {},
): StyleSignal => ({
  kind,
  at: daysAgo(1),
  occasion: 'WORK',
  style: 'SMART_CASUAL',
  items,
  ...extra,
});

describe('learnStyle', () => {
  it('learns from loves and wears: pieces, colors, styles and occasion → style', () => {
    const learned = learnStyle(
      [
        signal('LOVE', [blazer, oxford, chinos]),
        signal('WEAR', [blazer, oxford, chinos]),
        signal('LOVE', [agbada], { occasion: 'WEDDING', style: 'TRADITIONAL' }),
      ],
      NOW,
    );
    expect(learned.items.blazer).toBeGreaterThan(0.5);
    expect(learned.colors.navy).toBeGreaterThan(learned.colors.beige!);
    expect(learned.styles.SMART_CASUAL).toBeGreaterThan(0.3);
    expect(learned.occasionStyles.WEDDING?.TRADITIONAL).toBeGreaterThan(0.3);
    expect(learned.occasionStyles.WORK?.TRADITIONAL).toBeUndefined();
    expect(learned.signals).toEqual({ loves: 2, dislikes: 0, wears: 1, saves: 0 });
  });

  it('a color complaint blames colors, not the style', () => {
    const learned = learnStyle([signal('DISLIKE', [redShirt, cargo], { reason: 'COLORS' })], NOW);
    expect(learned.colors.red).toBeLessThan(-0.3);
    expect(learned.styles.STREETWEAR).toBeUndefined();
  });

  it('"not my style" blames the style', () => {
    const learned = learnStyle(
      [
        signal('DISLIKE', [redShirt, cargo], {
          reason: 'NOT_MY_STYLE',
          occasion: 'CASUAL',
          style: 'STREETWEAR',
        }),
      ],
      NOW,
    );
    expect(learned.styles.STREETWEAR).toBeLessThan(-0.3);
    expect(learned.colors.red).toBeUndefined();
    expect(learned.occasionStyles.CASUAL?.STREETWEAR).toBeLessThan(0);
  });

  it('avoids a piece only after repeated rejection', () => {
    const once = learnStyle([signal('DISLIKE', [redShirt, chinos])], NOW);
    expect(avoidedItemIds(once)).toEqual([]);
    const thrice = learnStyle(
      [
        signal('DISLIKE', [redShirt, chinos]),
        signal('DISLIKE', [redShirt, cargo]),
        signal('DISLIKE', [redShirt, oxford], { reason: 'ONE_PIECE' }),
      ],
      NOW,
    );
    expect(avoidedItemIds(thrice)).toEqual(['red-shirt']);
  });

  it('wearing a piece outweighs an old dislike', () => {
    const learned = learnStyle(
      [
        signal('DISLIKE', [chinos, redShirt], { at: daysAgo(90) }),
        signal('WEAR', [chinos, oxford]),
        signal('WEAR', [chinos, blazer]),
      ],
      NOW,
    );
    expect(learned.items.chinos).toBeGreaterThan(0.3);
  });

  it('learns the style of the look, not of shared pieces', () => {
    const derbies = { id: 'derbies', color: 'brown' };
    const learned = learnStyle(
      [
        signal('LOVE', [oxford, chinos, derbies]),
        signal('LOVE', [agbada, derbies], { occasion: 'WEDDING', style: 'TRADITIONAL' }),
      ],
      NOW,
    );
    expect(Object.keys(learned.styles).sort()).toEqual(['SMART_CASUAL', 'TRADITIONAL']);
    expect(learned.items.derbies).toBeGreaterThan(learned.items.oxford!);
  });

  it('lets old signals fade', () => {
    const recent = learnStyle([signal('LOVE', [oxford])], NOW);
    const old = learnStyle([signal('LOVE', [oxford], { at: daysAgo(120) })], NOW);
    expect(old.items.oxford).toBeLessThan(recent.items.oxford! / 2);
  });

  it('keeps weights within [-1, 1] and drops noise', () => {
    const many = Array.from({ length: 40 }, () => signal('LOVE', [oxford]));
    const learned = learnStyle(many, NOW);
    expect(learned.items.oxford).toBeLessThanOrEqual(1);
    const faint = learnStyle([signal('SAVE', [oxford], { at: daysAgo(400) })], NOW);
    expect(faint.items).toEqual({});
  });

  it('reads stored data defensively', () => {
    expect(readLearned(null).items).toEqual({});
    expect(readLearned({ learned: { version: 99 } }).colors).toEqual({});
    const stored = learnStyle([signal('LOVE', [oxford])], NOW);
    expect(readLearned({ learned: stored })).toEqual(stored);
  });
});
