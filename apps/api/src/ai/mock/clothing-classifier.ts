import {
  type ClothingAnalysis,
  type ClothingCategory,
  nearestStyleColor,
  type Season,
  type Style,
  STYLE_COLORS,
  type StyleColor,
} from '@vyra/shared';
import { type SilhouetteFeatures } from './garment-vision';

/** Garment kinds the silhouette rules can tell apart. */
export type GarmentKind =
  | 'tshirt'
  | 'longSleeveTop'
  | 'coat'
  | 'trousers'
  | 'jeans'
  | 'shorts'
  | 'skirt'
  | 'dress'
  | 'waxDress'
  | 'sneakers'
  | 'shoes'
  | 'heels'
  | 'bag'
  | 'watch'
  | 'boubou'
  | 'top';

interface KindGuess {
  kind: GarmentKind;
  confidence: number;
}

/**
 * Silhouette rules, tuned on flat-lay product shots (garment centered on a plain
 * backdrop). Order matters: the most distinctive shapes are tested first.
 */
export function classifySilhouette(f: SilhouetteFeatures): KindGuess {
  const { top, upper, mid, lower, bottom } = f.widths;
  if (f.coverage < 0.03) return { kind: 'top', confidence: 0.25 };

  // Wide and low: footwear seen from the side.
  if (f.aspect < 0.8) {
    if (lower < 0.2 && bottom < 0.2) return { kind: 'heels', confidence: 0.7 };
    return { kind: f.aspect >= 0.47 ? 'sneakers' : 'shoes', confidence: 0.75 };
  }
  // Narrow straps around a wide dial.
  if (mid > top * 1.8 && mid > bottom * 1.8 && f.aspect > 1.4)
    return { kind: 'watch', confidence: 0.65 };
  // Thin handle above a square body.
  if (top < upper * 0.6 && f.aspect >= 0.9 && f.aspect <= 1.5 && Math.abs(lower - mid) < 0.1) {
    return { kind: 'bag', confidence: 0.65 };
  }
  // Two legs separated by a gap.
  if (f.legGap > 0.4 && f.aspect > 1.5) {
    const blue = ['navy', 'blue'].includes(nearestStyleColor(f.colorHex) ?? '');
    return { kind: blue ? 'jeans' : 'trousers', confidence: 0.85 };
  }
  if (f.legGap > 0.12 && f.aspect <= 1.5) return { kind: 'shorts', confidence: 0.75 };
  // Very wide sleeves over a narrower body: boubou, kaftan, agbada.
  if (upper > mid * 1.5) return { kind: 'boubou', confidence: 0.7 };
  // Flares out toward the hem without sleeves.
  if (bottom > mid * 1.2 && top <= upper * 1.1) {
    if (f.aspect >= 1.75) {
      return f.patternShare > 0.2
        ? { kind: 'waxDress', confidence: 0.65 }
        : { kind: 'dress', confidence: 0.7 };
    }
    return { kind: 'skirt', confidence: 0.65 };
  }
  // Long sleeves hanging lower than the hem line.
  if (lower > bottom * 1.3) {
    return f.aspect >= 1.4
      ? { kind: 'coat', confidence: 0.6 }
      : { kind: 'longSleeveTop', confidence: 0.6 };
  }
  // Short sleeves sticking out at the shoulders.
  if (top > upper * 1.1) return { kind: 'tshirt', confidence: 0.75 };
  return { kind: 'top', confidence: 0.4 };
}

const KIND_CATEGORY: Record<GarmentKind, ClothingCategory> = {
  tshirt: 'TOPS',
  longSleeveTop: 'TOPS',
  top: 'TOPS',
  coat: 'OUTERWEAR',
  trousers: 'BOTTOMS',
  jeans: 'BOTTOMS',
  shorts: 'BOTTOMS',
  skirt: 'BOTTOMS',
  dress: 'OTHER',
  waxDress: 'TRADITIONAL',
  boubou: 'TRADITIONAL',
  sneakers: 'SHOES',
  shoes: 'SHOES',
  heels: 'SHOES',
  bag: 'ACCESSORIES',
  watch: 'ACCESSORIES',
};

const DARK_COLORS: StyleColor[] = ['black', 'navy', 'brown', 'burgundy', 'grey', 'olive', 'purple'];

