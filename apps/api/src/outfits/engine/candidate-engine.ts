import {
  type AvoidableKind,
  type ClothingCategory,
  type MissingPiece,
  type Occasion,
  type OutfitConstraints,
  type Season,
  type Style,
} from '@vyra/shared';

/**
 * Deterministic outfit candidate engine. It never invents anything: it only
 * combines the user's real pieces, scores the combinations and hands the best
 * few to the AIProvider, which picks one and explains it. Pure functions only,
 * so every rule is unit-testable.
 */

export interface EngineItem {
  id: string;
  name: string;
  category: ClothingCategory;
  subcategory: string | null;
  color: string;
  style: Style | null;
  season: Season;
  isFavorite: boolean;
}

export interface Affinity {
  colors: Map<string, number>;
  styles: Map<string, number>;
  items: Map<string, number>;
  occasionStyles: Map<string, number>;
}

export const NO_AFFINITY: Affinity = {
  colors: new Map(),
  styles: new Map(),
  items: new Map(),
  occasionStyles: new Map(),
};

export interface EngineContext {
  occasion: Occasion;
  style: Style;
  constraints: OutfitConstraints;
  preferences: { colors: string[]; styles: Style[]; dislikedItemIds: string[] };
  /**
   * Days between the target day and the closest other use of each item: worn
   * before it, or planned in the calendar around it (missing = no use nearby).
   */
  useDistanceDays: Map<string, number>;
  /**
   * Learned taste in [-1, 1] (style learning): colors, styles and pieces, and
   * the styles the user goes for at this occasion. Missing = no opinion yet.
   */
  affinity: Affinity;
  /** Combination keys generated recently (mild penalty) or disliked (strong penalty). */
  recentCombos: Set<string>;
  dislikedCombos: Set<string>;
  /** Combination keys never to propose again ("try another"). */
  excludedCombos: Set<string>;
  /**
   * Main-piece keys (top + bottom, or one-piece) of disliked or already-seen
   * outfits: the same base with another jacket is not a new look.
   */
  dislikedBases: Set<string>;
  excludedBases: Set<string>;
  /**
   * Main-piece keys worn or planned around the target day, with their distance
   * in days: repeating a whole look within the week weighs more than sharing a piece.
   */
  usedBases: Map<string, number>;
  /** Variety: different seeds break near-ties differently. */
  seed: number;
}

export type Slot = 'outer' | 'top' | 'onePiece' | 'bottom' | 'shoes' | 'accessory';

export interface Candidate {
  items: EngineItem[];
  slots: Slot[];
  score: number;
  key: string;
}

export type EngineResult =
  | { ok: true; candidates: Candidate[] }
  | { ok: false; reason: 'INCOMPLETE_CLOSET'; missing: MissingPiece[] }
  | { ok: false; reason: 'NO_MATCH' }
  | { ok: false; reason: 'REQUIRED_ITEM_UNAVAILABLE' };

// ---------------------------------------------------------------------------
// Item classification
// ---------------------------------------------------------------------------

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const KIND_KEYWORDS: Record<AvoidableKind, string[]> = {
  jeans: ['jean', 'denim'],
  heels: ['talon', 'heel', 'escarpin', 'stiletto'],
  sneakers: ['basket', 'sneaker', 'tennis', 'running'],
  shorts: ['short', 'bermuda'],
  skirt: ['jupe', 'skirt'],
  dress: ['robe', 'dress'],
};

const ONE_PIECE_KEYWORDS = [
  'robe',
  'dress',
  'boubou',
  'caftan',
  'kaftan',
  'agbada',
  'djellaba',
  'abaya',
  'combinaison',
  'jumpsuit',
  'kimono',
];

const words = (item: EngineItem) => normalize(`${item.subcategory ?? ''} ${item.name}`);

export function isKind(item: EngineItem, kind: AvoidableKind): boolean {
  const text = words(item);
  return KIND_KEYWORDS[kind].some((keyword) => text.includes(keyword));
}

