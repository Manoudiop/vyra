import { type Style } from '@vyra/shared';
import { type AIClothingItem, type AnalyzeStyleInput, type StyleAnalysis } from '../ai.provider';
import {
  capitalize,
  COLOR_NOUNS,
  joinEn,
  joinFr,
  leFr,
  type Locale,
  NEUTRALS,
  OCCASION_PHRASE,
  pickLocale,
} from './stylist-copy';

/**
 * Template style analysis for the mock provider. Every sentence states a fact
 * measured on the user's own data (learned weights, closet, worn looks); with
 * too little data it says so rather than inventing a personality.
 */

const STYLE_NOUN: Record<Locale, Record<Style, string>> = {
  fr: {
    CASUAL: 'le décontracté',
    SMART_CASUAL: 'le smart casual',
    ELEGANT: 'l’élégant',
    STREETWEAR: 'le streetwear',
    FORMAL: 'le formel',
    SPORT: 'le sportswear',
    TRADITIONAL: 'le traditionnel',
  },
  en: {
    CASUAL: 'relaxed casual',
    SMART_CASUAL: 'smart casual',
    ELEGANT: 'elegant',
    STREETWEAR: 'streetwear',
    FORMAL: 'formal',
    SPORT: 'sporty',
    TRADITIONAL: 'traditional',
  },
};

/** « de beige », « d’olive ». */
const deFr = (words: string) => (/^[aeiouyhéèêàâîôû]/i.test(words) ? `d’${words}` : `de ${words}`);

/** « au smart casual », « à l’élégant ». */
const auFr = (noun: string) => (noun.startsWith('le ') ? `au ${noun.slice(3)}` : `à ${noun}`);

/** Accents that lift a neutral wardrobe, in order of preference. */
const ACCENT_IDEAS = ['terracotta', 'olive', 'yellow', 'burgundy', 'green'];

const MAIN_CATEGORIES = new Set(['TOPS', 'BOTTOMS', 'DRESSES', 'TRADITIONAL']);

