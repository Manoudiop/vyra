import { type ClothingCategory, type StyleColor } from '@vyra/shared';
import { type GarmentArt, renderGarment } from '../../../prisma/seed/garment-images';
import { analyzeFeatures, nameGarment } from './clothing-classifier';
import { extractFeatures } from './garment-vision';

// Product-style illustrations (garment on a plain backdrop) act as ground truth.
const CASES: [string, GarmentArt, ClothingCategory, StyleColor][] = [
  ['t-shirt', { shape: 'tshirt', colorHex: '#C9A45C' }, 'TOPS', 'gold'],
  ['white shirt on a light backdrop', { shape: 'shirt', colorHex: '#F5F2EA' }, 'TOPS', 'white'],
  ['sweater', { shape: 'sweater', colorHex: '#B98B5E' }, 'TOPS', 'camel'],
  ['coat', { shape: 'coat', colorHex: '#C9AE84' }, 'OUTERWEAR', 'beige'],
  ['black trousers', { shape: 'pants', colorHex: '#1C1C1C' }, 'BOTTOMS', 'black'],
  ['denim jeans', { shape: 'pants', colorHex: '#2F4A73', pattern: 'denim' }, 'BOTTOMS', 'navy'],
  ['shorts', { shape: 'shorts', colorHex: '#E7DECB' }, 'BOTTOMS', 'cream'],
  ['skirt', { shape: 'skirt', colorHex: '#B5573B' }, 'BOTTOMS', 'terracotta'],
  ['dress', { shape: 'dress', colorHex: '#1F5E4B' }, 'OTHER', 'green'],
  [
    'wax dress',
    { shape: 'dress', colorHex: '#1E3F8A', pattern: 'wax', accentHex: '#D9A441' },
    'TRADITIONAL',
    'blue',
  ],
  ['white sneakers', { shape: 'sneaker', colorHex: '#F7F6F2' }, 'SHOES', 'white'],
  ['loafers', { shape: 'shoe', colorHex: '#8A4F2A' }, 'SHOES', 'brown'],
  ['heels', { shape: 'heel', colorHex: '#C9A45C' }, 'SHOES', 'gold'],
  ['bag', { shape: 'bag', colorHex: '#A87545' }, 'ACCESSORIES', 'camel'],
  // The dial is the largest surface, so its color wins over the strap.
  ['watch', { shape: 'watch', colorHex: '#3B2F25', accentHex: '#E9DCC2' }, 'ACCESSORIES', 'cream'],
  ['ivory boubou', { shape: 'robe', colorHex: '#F1EADB' }, 'TRADITIONAL', 'cream'],
  ['burgundy t-shirt', { shape: 'tshirt', colorHex: '#7A2E3A' }, 'TOPS', 'burgundy'],
];

describe('mock clothing analysis', () => {
  it.each(CASES)('recognizes a %s', async (_label, art, category, color) => {
    const { image } = await renderGarment(art);
    const analysis = analyzeFeatures(await extractFeatures(image), 'fr');
    expect({ category: analysis.category, color: analysis.color }).toEqual({ category, color });
    expect(analysis.confidence.category).toBeGreaterThanOrEqual(0.6);
  });

  it('identifies traditional and patterned pieces with a traditional style', async () => {
    const { image } = await renderGarment({ shape: 'dress', colorHex: '#1E3F8A', pattern: 'wax' });
    const analysis = analyzeFeatures(await extractFeatures(image), 'fr');
    expect(analysis).toMatchObject({ name: 'Robe en wax', style: 'TRADITIONAL' });
  });

  it('is deterministic', async () => {
    const { image } = await renderGarment({ shape: 'pants', colorHex: '#1C1C1C' });
    const first = analyzeFeatures(await extractFeatures(image), 'fr');
    const second = analyzeFeatures(await extractFeatures(image), 'fr');
    expect(second).toEqual(first);
  });

  it('falls back with low confidence when nothing stands out from the backdrop', async () => {
    const sharp = (await import('sharp')).default;
    const blank = await sharp({
      create: { width: 400, height: 500, channels: 3, background: '#F2EFEA' },
    })
      .webp()
      .toBuffer();
    const analysis = analyzeFeatures(await extractFeatures(blank), 'fr');
    expect(analysis.confidence.category).toBeLessThan(0.5);
    expect(analysis.confidence.color).toBeLessThan(0.5);
  });
});

describe('garment naming', () => {
  it('agrees French adjectives in gender and number', () => {
    expect(nameGarment('dress', 'black', 'fr').name).toBe('Robe noire');
    expect(nameGarment('trousers', 'black', 'fr').name).toBe('Pantalon noir');
    expect(nameGarment('sneakers', 'white', 'fr').name).toBe('Baskets blanches');
    expect(nameGarment('heels', 'gold', 'fr').name).toBe('Sandales à talon dorées');
    expect(nameGarment('shoes', 'brown', 'fr').name).toBe('Chaussures marron');
    expect(nameGarment('jeans', 'navy', 'fr').name).toBe('Jean bleu marine');
    expect(nameGarment('skirt', 'burgundy', 'fr').name).toBe('Jupe bordeaux');
  });

  it('names in English when the profile locale is English', () => {
    expect(nameGarment('sneakers', 'white', 'en')).toEqual({
      name: 'White sneakers',
      subcategory: 'sneakers',
    });
  });
});