export function slotOf(item: EngineItem): Slot | null {
  switch (item.category) {
    case 'TOPS':
      return 'top';
    case 'BOTTOMS':
      return 'bottom';
    case 'SHOES':
      return 'shoes';
    case 'OUTERWEAR':
      return 'outer';
    case 'ACCESSORIES':
      return 'accessory';
    case 'TRADITIONAL':
      // A dashiki is a top; a boubou or a wax dress dresses the whole body.
      return ONE_PIECE_KEYWORDS.some((keyword) => words(item).includes(keyword))
        ? 'onePiece'
        : 'top';
    case 'OTHER':
      return ONE_PIECE_KEYWORDS.some((keyword) => words(item).includes(keyword))
        ? 'onePiece'
        : null;
  }
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** How well an item's style serves the requested style (1 = same family). */
const STYLE_AFFINITY: Record<Style, Partial<Record<Style, number>>> = {
  CASUAL: { CASUAL: 1, STREETWEAR: 0.7, SMART_CASUAL: 0.6, SPORT: 0.45 },
  // Tailored pieces (derbies, trousers) lift a smart-casual look more than dressy ones.
  SMART_CASUAL: { SMART_CASUAL: 1, FORMAL: 0.75, ELEGANT: 0.65, CASUAL: 0.6 },
  ELEGANT: { ELEGANT: 1, FORMAL: 0.75, SMART_CASUAL: 0.6, TRADITIONAL: 0.5 },
  STREETWEAR: { STREETWEAR: 1, CASUAL: 0.75, SPORT: 0.55 },
  FORMAL: { FORMAL: 1, ELEGANT: 0.75, SMART_CASUAL: 0.5 },
  SPORT: { SPORT: 1, STREETWEAR: 0.5, CASUAL: 0.45 },
  TRADITIONAL: { TRADITIONAL: 1, ELEGANT: 0.5, FORMAL: 0.4 },
};

/** Styles that suit each occasion, with their weight. */
const OCCASION_STYLES: Record<Occasion, Partial<Record<Style, number>>> = {
  WORK: { SMART_CASUAL: 1, FORMAL: 0.9, ELEGANT: 0.7, CASUAL: 0.35 },
  DATE: { ELEGANT: 1, SMART_CASUAL: 0.85, CASUAL: 0.5, STREETWEAR: 0.4 },
  DINNER: { ELEGANT: 1, SMART_CASUAL: 0.85, FORMAL: 0.6, TRADITIONAL: 0.5 },
  PARTY: { ELEGANT: 1, STREETWEAR: 0.8, SMART_CASUAL: 0.6, TRADITIONAL: 0.5 },
  WEDDING: { TRADITIONAL: 1, ELEGANT: 0.9, FORMAL: 0.85 },
  TRAVEL: { CASUAL: 1, SMART_CASUAL: 0.75, STREETWEAR: 0.7, SPORT: 0.5 },
  CASUAL: { CASUAL: 1, STREETWEAR: 0.85, SMART_CASUAL: 0.6 },
  WORKOUT: { SPORT: 1, CASUAL: 0.4, STREETWEAR: 0.35 },
  TRADITIONAL: { TRADITIONAL: 1, ELEGANT: 0.45 },
  SURPRISE: {
    CASUAL: 0.7,
    SMART_CASUAL: 0.7,
    ELEGANT: 0.7,
    STREETWEAR: 0.7,
    FORMAL: 0.7,
    TRADITIONAL: 0.7,
    SPORT: 0.4,
  },
};

const NEUTRAL_COLORS = new Set([
  'black',
  'white',
  'cream',
  'beige',
  'camel',
  'brown',
  'grey',
  'navy',
  'silver',
  'gold',
]);

/** Accent pairs that fight each other when worn together. */
const CLASHES = [
  ['red', 'pink'],
  ['red', 'orange'],
  ['orange', 'pink'],
  ['orange', 'purple'],
  ['green', 'red'],
  ['yellow', 'purple'],
  ['burgundy', 'orange'],
];

/** Small deterministic noise in [0, 1) so equal scores do not always resolve the same way. */
function jitter(seed: number, key: string): number {
  let hash = 2166136261 ^ seed;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

export function recencyPenalty(distanceDays: number | undefined): number {
  if (distanceDays === undefined || distanceDays < 0) return 0;
  // Used the same day: strong penalty; it fades over about a week.
  return 0.35 * Math.exp(-distanceDays / 4);
}

/** Same main pieces as a look used `distanceDays` from the target day. */
export function baseRepeatPenalty(distanceDays: number | undefined): number {
  if (distanceDays === undefined || distanceDays < 0) return 0;
  return 0.3 * Math.exp(-distanceDays / 5);
}

export function scoreItem(item: EngineItem, context: EngineContext): number {
  const style = item.style;
  const styleFit = style ? (STYLE_AFFINITY[context.style][style] ?? 0.15) : 0.5;
  const occasionFit = style ? (OCCASION_STYLES[context.occasion][style] ?? 0.15) : 0.5;
  let score = 0.45 * styleFit + 0.35 * occasionFit;
  if (context.preferences.colors.includes(item.color)) score += 0.08;
  if (style && context.preferences.styles.includes(style)) score += 0.08;
  if (item.isFavorite) score += 0.06;
  // Learned taste nudges, never overrides, the fit to the occasion. Piece
  // scores are averaged over the look (~4 pieces), hence these sizes: a
  // well-loved piece moves its look by ~0.04, less than a style misfit costs.
  const { affinity } = context;
  score += 0.14 * (affinity.colors.get(item.color) ?? 0);
  if (style) {
    score += 0.1 * (affinity.styles.get(style) ?? 0);
    score += 0.1 * (affinity.occasionStyles.get(style) ?? 0);
  }
  score += 0.15 * (affinity.items.get(item.id) ?? 0);
  return score - recencyPenalty(context.useDistanceDays.get(item.id));
}

/** Color harmony of the visible pieces (accessories excluded). */
export function colorHarmony(items: EngineItem[], slots: Slot[]): number {
  const accents = [
    ...new Set(
      items
        .filter((_, index) => slots[index] !== 'accessory')
        .map((item) => item.color)
        .filter((color) => !NEUTRAL_COLORS.has(color)),
    ),
  ];
  if (accents.length >= 3) return -0.1;
  const clash = CLASHES.some(([a, b]) => accents.includes(a!) && accents.includes(b!));
  if (clash) return -0.08;
  if (accents.length === 1) return 0.06; // one accent on a neutral base: the classic
  if (accents.length === 0) return 0.04; // all neutrals: safe and elegant
  return 0.02;
}

export const comboKey = (ids: string[]) => [...ids].sort().join(',');

const MAIN_SLOTS: Slot[] = ['top', 'bottom', 'onePiece'];

/** Key of the pieces that define a look (top + bottom, or the one-piece). */
export function baseKeyOf(items: EngineItem[]): string {
  return comboKey(
    items.filter((item) => MAIN_SLOTS.includes(slotOf(item) as Slot)).map((item) => item.id),
  );
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const PER_SLOT = { top: 6, bottom: 6, onePiece: 5, shoes: 4, outer: 3, accessory: 3 } as const;
const MAX_CANDIDATES = 5;

/** Footwear that does not belong to some occasions at all. */
function isEligible(item: EngineItem, context: EngineContext): boolean {
  if (context.preferences.dislikedItemIds.includes(item.id)) return false;
  if (context.constraints.avoidColors.includes(item.color as never)) return false;
  if (context.constraints.avoidKinds.some((kind) => isKind(item, kind))) return false;
  if (context.occasion === 'WORKOUT' && isKind(item, 'heels')) return false;
  if (['WEDDING', 'WORK'].includes(context.occasion) && item.style === 'SPORT') return false;
  return true;
}

export function generateCandidates(closet: EngineItem[], context: EngineContext): EngineResult {
  const required = context.constraints.requiredItemId;
  const eligible = closet.filter((item) => slotOf(item) !== null && isEligible(item, context));
  const requiredItem = required ? eligible.find((item) => item.id === required) : undefined;
  if (required && !requiredItem) return { ok: false, reason: 'REQUIRED_ITEM_UNAVAILABLE' };

  const bySlot = new Map<Slot, { item: EngineItem; score: number }[]>();
  for (const item of eligible) {
    const slot = slotOf(item)!;
    const list = bySlot.get(slot) ?? [];
    list.push({ item, score: scoreItem(item, context) });
    bySlot.set(slot, list);
  }
  const top = (slot: Slot) => {
    const ranked = (bySlot.get(slot) ?? []).sort(
      (a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id),
    );
    // "Use this item" pins its slot to that single piece.
    if (requiredItem && slotOf(requiredItem) === slot) {
      return ranked.filter(({ item }) => item.id === requiredItem.id);
    }
    return ranked.slice(0, PER_SLOT[slot]);
  };

  const shoes = top('shoes');
  const tops = top('top');
  const bottoms = top('bottom');
  const onePieces = top('onePiece');
  const missing: MissingPiece[] = [];
  if (shoes.length === 0) missing.push('SHOES');
  if (onePieces.length === 0) {
    if (tops.length === 0) missing.push('TOP');
    if (bottoms.length === 0) missing.push('BOTTOM');
  }
  if (missing.length > 0) {
    // Distinguish "your closet lacks shoes" from "your constraints exclude them".
    const closetSlots = new Set(closet.map(slotOf));
    const closetHas = (piece: MissingPiece) =>
      piece === 'SHOES'
        ? closetSlots.has('shoes')
        : piece === 'TOP'
          ? closetSlots.has('top') || closetSlots.has('onePiece')
          : closetSlots.has('bottom') || closetSlots.has('onePiece');
    const reallyMissing = missing.filter((piece) => !closetHas(piece));
    return reallyMissing.length > 0
      ? { ok: false, reason: 'INCOMPLETE_CLOSET', missing: reallyMissing }
      : { ok: false, reason: 'NO_MATCH' };
  }

  // Optional layers: "none" first, so a weak jacket never drags a good outfit down.
  const outerRequired = requiredItem && slotOf(requiredItem) === 'outer';
  const accessoryRequired = requiredItem && slotOf(requiredItem) === 'accessory';
  const outers = [...(outerRequired ? [] : [null]), ...top('outer')];
  const accessories = [...(accessoryRequired ? [] : [null]), ...top('accessory')];

  const bases: { pieces: { item: EngineItem; score: number }[]; slots: Slot[] }[] = [];
  const onePieceRequired = requiredItem && slotOf(requiredItem) === 'onePiece';
  const twoPieceRequired = requiredItem && ['top', 'bottom'].includes(slotOf(requiredItem) ?? '');
  if (!onePieceRequired) {
    for (const t of tops)
      for (const b of bottoms) bases.push({ pieces: [t, b], slots: ['top', 'bottom'] });
  }
  if (!twoPieceRequired) {
    for (const o of onePieces) bases.push({ pieces: [o], slots: ['onePiece'] });
  }

  const candidates: Candidate[] = [];
  for (const base of bases) {
    for (const shoe of shoes) {
      for (const outer of outers) {
        for (const accessory of accessories) {
          const pieces = [
            ...(outer ? [{ entry: outer, slot: 'outer' as const }] : []),
            ...base.pieces.map((entry, index) => ({ entry, slot: base.slots[index]! })),
            { entry: shoe, slot: 'shoes' as const },
            ...(accessory ? [{ entry: accessory, slot: 'accessory' as const }] : []),
          ];
          const items = pieces.map((piece) => piece.entry.item);
          const slots = pieces.map((piece) => piece.slot);
          const key = comboKey(items.map((item) => item.id));
          if (context.excludedCombos.has(key)) continue;
          const baseKey = comboKey(base.pieces.map((entry) => entry.item.id));

          const mean = pieces.reduce((sum, piece) => sum + piece.entry.score, 0) / pieces.length;
          let score = mean + colorHarmony(items, slots);
          if (accessory) score += 0.02;
          if (outer && ['WORK', 'WEDDING', 'DINNER'].includes(context.occasion)) score += 0.02;
          if (context.recentCombos.has(key)) score -= 0.15;
          if (context.dislikedCombos.has(key)) score -= 0.4;
          else if (context.dislikedBases.has(baseKey)) score -= 0.3;
          if (context.excludedBases.has(baseKey)) score -= 0.25;
          score -= baseRepeatPenalty(context.usedBases.get(baseKey));
          score += (jitter(context.seed, key) - 0.5) * 0.04;
          candidates.push({ items, slots, key, score: Math.max(0, Math.min(1, score)) });
        }
      }
    }
  }

  if (candidates.length === 0) return { ok: false, reason: 'NO_MATCH' };

  // Best first, then keep variety: no two candidates share the same main pieces.
  candidates.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const chosen: Candidate[] = [];
  const seenBases = new Set<string>();
  for (const candidate of candidates) {
    const baseKey = comboKey(
      candidate.items
        .filter((_, index) => MAIN_SLOTS.includes(candidate.slots[index]!))
        .map((item) => item.id),
    );
    if (seenBases.has(baseKey)) continue;
    seenBases.add(baseKey);
    chosen.push(candidate);
    if (chosen.length === MAX_CANDIDATES) break;
  }
  return { ok: true, candidates: chosen };
}