function guessStyle(kind: GarmentKind, color: StyleColor): { style: Style; confidence: number } {
  switch (kind) {
    case 'boubou':
    case 'waxDress':
      return { style: 'TRADITIONAL', confidence: 0.8 };
    case 'tshirt':
    case 'jeans':
    case 'shorts':
    case 'sneakers':
      return { style: 'CASUAL', confidence: 0.55 };
    case 'dress':
    case 'heels':
    case 'watch':
    case 'bag':
    case 'skirt':
      return { style: 'ELEGANT', confidence: 0.5 };
    case 'trousers':
      return { style: DARK_COLORS.includes(color) ? 'SMART_CASUAL' : 'CASUAL', confidence: 0.5 };
    default:
      return { style: 'SMART_CASUAL', confidence: 0.45 };
  }
}

function guessSeason(kind: GarmentKind, color: StyleColor): { season: Season; confidence: number } {
  if (kind === 'shorts') return { season: 'SUMMER', confidence: 0.65 };
  if (kind === 'coat') {
    return { season: DARK_COLORS.includes(color) ? 'WINTER' : 'AUTUMN', confidence: 0.5 };
  }
  if (kind === 'tshirt' && !DARK_COLORS.includes(color))
    return { season: 'SUMMER', confidence: 0.4 };
  return { season: 'ALL_SEASON', confidence: 0.55 };
}

// ---------------------------------------------------------------------------
// Naming (FR with gender/number agreement, EN)
// ---------------------------------------------------------------------------

type Gender = 'm' | 'f';

const FR_NOUNS: Record<
  GarmentKind,
  { label: string; gender: Gender; plural?: boolean; subcategory: string }
> = {
  tshirt: { label: 'T-shirt', gender: 'm', subcategory: 't-shirt' },
  longSleeveTop: { label: 'Haut à manches longues', gender: 'm', subcategory: 'manches longues' },
  top: { label: 'Haut', gender: 'm', subcategory: 'haut' },
  coat: { label: 'Manteau', gender: 'm', subcategory: 'manteau' },
  trousers: { label: 'Pantalon', gender: 'm', subcategory: 'pantalon' },
  jeans: { label: 'Jean', gender: 'm', subcategory: 'jean' },
  shorts: { label: 'Short', gender: 'm', subcategory: 'short' },
  skirt: { label: 'Jupe', gender: 'f', subcategory: 'jupe' },
  dress: { label: 'Robe', gender: 'f', subcategory: 'robe' },
  waxDress: { label: 'Robe en wax', gender: 'f', subcategory: 'robe en wax' },
  boubou: { label: 'Boubou', gender: 'm', subcategory: 'boubou' },
  sneakers: { label: 'Baskets', gender: 'f', plural: true, subcategory: 'baskets' },
  shoes: { label: 'Chaussures', gender: 'f', plural: true, subcategory: 'chaussures' },
  heels: { label: 'Sandales à talon', gender: 'f', plural: true, subcategory: 'talons' },
  bag: { label: 'Sac', gender: 'm', subcategory: 'sac' },
  watch: { label: 'Montre', gender: 'f', subcategory: 'montre' },
};

/** [masculine, feminine]; invariable adjectives repeat the same form and never take -s. */
const FR_COLORS: Record<StyleColor, { m: string; f: string; invariable?: boolean }> = {
  black: { m: 'noir', f: 'noire' },
  white: { m: 'blanc', f: 'blanche' },
  cream: { m: 'crème', f: 'crème', invariable: true },
  beige: { m: 'beige', f: 'beige' },
  camel: { m: 'camel', f: 'camel', invariable: true },
  brown: { m: 'marron', f: 'marron', invariable: true },
  grey: { m: 'gris', f: 'grise' },
  navy: { m: 'bleu marine', f: 'bleu marine', invariable: true },
  blue: { m: 'bleu', f: 'bleue' },
  green: { m: 'vert', f: 'verte' },
  olive: { m: 'olive', f: 'olive', invariable: true },
  red: { m: 'rouge', f: 'rouge' },
  terracotta: { m: 'terracotta', f: 'terracotta', invariable: true },
  pink: { m: 'rose', f: 'rose' },
  yellow: { m: 'jaune', f: 'jaune' },
  gold: { m: 'doré', f: 'dorée' },
  burgundy: { m: 'bordeaux', f: 'bordeaux', invariable: true },
  orange: { m: 'orange', f: 'orange', invariable: true },
  purple: { m: 'violet', f: 'violette' },
  silver: { m: 'argenté', f: 'argentée' },
};

