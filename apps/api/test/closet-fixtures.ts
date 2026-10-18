import { type INestApplication } from '@nestjs/common';
import { type ClothingCategory, type Season, type Style } from '../src/generated/prisma/enums';
import { type PrismaService } from '../src/prisma/prisma.service';
import { registerTestUser, type TestUser } from './helpers';

interface PieceSpec {
  name: string;
  category: ClothingCategory;
  subcategory: string;
  color: string;
  style: Style;
  season?: Season;
}

export const MEN_CLOSET: PieceSpec[] = [
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

/** A small dinner wardrobe: the shoes are the weather question. */
export const DINNER_CLOSET: PieceSpec[] = [
  {
    name: 'Top en soie champagne',
    category: 'TOPS',
    subcategory: 'blouse',
    color: 'cream',
    style: 'ELEGANT',
  },
  {
    name: 'Pantalon noir taille haute',
    category: 'BOTTOMS',
    subcategory: 'trousers',
    color: 'black',
    style: 'ELEGANT',
  },
  {
    name: 'Sandales à talon dorées',
    category: 'SHOES',
    subcategory: 'heels',
    color: 'gold',
    style: 'ELEGANT',
    season: 'SUMMER',
  },
  {
    name: 'Mocassins cognac',
    category: 'SHOES',
    subcategory: 'loafers',
    color: 'brown',
    style: 'SMART_CASUAL',
  },
  {
    name: 'Trench classique',
    category: 'OUTERWEAR',
    subcategory: 'trench coat',
    color: 'beige',
    style: 'SMART_CASUAL',
    season: 'AUTUMN',
  },
];

/** Registers a user and fills their closet; returns the piece ids by name. */
export async function withCloset(
  app: INestApplication,
  prisma: PrismaService,
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
