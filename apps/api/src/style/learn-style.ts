import { type DislikeReason, type Occasion, type Style } from '@vyra/shared';

/** A piece as the learner sees it. */
export interface SignalItem {
  id: string;
  color: string;
}

/** One thing the user did with a look. */
export interface StyleSignal {
  kind: 'LOVE' | 'DISLIKE' | 'WEAR' | 'SAVE';
  at: Date;
  occasion: Occasion;
  /**
   * The style the look was composed for. Styles are learned per look, not per
   * piece: the same derbies in a smart-casual and a traditional look must not
   * make "formal" the user's style.
   */
  style: Style;
  reason?: DislikeReason | null;
  items: SignalItem[];
}

/** Learned weights in [-1, 1], stored in `StylePreference.metadata.learned`. */
export interface LearnedStyle {
  version: 1;
  colors: Record<string, number>;
  styles: Partial<Record<Style, number>>;
  items: Record<string, number>;
  occasionStyles: Partial<Record<Occasion, Partial<Record<Style, number>>>>;
  signals: { loves: number; dislikes: number; wears: number; saves: number };
}

export const EMPTY_LEARNED: LearnedStyle = {
  version: 1,
  colors: {},
  styles: {},
  items: {},
  occasionStyles: {},
  signals: { loves: 0, dislikes: 0, wears: 0, saves: 0 },
};

/** Old signals fade: a rating counts half after this many days. */
export const HALF_LIFE_DAYS = 60;
/** Raw evidence is squashed with tanh(sum / SATURATION): ~3 strong signals ≈ 0.8. */
const SATURATION = 2.5;
/** Weights closer to 0 than this are noise and not stored. */
const MIN_WEIGHT = 0.1;

const BASE_WEIGHT: Record<StyleSignal['kind'], number> = {
  LOVE: 1,
  WEAR: 0.7,
  SAVE: 0.5,
  DISLIKE: -1,
};

/**
 * Where a "not for me" lands. Without a reason it is spread over pieces,
 * colors and style; a reason points the blame (colors, style, occasion fit,
 * or one unknown piece) and spares the rest.
 */
const DISLIKE_SPLIT: Record<
  DislikeReason | 'NONE',
  { items: number; colors: number; styles: number; occasion: number }
> = {
  NONE: { items: 0.5, colors: 0.4, styles: 0.4, occasion: 0.4 },
  COLORS: { items: 0.25, colors: 1, styles: 0, occasion: 0 },
  NOT_MY_STYLE: { items: 0.3, colors: 0, styles: 1, occasion: 0.3 },
  OCCASION: { items: 0.15, colors: 0, styles: 0, occasion: 1 },
  ONE_PIECE: { items: 0.4, colors: 0, styles: 0, occasion: 0 },
};
const LIKE_SPLIT = { items: 1, colors: 0.6, styles: 0.6, occasion: 1 };

function add(map: Record<string, number>, key: string, value: number) {
  map[key] = (map[key] ?? 0) + value;
}

function squash(raw: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, sum] of Object.entries(raw)) {
    const weight = Math.round(Math.tanh(sum / SATURATION) * 1000) / 1000;
    if (Math.abs(weight) >= MIN_WEIGHT) out[key] = weight;
  }
  return out;
}

/**
 * Recomputes the learned profile from scratch (no incremental drift): every
 * signal contributes to its pieces, their colors and styles, and to the
 * occasion → style pairing, weighted by kind and age.
 */
export function learnStyle(signals: StyleSignal[], now: Date = new Date()): LearnedStyle {
  const colors: Record<string, number> = {};
  const styles: Record<string, number> = {};
  const items: Record<string, number> = {};
  const occasionStyles: Record<string, Record<string, number>> = {};
  const counts = { loves: 0, dislikes: 0, wears: 0, saves: 0 };

  for (const signal of signals) {
    counts[
      ({ LOVE: 'loves', DISLIKE: 'dislikes', WEAR: 'wears', SAVE: 'saves' } as const)[signal.kind]
    ]++;
    const ageDays = Math.max(0, (now.getTime() - signal.at.getTime()) / 86_400_000);
    const weight = BASE_WEIGHT[signal.kind] * 0.5 ** (ageDays / HALF_LIFE_DAYS);
    const split = signal.kind === 'DISLIKE' ? DISLIKE_SPLIT[signal.reason ?? 'NONE'] : LIKE_SPLIT;

    for (const item of signal.items) add(items, item.id, weight * split.items);
    // One vote per color per look, however many pieces share it.
    for (const color of new Set(signal.items.map((item) => item.color))) {
      add(colors, color, weight * split.colors);
    }
    add(styles, signal.style, weight * split.styles);
    add((occasionStyles[signal.occasion] ??= {}), signal.style, weight * split.occasion);
  }

  return {
    version: 1,
    colors: squash(colors),
    styles: squash(styles),
    items: squash(items),
    occasionStyles: Object.fromEntries(
      Object.entries(occasionStyles)
        .map(([occasion, weights]) => [occasion, squash(weights)] as const)
        .filter(([, weights]) => Object.keys(weights).length > 0),
    ),
    signals: counts,
  };
}

/** Pieces the user keeps rejecting: never suggested again until a new signal says otherwise. */
export const AVOID_ITEM_THRESHOLD = -0.45;

export function avoidedItemIds(learned: LearnedStyle): string[] {
  return Object.entries(learned.items)
    .filter(([, weight]) => weight <= AVOID_ITEM_THRESHOLD)
    .map(([id]) => id);
}

/** Safe read of the stored JSON (older or missing data yields an empty profile). */
export function readLearned(metadata: unknown): LearnedStyle {
  const learned = (metadata as { learned?: Partial<LearnedStyle> } | null)?.learned;
  if (!learned || learned.version !== 1) return EMPTY_LEARNED;
  return { ...EMPTY_LEARNED, ...learned } as LearnedStyle;
}
