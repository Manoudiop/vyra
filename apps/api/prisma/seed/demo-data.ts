import type {
  ClothingCategory,
  FeedbackRating,
  GenderPreference,
  Occasion,
  Plan,
  Role,
  Season,
  Style,
} from '../../src/generated/prisma/client';
import type { GarmentArt } from './garment-images';

export interface DemoItem {
  /** Stable handle used by outfits below; not stored. */
  ref: string;
  name: string;
  category: ClothingCategory;
  subcategory: string;
  color: string;
  style: Style;
  season: Season;
  art: GarmentArt;
  isFavorite?: boolean;
}

export interface DemoOutfit {
  name: string;
  occasion: Occasion;
  style: Style;
  reason: string;
  score: number;
  items: string[];
  isSaved?: boolean;
  rating?: FeedbackRating;
  /** Days ago the outfit was worn (one wear per entry). */
  wornDaysAgo?: number[];
  /** Days from today the outfit is planned in the calendar (negative = past). */
  plannedInDays?: { days: number; notes?: string; occasion?: Occasion }[];
}

export interface DemoUser {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  plan: Plan;
  profile: {
    genderPreference: GenderPreference;
    city: string;
    countryCode: string;
    timezone: string;
  };
  preferences: {
    colors: string[];
    styles: Style[];
    occasions: Occasion[];
    dislikedRefs?: string[];
  };
  items: DemoItem[];
  outfits: DemoOutfit[];
  /** Usage already consumed in the current period. */
  usage?: { outfitGenerations?: number; clothingAnalyses?: number };
}

const item = (
  ref: string,
  name: string,
  category: ClothingCategory,
  subcategory: string,
  color: string,
  style: Style,
  season: Season,
  art: GarmentArt,
  isFavorite = false,
): DemoItem => ({ ref, name, category, subcategory, color, style, season, art, isFavorite });