function mostFrequent<T>(values: T[], limit: number): T[] {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

export function analyzeStyleFromFacts(input: AnalyzeStyleInput): StyleAnalysis {
  const locale = pickLocale(input.locale);
  const fr = locale === 'fr';
  const color = (value: string) => COLOR_NOUNS[locale][value] ?? value;
  const join = fr ? joinFr : joinEn;

  const dominantStyles: Style[] = (
    input.learned.styles.length
      ? input.learned.styles.map((entry) => entry.value)
      : input.preferredStyles.length
        ? input.preferredStyles
        : mostFrequent(
            input.closet.flatMap((item) => (item.style ? [item.style] : [])),
            2,
          )
  ).slice(0, 2);
  const signatureColors = (
    input.learned.colors.length
      ? input.learned.colors.map((entry) => entry.value)
      : input.preferredColors.length
        ? input.preferredColors
        : mostFrequent(
            input.closet.map((item) => item.color),
            3,
          )
  ).slice(0, 3);

  const summary: string[] = [];
  if (dominantStyles.length) {
    const styles = join(dominantStyles.map((style) => STYLE_NOUN[locale][style]));
    const neutrals = signatureColors.filter((value) => NEUTRALS.has(value)).map(color);
    const accents = signatureColors.filter((value) => !NEUTRALS.has(value)).map(color);
    const palette = fr
      ? accents.length && neutrals.length
        ? `une base ${deFr(join(neutrals))} relevée ${deFr(join(accents))}`
        : `une palette ${deFr(join([...neutrals, ...accents]))}`
      : accents.length && neutrals.length
        ? `a base of ${join(neutrals)} lifted by ${join(accents)}`
        : `a palette of ${join([...neutrals, ...accents])}`;
    summary.push(
      fr
        ? `Ton style penche vers ${styles}${signatureColors.length ? `, avec ${palette}` : ''}.`
        : `Your style leans towards ${styles}${signatureColors.length ? `, with ${palette}` : ''}.`,
    );
  }
  for (const { occasion, style } of input.learned.occasionStyles
    .filter((entry) => entry.style !== dominantStyles[0])
    .slice(0, 2)) {
    const where = OCCASION_PHRASE[locale][occasion];
    const noun = STYLE_NOUN[locale][style];
    summary.push(fr ? `Pour ${where}, tu passes ${auFr(noun)}.` : `For ${where}, you go ${noun}.`);
  }
  const avoided = input.learned.avoidedColors[0]?.value;
  if (avoided) {
    summary.push(
      fr ? `Tu écartes souvent ${leFr(color(avoided))}.` : `You often turn down ${color(avoided)}.`,
    );
  }
  if (!summary.length) {
    summary.push(
      fr
        ? 'Ton profil se dessine encore : note quelques looks pour que l’analyse gagne en précision.'
        : 'Your profile is still taking shape: rate a few looks to sharpen the analysis.',
    );
  }

  return {
    summary: summary.join(' '),
    dominantStyles,
    signatureColors,
    suggestions: suggestionsFor(input, { locale, dominantStyles, signatureColors, color }),
  };
}

function suggestionsFor(
  input: AnalyzeStyleInput,
  context: {
    locale: Locale;
    dominantStyles: Style[];
    signatureColors: string[];
    color: (value: string) => string;
  },
): string[] {
  const { locale, dominantStyles, signatureColors, color } = context;
  const fr = locale === 'fr';
  const ideas: string[] = [];

  // 1. One main piece carrying most of the worn looks.
  const worn = input.wornOutfits.slice(0, 12);
  if (worn.length >= 4) {
    const uses = new Map<string, { item: AIClothingItem; count: number }>();
    for (const look of worn) {
      for (const item of look.filter((piece) => MAIN_CATEGORIES.has(piece.category))) {
        const entry = uses.get(item.id) ?? { item, count: 0 };
        entry.count += 1;
        uses.set(item.id, entry);
      }
    }
    const top = [...uses.values()].sort((a, b) => b.count - a.count)[0];
    if (top && top.count >= 3 && top.count / worn.length >= 0.5) {
      ideas.push(
        fr
          ? `« ${top.item.name} » revient dans ${top.count} de tes ${worn.length} derniers looks portés : une alternative du même style te donnerait plus de rotation.`
          : `“${top.item.name}” is in ${top.count} of your last ${worn.length} worn looks: a similar alternative would give you more rotation.`,
      );
    }
  }

  // 2. A color the user keeps turning down still fills the closet.
  const avoided = input.learned.avoidedColors[0]?.value;
  if (avoided) {
    const count = input.closet.filter((item) => item.color === avoided).length;
    if (count >= 2) {
      ideas.push(
        fr
          ? `Tu boudes ${leFr(color(avoided))} alors que ${count} pièces de ton dressing en ont : porte-les avec des neutres, ou fais-leur de la place.`
          : `You turn down ${color(avoided)}, yet ${count} pieces in your closet are that color: pair them with neutrals, or make room.`,
      );
    }
  }

  // 3. An all-neutral palette.
  if (signatureColors.length >= 2 && signatureColors.every((value) => NEUTRALS.has(value))) {
    const avoidedSet = new Set(input.learned.avoidedColors.map((entry) => entry.value));
    const accent = ACCENT_IDEAS.find((value) => !avoidedSet.has(value));
    if (accent) {
      ideas.push(
        fr
          ? `Ta palette est très neutre : une pièce ${color(accent)} relèverait tes basiques sans rien casser.`
          : `Your palette is very neutral: one ${color(accent)} piece would lift your basics without breaking anything.`,
      );
    }
  }

  // 4. Too few shoes for the style the user wears most.
  const main = dominantStyles[0];
  if (main) {
    const shoes = input.closet.filter(
      (item) => item.category === 'SHOES' && item.style === main,
    ).length;
    if (shoes < 2) {
      const noun = STYLE_NOUN[locale][main];
      ideas.push(
        fr
          ? `${shoes === 0 ? 'Aucune paire de chaussures' : 'Une seule paire de chaussures'} pour ${noun}, ton style principal : une ${shoes === 0 ? 'première' : 'deuxième'} paire élargirait tes combinaisons.`
          : `${shoes === 0 ? 'No shoes' : 'Only one pair of shoes'} for ${noun}, your main style: ${shoes === 0 ? 'a first' : 'a second'} pair would widen your combinations.`,
      );
    }
  }

  if (!ideas.length) {
    ideas.push(
      fr
        ? 'Continue de noter tes looks : plus VYRA en sait, plus ses conseils seront précis.'
        : 'Keep rating your looks: the more VYRA knows, the sharper its advice.',
    );
  }
  return ideas.slice(0, 3).map(capitalize);
}