const EN_NOUNS: Record<GarmentKind, { label: string; subcategory: string }> = {
  tshirt: { label: 't-shirt', subcategory: 't-shirt' },
  longSleeveTop: { label: 'long-sleeve top', subcategory: 'long sleeves' },
  top: { label: 'top', subcategory: 'top' },
  coat: { label: 'coat', subcategory: 'coat' },
  trousers: { label: 'trousers', subcategory: 'trousers' },
  jeans: { label: 'jeans', subcategory: 'jeans' },
  shorts: { label: 'shorts', subcategory: 'shorts' },
  skirt: { label: 'skirt', subcategory: 'skirt' },
  dress: { label: 'dress', subcategory: 'dress' },
  waxDress: { label: 'wax print dress', subcategory: 'wax dress' },
  boubou: { label: 'boubou', subcategory: 'boubou' },
  sneakers: { label: 'sneakers', subcategory: 'sneakers' },
  shoes: { label: 'shoes', subcategory: 'shoes' },
  heels: { label: 'heeled sandals', subcategory: 'heels' },
  bag: { label: 'bag', subcategory: 'bag' },
  watch: { label: 'watch', subcategory: 'watch' },
};

const EN_COLORS: Record<StyleColor, string> = {
  black: 'Black',
  white: 'White',
  cream: 'Cream',
  beige: 'Beige',
  camel: 'Camel',
  brown: 'Brown',
  grey: 'Grey',
  navy: 'Navy',
  blue: 'Blue',
  green: 'Green',
  olive: 'Olive',
  red: 'Red',
  terracotta: 'Terracotta',
  pink: 'Pink',
  yellow: 'Yellow',
  gold: 'Gold',
  burgundy: 'Burgundy',
  orange: 'Orange',
  purple: 'Purple',
  silver: 'Silver',
};

export function nameGarment(kind: GarmentKind, color: StyleColor, locale: string) {
  if (locale.startsWith('en')) {
    return {
      name: `${EN_COLORS[color]} ${EN_NOUNS[kind].label}`,
      subcategory: EN_NOUNS[kind].subcategory,
    };
  }
  const noun = FR_NOUNS[kind];
  const adjective = FR_COLORS[color];
  let colorWord = noun.gender === 'f' ? adjective.f : adjective.m;
  if (noun.plural && !adjective.invariable && !colorWord.endsWith('s')) colorWord += 's';
  // A patterned piece is named after its fabric rather than its main color.
  const name = kind === 'waxDress' ? noun.label : `${noun.label} ${colorWord}`;
  return { name, subcategory: noun.subcategory };
}

/** Full analysis from silhouette features. */
export function analyzeFeatures(features: SilhouetteFeatures, locale: string): ClothingAnalysis {
  const guess = classifySilhouette(features);
  const color = nearestStyleColor(features.colorHex) ?? 'black';
  const style = guessStyle(guess.kind, color);
  const season = guessSeason(guess.kind, color);
  const { name, subcategory } = nameGarment(guess.kind, color, locale);

  // How far the measured color is from the chosen palette color (0 = exact).
  const [r1, g1, b1] = [1, 3, 5].map((i) => Number.parseInt(features.colorHex.slice(i, i + 2), 16));
  const [r2, g2, b2] = [1, 3, 5].map((i) =>
    Number.parseInt(STYLE_COLORS[color].slice(i, i + 2), 16),
  );
  const colorGap = Math.sqrt((r1! - r2!) ** 2 + (g1! - g2!) ** 2 + (b1! - b2!) ** 2);

  return {
    name,
    category: KIND_CATEGORY[guess.kind],
    subcategory,
    color,
    colorHex: features.colorHex,
    style: style.style,
    season: season.season,
    confidence: {
      category: guess.confidence,
      color: features.coverage < 0.03 ? 0.3 : Math.max(0.4, Math.min(0.95, 1 - colorGap / 200)),
      style: style.confidence,
      season: season.confidence,
    },
  };
}