const amina: DemoUser = {
  email: 'amina@vyra.dev',
  firstName: 'Amina',
  lastName: 'Diallo',
  role: 'USER',
  plan: 'FREE',
  profile: {
    genderPreference: 'WOMEN',
    city: 'Dakar',
    countryCode: 'SN',
    timezone: 'Africa/Dakar',
  },
  preferences: {
    colors: ['beige', 'white', 'terracotta', 'gold'],
    styles: ['SMART_CASUAL', 'ELEGANT', 'TRADITIONAL'],
    occasions: ['WORK', 'DINNER', 'WEDDING'],
  },
  usage: { outfitGenerations: 2, clothingAnalyses: 6 },
  items: [
    item(
      'linen-shirt',
      'Chemise en lin blanche',
      'TOPS',
      'shirt',
      'white',
      'SMART_CASUAL',
      'SUMMER',
      { shape: 'shirt', colorHex: '#F5F2EA' },
      true,
    ),
    item(
      'silk-top',
      'Top en soie champagne',
      'TOPS',
      'blouse',
      'champagne',
      'ELEGANT',
      'ALL_SEASON',
      { shape: 'tshirt', colorHex: '#E6D3B3' },
    ),
    item('striped-tee', 'T-shirt marinière', 'TOPS', 't-shirt', 'navy', 'CASUAL', 'SUMMER', {
      shape: 'tshirt',
      colorHex: '#F4F1EA',
      pattern: 'stripes',
      accentHex: '#1F2A44',
    }),
    item('knit', 'Pull fin camel', 'TOPS', 'sweater', 'camel', 'SMART_CASUAL', 'AUTUMN', {
      shape: 'sweater',
      colorHex: '#B98B5E',
    }),
    item(
      'wide-pants',
      'Pantalon large beige',
      'BOTTOMS',
      'trousers',
      'beige',
      'SMART_CASUAL',
      'ALL_SEASON',
      { shape: 'pants', colorHex: '#D8C7AA' },
      true,
    ),
    item(
      'black-pants',
      'Pantalon noir taille haute',
      'BOTTOMS',
      'trousers',
      'black',
      'ELEGANT',
      'ALL_SEASON',
      { shape: 'pants', colorHex: '#1C1C1C' },
    ),
    item('jeans', 'Jean droit brut', 'BOTTOMS', 'jeans', 'indigo', 'CASUAL', 'ALL_SEASON', {
      shape: 'pants',
      colorHex: '#2F4A73',
      pattern: 'denim',
    }),
    item(
      'midi-skirt',
      'Jupe midi terracotta',
      'BOTTOMS',
      'skirt',
      'terracotta',
      'ELEGANT',
      'SUMMER',
      { shape: 'skirt', colorHex: '#B5573B' },
    ),
    item('slip-dress', 'Robe nuisette émeraude', 'OTHER', 'dress', 'emerald', 'ELEGANT', 'SUMMER', {
      shape: 'dress',
      colorHex: '#1F5E4B',
    }),
    item(
      'blazer',
      'Blazer crème',
      'OUTERWEAR',
      'blazer',
      'cream',
      'SMART_CASUAL',
      'ALL_SEASON',
      { shape: 'blazer', colorHex: '#EFE6D6' },
      true,
    ),
    item(
      'trench',
      'Trench classique',
      'OUTERWEAR',
      'trench coat',
      'sand',
      'SMART_CASUAL',
      'AUTUMN',
      { shape: 'coat', colorHex: '#C9AE84' },
    ),
    item(
      'boubou',
      'Grand boubou brodé or',
      'TRADITIONAL',
      'boubou',
      'ivory',
      'TRADITIONAL',
      'ALL_SEASON',
      { shape: 'robe', colorHex: '#F1EADB', accentHex: '#B79B72' },
      true,
    ),
    item(
      'wax-dress',
      'Robe en wax bleu et or',
      'TRADITIONAL',
      'wax dress',
      'blue',
      'TRADITIONAL',
      'SUMMER',
      { shape: 'dress', colorHex: '#1E3F8A', pattern: 'wax', accentHex: '#D9A441' },
    ),
    item(
      'kaftan',
      'Caftan terracotta',
      'TRADITIONAL',
      'kaftan',
      'terracotta',
      'TRADITIONAL',
      'ALL_SEASON',
      { shape: 'robe', colorHex: '#A9502F', accentHex: '#E8C98F' },
    ),
    item(
      'white-sneakers',
      'Baskets blanches',
      'SHOES',
      'sneakers',
      'white',
      'CASUAL',
      'ALL_SEASON',
      { shape: 'sneaker', colorHex: '#F7F6F2' },
    ),
    item(
      'loafers',
      'Mocassins cognac',
      'SHOES',
      'loafers',
      'cognac',
      'SMART_CASUAL',
      'ALL_SEASON',
      { shape: 'shoe', colorHex: '#8A4F2A' },
    ),
    item('gold-heels', 'Sandales à talon dorées', 'SHOES', 'heels', 'gold', 'ELEGANT', 'SUMMER', {
      shape: 'heel',
      colorHex: '#C9A45C',
    }),
    item(
      'tote',
      'Cabas en cuir camel',
      'ACCESSORIES',
      'bag',
      'camel',
      'SMART_CASUAL',
      'ALL_SEASON',
      { shape: 'bag', colorHex: '#A87545' },
    ),
    item('clutch', 'Pochette dorée', 'ACCESSORIES', 'bag', 'gold', 'ELEGANT', 'ALL_SEASON', {
      shape: 'bag',
      colorHex: '#CBA65E',
    }),
    item('watch', 'Montre dorée', 'ACCESSORIES', 'watch', 'gold', 'ELEGANT', 'ALL_SEASON', {
      shape: 'watch',
      colorHex: '#3B2F25',
      accentHex: '#E9DCC2',
    }),
  ],
  outfits: [
    {
      name: 'Lin et beige pour le bureau',
      occasion: 'WORK',
      style: 'SMART_CASUAL',
      reason:
        'La chemise en lin respire sous la chaleur de Dakar, le pantalon large garde une allure nette et les mocassins cognac réchauffent les tons neutres. Le blazer crème se pose sur les épaules pour les réunions climatisées.',
      score: 0.91,
      items: ['linen-shirt', 'wide-pants', 'blazer', 'loafers', 'tote'],
      isSaved: true,
      rating: 'LOVE',
      wornDaysAgo: [9, 2],
      plannedInDays: [{ days: -2 }, { days: 3, notes: 'Présentation client' }],
    },
    {
      name: 'Dîner émeraude et or',
      occasion: 'DINNER',
      style: 'ELEGANT',
      reason:
        'L’émeraude de la robe nuisette ressort avec les accessoires dorés ; les sandales à talon allongent la silhouette sans en faire trop.',
      score: 0.88,
      items: ['slip-dress', 'gold-heels', 'clutch', 'watch'],
      isSaved: true,
      rating: 'LOVE',
      wornDaysAgo: [6],
      plannedInDays: [{ days: -6, occasion: 'DINNER' }],
    },
    {
      name: 'Mariage en boubou brodé',
      occasion: 'WEDDING',
      style: 'TRADITIONAL',
      reason:
        'Le grand boubou ivoire aux broderies or est une valeur sûre pour une cérémonie ; la pochette et les sandales dorées reprennent les broderies.',
      score: 0.94,
      items: ['boubou', 'gold-heels', 'clutch'],
      isSaved: true,
      plannedInDays: [{ days: 5, notes: 'Mariage de Fatou', occasion: 'WEDDING' }],
    },
    {
      name: 'Week-end marinière',
      occasion: 'CASUAL',
      style: 'CASUAL',
      reason:
        'Un classique décontracté : marinière, jean brut et baskets blanches, avec le cabas pour la journée.',
      score: 0.79,
      items: ['striped-tee', 'jeans', 'white-sneakers', 'tote'],
      wornDaysAgo: [13],
    },
    {
      name: 'Terracotta du soir',
      occasion: 'PARTY',
      style: 'ELEGANT',
      reason: 'Le top champagne adoucit la jupe terracotta ; les accessoires dorés font le lien.',
      score: 0.72,
      items: ['silk-top', 'midi-skirt', 'gold-heels', 'clutch'],
      rating: 'DISLIKE',
    },
    {
      name: 'Wax pour la Tabaski',
      occasion: 'TRADITIONAL',
      style: 'TRADITIONAL',
      reason:
        'La robe en wax bleu et or se suffit à elle-même ; la montre dorée prolonge les motifs.',
      score: 0.86,
      items: ['wax-dress', 'gold-heels', 'watch'],
      isSaved: true,
      rating: 'LOVE',
      wornDaysAgo: [20],
    },
  ],
};

