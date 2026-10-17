import { type AIClothingItem } from '../ai.provider';
import { explainOutfit, outfitName } from './stylist-copy';

const piece = (
  id: string,
  name: string,
  category: AIClothingItem['category'],
  color: string,
): AIClothingItem => ({
  id,
  name,
  category,
  subcategory: null,
  color,
  style: null,
  season: 'ALL_SEASON',
});

const look = [
  piece('a', 'Chemise en lin', 'TOPS', 'white'),
  piece('b', 'Jupe terracotta', 'BOTTOMS', 'terracotta'),
  piece('c', 'Sandales dorées', 'SHOES', 'gold'),
  piece('d', 'Pochette', 'ACCESSORIES', 'gold'),
];

describe('stylist copy', () => {
  it('builds a factual French explanation of the actual pieces', () => {
    const text = explainOutfit({
      items: look,
      occasion: 'DINNER',
      style: 'ELEGANT',
      weather: null,
      locale: 'fr',
    });
    expect(text).toContain('« Chemise en lin »');
    expect(text).toContain('« Jupe terracotta »');
    expect(text).toContain('terracotta apporte la touche de couleur');
    expect(text).toContain('« Sandales dorées » terminent la silhouette');
    expect(text).toContain('« Pochette » ajoute la finition');
  });

  it('mentions rotation, favourite colors and weather when relevant', () => {
    const fresh = explainOutfit({
      items: look,
      occasion: 'DINNER',
      style: 'ELEGANT',
      weather: null,
      recentlyWornIds: [],
      locale: 'fr',
    });
    expect(fresh).toContain('n’a été portée cette semaine');

    const favourite = explainOutfit({
      items: look,
      occasion: 'DINNER',
      style: 'ELEGANT',
      weather: { temperatureC: 31, condition: 'sunny', rainProbability: 0.1 },
      recentlyWornIds: ['a'],
      preferredColors: ['terracotta'],
      locale: 'fr',
    });
    expect(favourite).toContain('31 °C');
    expect(favourite).toContain('l’une de tes couleurs');
  });

  it('names looks after the accent color, or by occasion when all neutral', () => {
    expect(outfitName(look, 'DINNER', 'fr')).toMatch(/terracotta/);
    const neutral = [
      piece('x', 'Chemise', 'TOPS', 'white'),
      piece('y', 'Chino', 'BOTTOMS', 'beige'),
    ];
    expect(outfitName(neutral, 'WORK', 'fr')).not.toContain('{c}');
    expect(outfitName(look, 'DINNER', 'fr')).toBe(outfitName(look, 'DINNER', 'fr'));
  });

  it('writes correct French grammar (elision, plural shoes)', () => {
    const olive = [
      piece('o1', 'Cargo kaki', 'BOTTOMS', 'olive'),
      piece('o2', 'T-shirt noir', 'TOPS', 'black'),
      piece('o3', 'Derbies marron', 'SHOES', 'brown'),
      piece('o4', 'Mocassin cognac', 'SHOES', 'brown'),
    ];
    const text = explainOutfit({
      items: olive.slice(0, 3),
      occasion: 'PARTY',
      style: 'STREETWEAR',
      weather: null,
      preferredColors: ['olive'],
      locale: 'fr',
    });
    expect(text).toContain('L’olive apporte la touche de couleur');
    expect(text).toContain('Et l’olive, c’est l’une de tes couleurs.');
    expect(text).toContain('« Derbies marron » terminent la silhouette');
    expect(text).not.toMatch(/\b[Ll]e olive\b/);

    const single = explainOutfit({
      items: [olive[1]!, olive[0]!, olive[3]!],
      occasion: 'CASUAL',
      style: 'CASUAL',
      weather: null,
      locale: 'fr',
    });
    expect(single).toContain('« Mocassin cognac » termine la silhouette');
  });

  it('speaks English when asked', () => {
    const text = explainOutfit({
      items: look,
      occasion: 'WORK',
      style: 'SMART_CASUAL',
      weather: null,
      locale: 'en',
    });
    expect(text).toContain('the office');
    expect(outfitName(look, 'WORK', 'en')).toMatch(/terracotta/i);
  });
});
