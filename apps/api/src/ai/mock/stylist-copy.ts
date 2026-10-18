import { type Occasion, type Style } from '@vyra/shared';
import { type AIClothingItem, type WeatherContext } from '../ai.provider';

/**
 * Template-based stylist copy for the mock provider. Every sentence is built
 * from facts about the actual outfit (pieces, colors, layers, freshness), and
 * phrasing varies with the outfit so repeated looks do not read the same.
 */

export type Locale = 'fr' | 'en';
export const pickLocale = (locale: string): Locale => (locale.startsWith('en') ? 'en' : 'fr');

export const NEUTRALS = new Set([
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

export const COLOR_NOUNS: Record<Locale, Record<string, string>> = {
  fr: {
    black: 'noir',
    white: 'blanc',
    cream: 'crème',
    beige: 'beige',
    camel: 'camel',
    brown: 'marron',
    grey: 'gris',
    navy: 'bleu marine',
    blue: 'bleu',
    green: 'vert',
    olive: 'olive',
    red: 'rouge',
    terracotta: 'terracotta',
    pink: 'rose',
    yellow: 'jaune',
    gold: 'doré',
    burgundy: 'bordeaux',
    orange: 'orange',
    purple: 'violet',
    silver: 'argent',
  },
  en: {
    black: 'black',
    white: 'white',
    cream: 'cream',
    beige: 'beige',
    camel: 'camel',
    brown: 'brown',
    grey: 'grey',
    navy: 'navy',
    blue: 'blue',
    green: 'green',
    olive: 'olive',
    red: 'red',
    terracotta: 'terracotta',
    pink: 'pink',
    yellow: 'yellow',
    gold: 'gold',
    burgundy: 'burgundy',
    orange: 'orange',
    purple: 'purple',
    silver: 'silver',
  },
};

export const OCCASION_PHRASE: Record<Locale, Record<Occasion, string>> = {
  fr: {
    WORK: 'le bureau',
    DATE: 'ce rendez-vous',
    DINNER: 'ce dîner',
    PARTY: 'la soirée',
    WEDDING: 'la cérémonie',
    TRAVEL: 'le voyage',
    CASUAL: 'une journée tranquille',
    WORKOUT: 'ta séance',
    TRADITIONAL: 'cette occasion',
    SURPRISE: 'aujourd’hui',
  },
  en: {
    WORK: 'the office',
    DATE: 'this date',
    DINNER: 'this dinner',
    PARTY: 'the party',
    WEDDING: 'the ceremony',
    TRAVEL: 'the trip',
    CASUAL: 'an easy day',
    WORKOUT: 'your workout',
    TRADITIONAL: 'this occasion',
    SURPRISE: 'today',
  },
};

const STYLE_WORD: Record<Locale, Record<Style, string>> = {
  fr: {
    CASUAL: 'décontractée',
    SMART_CASUAL: 'smart casual',
    ELEGANT: 'élégante',
    STREETWEAR: 'streetwear',
    FORMAL: 'formelle',
    SPORT: 'sportive',
    TRADITIONAL: 'traditionnelle',
  },
  en: {
    CASUAL: 'relaxed',
    SMART_CASUAL: 'smart-casual',
    ELEGANT: 'elegant',
    STREETWEAR: 'streetwear',
    FORMAL: 'formal',
    SPORT: 'sporty',
    TRADITIONAL: 'traditional',
  },
};

const NAMES: Record<Locale, Record<Occasion, [withColor: string, plain: string][]>> = {
  fr: {
    WORK: [
      ['Bureau en {c}', 'Bureau impeccable'],
      ['Réunion en {c}', 'Smart au bureau'],
    ],
    DATE: [
      ['Rendez-vous en {c}', 'Rendez-vous chic'],
      ['Soirée à deux en {c}', 'Charme discret'],
    ],
    DINNER: [
      ['Dîner en {c}', 'Dîner chic'],
      ['Table pour deux en {c}', 'Soirée dîner'],
    ],
    PARTY: [
      ['Soirée en {c}', 'Prêt pour la fête'],
      ['Fête en {c}', 'Nuit élégante'],
    ],
    WEDDING: [
      ['Cérémonie en {c}', 'Invité d’honneur'],
      ['Mariage en {c}', 'Grande occasion'],
    ],
    TRAVEL: [
      ['Voyage en {c}', 'Escale confort'],
      ['En route en {c}', 'Bagage léger'],
    ],
    CASUAL: [
      ['Week-end en {c}', 'Décontracté chic'],
      ['Journée en {c}', 'Simple et juste'],
    ],
    WORKOUT: [
      ['Séance en {c}', 'Prêt à bouger'],
      ['Sport en {c}', 'Énergie du jour'],
    ],
    TRADITIONAL: [
      ['Tradition en {c}', 'Élégance traditionnelle'],
      ['Héritage en {c}', 'Beauté des racines'],
    ],
    SURPRISE: [
      ['Surprise en {c}', 'Coup de cœur du jour'],
      ['Audace en {c}', 'Le look inattendu'],
    ],
  },
  en: {
    WORK: [
      ['Office in {c}', 'Polished at work'],
      ['Meeting in {c}', 'Smart office look'],
    ],
    DATE: [
      ['Date night in {c}', 'Effortless date'],
      ['Evening in {c}', 'Quiet charm'],
    ],
    DINNER: [
      ['Dinner in {c}', 'Dinner chic'],
      ['Table for two in {c}', 'Dinner ready'],
    ],
    PARTY: [
      ['Party in {c}', 'Party ready'],
      ['Night out in {c}', 'Elegant night'],
    ],
    WEDDING: [
      ['Ceremony in {c}', 'Guest of honour'],
      ['Wedding in {c}', 'Big occasion'],
    ],
    TRAVEL: [
      ['Travel in {c}', 'Comfortable journey'],
      ['On the move in {c}', 'Travel light'],
    ],
    CASUAL: [
      ['Weekend in {c}', 'Relaxed chic'],
      ['Day in {c}', 'Simple and right'],
    ],
    WORKOUT: [
      ['Workout in {c}', 'Ready to move'],
      ['Training in {c}', 'Daily energy'],
    ],
    TRADITIONAL: [
      ['Tradition in {c}', 'Traditional elegance'],
      ['Heritage in {c}', 'Rooted beauty'],
    ],
    SURPRISE: [
      ['Surprise in {c}', 'Today’s favourite'],
      ['Bold in {c}', 'The unexpected look'],
    ],
  },
};

/** Stable small hash so the same outfit always gets the same wording. */
function hash(text: string): number {
  let value = 7;
  for (let i = 0; i < text.length; i += 1) value = (value * 31 + text.charCodeAt(i)) >>> 0;
  return value;
}

const choose = <T>(options: T[], seed: number): T => options[seed % options.length]!;

/** French definite article with elision: « le bleu », « l’olive ». */
export const leFr = (word: string) =>
  /^[aeiouyhéèêàâîôû]/i.test(word) ? `l’${word}` : `le ${word}`;

/** Plural garment names start with a plural noun: « Derbies marron », « Baskets blanches ». */
const isPluralName = (name: string) => /[sx]$/i.test(name.trim().split(/\s+/)[0] ?? '');
const quote = (locale: Locale, name: string) => (locale === 'fr' ? `« ${name} »` : `“${name}”`);

function accentColors(items: AIClothingItem[]): string[] {
  return [
    ...new Set(
      items
        .filter((item) => item.category !== 'ACCESSORIES')
        .map((item) => item.color)
        .filter((color) => !NEUTRALS.has(color)),
    ),
  ];
}

export function outfitName(
  items: AIClothingItem[],
  occasion: Occasion,
  localeInput: string,
): string {
  const locale = pickLocale(localeInput);
  const seed = hash(items.map((item) => item.id).join());
  const [withColor, plain] = choose(NAMES[locale][occasion], seed);
  const accent = accentColors(items)[0];
  return accent ? withColor.replace('{c}', COLOR_NOUNS[locale][accent] ?? accent) : plain;
}

export interface ExplanationFacts {
  items: AIClothingItem[];
  occasion: Occasion;
  style: Style;
  weather: WeatherContext | null;
  /** Items worn in the last 7 days, if known. */
  recentlyWornIds?: string[];
  preferredColors?: string[];
  locale: string;
}

export function explainOutfit(facts: ExplanationFacts): string {
  const locale = pickLocale(facts.locale);
  const { items } = facts;
  const seed = hash(items.map((item) => item.id).join() + facts.occasion);
  const q = (item: AIClothingItem) => quote(locale, item.name);

  const anchor =
    items.find((item) => item.category === 'TRADITIONAL') ??
    items.find((item) => item.category === 'OTHER') ??
    items.find((item) => item.category === 'TOPS') ??
    items[0]!;
  const bottom = items.find((item) => item.category === 'BOTTOMS');
  const shoes = items.find((item) => item.category === 'SHOES');
  const outer = items.find((item) => item.category === 'OUTERWEAR');
  const accessory = items.find((item) => item.category === 'ACCESSORIES');
  const accents = accentColors(items);
  const occasion = OCCASION_PHRASE[locale][facts.occasion];
  const style = STYLE_WORD[locale][facts.style];
  const sentences: string[] = [];

  // 1. The idea of the look.
  if (locale === 'fr') {
    sentences.push(
      bottom
        ? choose(
            [
              `Pour ${occasion}, ${q(anchor)} et ${q(bottom)} posent une base ${style}, nette et facile à porter.`,
              `${q(anchor)} associé à ${q(bottom)} : l’allure ${style} qu’il faut pour ${occasion}.`,
            ],
            seed,
          )
        : choose(
            [
              `Pour ${occasion}, ${q(anchor)} fait tout le travail : une pièce forte, à l’allure ${style}.`,
              `${q(anchor)} suffit à signer une tenue ${style} pour ${occasion}.`,
            ],
            seed,
          ),
    );
  } else {
    sentences.push(
      bottom
        ? choose(
            [
              `For ${occasion}, ${q(anchor)} with ${q(bottom)} sets a clean, ${style} base.`,
              `${q(anchor)} paired with ${q(bottom)}: the ${style} feel ${occasion} calls for.`,
            ],
            seed,
          )
        : choose(
            [
              `For ${occasion}, ${q(anchor)} does all the work: one strong, ${style} piece.`,
              `${q(anchor)} alone makes a ${style} statement for ${occasion}.`,
            ],
            seed,
          ),
    );
  }

  // 2. Colors.
  const accent = accents[0];
  const accentWord = accent ? (COLOR_NOUNS[locale][accent] ?? accent) : '';
  if (locale === 'fr') {
    sentences.push(
      accents.length === 0
        ? 'Une palette de neutres, sobre et toujours juste.'
        : accents.length === 1
          ? `${capitalize(leFr(accentWord))} apporte la touche de couleur, les neutres autour le mettent en valeur.`
          : 'Les couleurs se répondent sans se faire concurrence.',
    );
  } else {
    sentences.push(
      accents.length === 0
        ? 'A neutral palette: understated and always right.'
        : accents.length === 1
          ? `The ${accentWord} brings the colour; the neutrals around it let it shine.`
          : 'The colours echo each other without competing.',
    );
  }

  // 3. Finishing pieces.
  const finish: string[] = [];
  if (locale === 'fr') {
    if (outer) finish.push(`${q(outer)} structure l’ensemble`);
    if (shoes)
      finish.push(`${q(shoes)} termine${isPluralName(shoes.name) ? 'nt' : ''} la silhouette`);
    if (accessory) finish.push(`${q(accessory)} ajoute la finition`);
    if (finish.length) sentences.push(`${capitalize(joinFr(finish))}.`);
  } else {
    if (outer) finish.push(`${q(outer)} adds structure`);
    if (shoes) finish.push(`${q(shoes)} finish the silhouette`);
    if (accessory) finish.push(`${q(accessory)} adds the final touch`);
    if (finish.length) sentences.push(`${capitalize(joinEn(finish))}.`);
  }

  // 4. Weather (phase 13 provides it).
  if (facts.weather) {
    const { temperatureC, rainProbability } = facts.weather;
    if (locale === 'fr') {
      sentences.push(
        rainProbability >= 0.5
          ? `Avec ${Math.round(rainProbability * 100)} % de risque de pluie, prévois de quoi te couvrir.`
          : `Pensé pour les ${Math.round(temperatureC)} °C prévus.`,
      );
    } else {
      sentences.push(
        rainProbability >= 0.5
          ? `With a ${Math.round(rainProbability * 100)}% chance of rain, keep a layer handy.`
          : `Made for the ${Math.round(temperatureC)}°C forecast.`,
      );
    }
  }

  // 5. Personal touch: rotation and favourite colors.
  const worn = new Set(facts.recentlyWornIds ?? []);
  if (facts.recentlyWornIds && items.every((item) => !worn.has(item.id))) {
    sentences.push(
      locale === 'fr'
        ? 'Aucune de ces pièces n’a été portée cette semaine : ton dressing tourne.'
        : 'None of these pieces was worn this week: your closet keeps rotating.',
    );
  } else if (accent && facts.preferredColors?.includes(accent)) {
    sentences.push(
      locale === 'fr'
        ? `Et ${leFr(accentWord)}, c’est l’une de tes couleurs.`
        : `And ${accentWord} is one of your colours.`,
    );
  }

  return sentences.join(' ');
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
export function joinFr(parts: string[]): string {
  return parts.length <= 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} et ${parts.at(-1)}`;
}
export function joinEn(parts: string[]): string {
  return parts.length <= 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}