const karim: DemoUser = {
  email: 'karim@vyra.dev',
  firstName: 'Karim',
  lastName: 'Kouassi',
  role: 'USER',
  plan: 'PRO',
  profile: {
    genderPreference: 'MEN',
    city: 'Abidjan',
    countryCode: 'CI',
    timezone: 'Africa/Abidjan',
  },
  preferences: {
    colors: ['black', 'navy', 'olive', 'white'],
    styles: ['STREETWEAR', 'CASUAL', 'SMART_CASUAL'],
    occasions: ['WORK', 'CASUAL', 'PARTY'],
    dislikedRefs: ['red-shirt'],
  },
  usage: { outfitGenerations: 3, clothingAnalyses: 4 },
  items: [
    item(
      'white-tee',
      'T-shirt blanc épais',
      'TOPS',
      't-shirt',
      'white',
      'CASUAL',
      'ALL_SEASON',
      { shape: 'tshirt', colorHex: '#F6F5F1' },
      true,
    ),
    item(
      'black-tee',
      'T-shirt noir oversize',
      'TOPS',
      't-shirt',
      'black',
      'STREETWEAR',
      'ALL_SEASON',
      { shape: 'tshirt', colorHex: '#161616' },
    ),
    item(
      'oxford',
      'Chemise oxford bleu ciel',
      'TOPS',
      'shirt',
      'light blue',
      'SMART_CASUAL',
      'ALL_SEASON',
      { shape: 'shirt', colorHex: '#A9C3DE' },
    ),
    item('red-shirt', 'Chemise rouge à motifs', 'TOPS', 'shirt', 'red', 'CASUAL', 'SUMMER', {
      shape: 'shirt',
      colorHex: '#A3302B',
      pattern: 'stripes',
      accentHex: '#D46A5A',
    }),
    item(
      'olive-overshirt',
      'Surchemise olive',
      'OUTERWEAR',
      'overshirt',
      'olive',
      'STREETWEAR',
      'AUTUMN',
      { shape: 'shirt', colorHex: '#5E6B45' },
      true,
    ),
    item(
      'navy-blazer',
      'Blazer marine',
      'OUTERWEAR',
      'blazer',
      'navy',
      'SMART_CASUAL',
      'ALL_SEASON',
      { shape: 'blazer', colorHex: '#1F2A44' },
    ),
    item('bomber', 'Bomber noir', 'OUTERWEAR', 'bomber jacket', 'black', 'STREETWEAR', 'AUTUMN', {
      shape: 'coat',
      colorHex: '#202020',
    }),
    item('chinos', 'Chino beige', 'BOTTOMS', 'chinos', 'beige', 'SMART_CASUAL', 'ALL_SEASON', {
      shape: 'pants',
      colorHex: '#CDB892',
    }),
    item('black-jeans', 'Jean noir slim', 'BOTTOMS', 'jeans', 'black', 'STREETWEAR', 'ALL_SEASON', {
      shape: 'pants',
      colorHex: '#232323',
      pattern: 'denim',
    }),
    item('cargo', 'Cargo kaki', 'BOTTOMS', 'cargo pants', 'khaki', 'STREETWEAR', 'ALL_SEASON', {
      shape: 'pants',
      colorHex: '#7A7253',
    }),
    item('shorts', 'Short en lin écru', 'BOTTOMS', 'shorts', 'ecru', 'CASUAL', 'SUMMER', {
      shape: 'shorts',
      colorHex: '#E7DECB',
    }),
    item(
      'navy-trousers',
      'Pantalon de costume marine',
      'BOTTOMS',
      'trousers',
      'navy',
      'FORMAL',
      'ALL_SEASON',
      { shape: 'pants', colorHex: '#1E2740' },
    ),
    item(
      'agbada',
      'Agbada bleu nuit brodé',
      'TRADITIONAL',
      'agbada',
      'midnight blue',
      'TRADITIONAL',
      'ALL_SEASON',
      { shape: 'robe', colorHex: '#1B2340', accentHex: '#C9A45C' },
      true,
    ),
    item(
      'dashiki',
      'Chemise dashiki',
      'TRADITIONAL',
      'dashiki',
      'orange',
      'TRADITIONAL',
      'SUMMER',
      { shape: 'tshirt', colorHex: '#C8641E', pattern: 'wax', accentHex: '#1E1E1E' },
    ),
    item(
      'white-sneakers',
      'Baskets cuir blanches',
      'SHOES',
      'sneakers',
      'white',
      'CASUAL',
      'ALL_SEASON',
      { shape: 'sneaker', colorHex: '#F5F4F0' },
      true,
    ),
    item(
      'black-sneakers',
      'Baskets noires montantes',
      'SHOES',
      'sneakers',
      'black',
      'STREETWEAR',
      'ALL_SEASON',
      { shape: 'sneaker', colorHex: '#1A1A1A' },
    ),
    item('derbies', 'Derbies marron', 'SHOES', 'derbies', 'brown', 'FORMAL', 'ALL_SEASON', {
      shape: 'shoe',
      colorHex: '#5A3A22',
    }),
    item('watch', 'Montre acier', 'ACCESSORIES', 'watch', 'silver', 'SMART_CASUAL', 'ALL_SEASON', {
      shape: 'watch',
      colorHex: '#3C3F44',
      accentHex: '#1F2A44',
    }),
  ],
  outfits: [
    {
      name: 'Streetwear noir et olive',
      occasion: 'CASUAL',
      style: 'STREETWEAR',
      reason:
        'Le T-shirt noir oversize et le jean noir donnent une base nette ; la surchemise olive apporte de la matière et les baskets montantes terminent la silhouette.',
      score: 0.9,
      items: ['black-tee', 'olive-overshirt', 'black-jeans', 'black-sneakers'],
      isSaved: true,
      rating: 'LOVE',
      wornDaysAgo: [1, 8],
      plannedInDays: [{ days: -1 }],
    },
    {
      name: 'Bureau en oxford et chino',
      occasion: 'WORK',
      style: 'SMART_CASUAL',
      reason:
        'Oxford bleu ciel, chino beige et blazer marine : le trio smart casual qui fonctionne partout, adouci par les baskets blanches pour un vendredi.',
      score: 0.87,
      items: ['oxford', 'chinos', 'navy-blazer', 'white-sneakers', 'watch'],
      isSaved: true,
      wornDaysAgo: [4],
      plannedInDays: [{ days: 1, notes: 'Réunion équipe' }],
    },
    {
      name: 'Cérémonie en agbada',
      occasion: 'WEDDING',
      style: 'TRADITIONAL',
      reason:
        'L’agbada bleu nuit brodé or s’impose pour un mariage ; les derbies marron restent sobres.',
      score: 0.93,
      items: ['agbada', 'derbies'],
      isSaved: true,
      rating: 'LOVE',
      plannedInDays: [{ days: 6, notes: 'Mariage à Grand-Bassam', occasion: 'WEDDING' }],
    },
    {
      name: 'Soirée bomber',
      occasion: 'PARTY',
      style: 'STREETWEAR',
      reason:
        'Bomber noir sur T-shirt blanc, cargo kaki et baskets noires : contraste simple et efficace.',
      score: 0.81,
      items: ['white-tee', 'bomber', 'cargo', 'black-sneakers'],
      wornDaysAgo: [11],
    },
    {
      name: 'Plage à Assinie',
      occasion: 'TRAVEL',
      style: 'CASUAL',
      reason: 'Chemise à motifs et short en lin pour la chaleur, baskets blanches pour marcher.',
      score: 0.64,
      items: ['red-shirt', 'shorts', 'white-sneakers'],
      rating: 'DISLIKE',
    },
    {
      name: 'Costume marine',
      occasion: 'WORK',
      style: 'FORMAL',
      reason:
        'Blazer et pantalon marine avec une oxford claire et des derbies : formel sans rigidité.',
      score: 0.85,
      items: ['oxford', 'navy-blazer', 'navy-trousers', 'derbies', 'watch'],
      wornDaysAgo: [15],
    },
  ],
};

const admin: DemoUser = {
  email: 'admin@vyra.dev',
  firstName: 'Admin',
  lastName: 'VYRA',
  role: 'ADMIN',
  plan: 'FREE',
  profile: {
    genderPreference: 'UNISEX',
    city: 'Dakar',
    countryCode: 'SN',
    timezone: 'Africa/Dakar',
  },
  preferences: { colors: [], styles: [], occasions: [] },
  items: [],
  outfits: [],
};

export const DEMO_USERS: DemoUser[] = [amina, karim, admin];
