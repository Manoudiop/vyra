import { describe, expect, it } from 'vitest';
import { closetQuerySchema, createClothingItemSchema, updateClothingItemSchema } from './closet';

describe('closet schemas', () => {
  it('defaults season and favorite on create and normalizes hex colors', () => {
    const parsed = createClothingItemSchema.parse({
      name: ' Chemise en lin ',
      category: 'TOPS',
      color: 'white',
      colorHex: '#f5f2ea',
      imageKey: 'users/u1/clothing/a.webp',
    });
    expect(parsed).toMatchObject({
      name: 'Chemise en lin',
      season: 'ALL_SEASON',
      isFavorite: false,
      colorHex: '#F5F2EA',
    });
  });

  it('only accepts colors from the shared vocabulary', () => {
    expect(updateClothingItemSchema.safeParse({ color: 'navy' }).success).toBe(true);
    expect(updateClothingItemSchema.safeParse({ color: 'midnight blue' }).success).toBe(false);
    expect(updateClothingItemSchema.safeParse({}).success).toBe(false);
  });

  it('parses list query strings', () => {
    expect(closetQuerySchema.parse({ favorite: 'true', limit: '10' })).toMatchObject({
      favorite: true,
      limit: 10,
    });
    expect(closetQuerySchema.parse({}).limit).toBe(24);
    expect(closetQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
    expect(closetQuerySchema.safeParse({ cursor: 'not-a-uuid' }).success).toBe(false);
  });
});
