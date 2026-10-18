import { type AIClothingItem, type AnalyzeStyleInput } from '../ai.provider';
import { analyzeStyleFromFacts } from './style-analysis';

let counter = 0;
const piece = (overrides: Partial<AIClothingItem>): AIClothingItem => ({
  id: `p${(counter += 1)}`,
  name: 'Pièce',
  category: 'TOPS',
  subcategory: null,
  color: 'white',
  style: 'SMART_CASUAL',
  season: 'ALL_SEASON',
  ...overrides,
});

const oxford = piece({ name: 'Chemise oxford', color: 'blue' });
const chinos = piece({ name: 'Chino beige', category: 'BOTTOMS', color: 'beige' });
const derbies = piece({ name: 'Derbies', category: 'SHOES', color: 'brown', style: 'FORMAL' });
const agbada = piece({
  name: 'Agbada',
  category: 'TRADITIONAL',
  color: 'navy',
  style: 'TRADITIONAL',
});
const redTee = piece({ name: 'T-shirt rouge', color: 'red', style: 'STREETWEAR' });
const redCap = piece({
  name: 'Casquette rouge',
  category: 'ACCESSORIES',
  color: 'red',
  style: 'STREETWEAR',
});

const input = (overrides: Partial<AnalyzeStyleInput> = {}): AnalyzeStyleInput => ({
  preferredStyles: [],
  preferredColors: [],
  closet: [oxford, chinos, derbies, agbada, redTee, redCap],
  lovedOutfits: [],
  dislikedOutfits: [],
  wornOutfits: [],
  learned: { colors: [], avoidedColors: [], styles: [], occasionStyles: [] },
  locale: 'fr',
  ...overrides,
});

describe('analyzeStyleFromFacts', () => {
  it('describes the learned style, palette, occasion habits and aversions', () => {
    const analysis = analyzeStyleFromFacts(
      input({
        learned: {
          styles: [
            { value: 'SMART_CASUAL', weight: 0.7 },
            { value: 'TRADITIONAL', weight: 0.4 },
          ],
          colors: [
            { value: 'navy', weight: 0.6 },
            { value: 'beige', weight: 0.5 },
            { value: 'olive', weight: 0.3 },
          ],
          avoidedColors: [{ value: 'red', weight: -0.6 }],
          occasionStyles: [
            { occasion: 'WORK', style: 'SMART_CASUAL' },
            { occasion: 'WEDDING', style: 'TRADITIONAL' },
          ],
        },
      }),
    );
    expect(analysis.dominantStyles).toEqual(['SMART_CASUAL', 'TRADITIONAL']);
    expect(analysis.signatureColors).toEqual(['navy', 'beige', 'olive']);
    expect(analysis.summary).toContain('le smart casual et le traditionnel');
    expect(analysis.summary).toContain('une base de bleu marine et beige relevée d’olive');
    // The habit matching the main style is not repeated; the other is.
    expect(analysis.summary).toContain('Pour la cérémonie, tu passes au traditionnel.');
    expect(analysis.summary).not.toContain('Pour le bureau');
    expect(analysis.summary).toContain('Tu écartes souvent le rouge.');
    // Two red pieces in the closet while red is turned down.
    expect(analysis.suggestions.some((text) => text.includes('2 pièces'))).toBe(true);
  });

  it('spots a piece carrying most worn looks and a lack of shoes', () => {
    const worn = [[oxford, chinos, derbies], [oxford, chinos], [agbada], [oxford, chinos, derbies]];
    const analysis = analyzeStyleFromFacts(
      input({
        wornOutfits: worn,
        learned: {
          styles: [{ value: 'SMART_CASUAL', weight: 0.7 }],
          colors: [],
          avoidedColors: [],
          occasionStyles: [],
        },
      }),
    );
    expect(analysis.suggestions[0]).toContain('« Chemise oxford » revient dans 3 de tes 4');
    // The derbies are FORMAL: no smart-casual shoes at all.
    expect(analysis.suggestions.some((text) => text.startsWith('Aucune paire'))).toBe(true);
  });

  it('suggests an accent for an all-neutral palette, avoiding rejected colors', () => {
    const analysis = analyzeStyleFromFacts(
      input({
        learned: {
          styles: [],
          colors: [
            { value: 'black', weight: 0.6 },
            { value: 'white', weight: 0.5 },
          ],
          avoidedColors: [{ value: 'terracotta', weight: -0.5 }],
          occasionStyles: [],
        },
      }),
    );
    const accent = analysis.suggestions.find((text) => text.includes('très neutre'));
    expect(accent).toContain('olive');
    expect(accent).not.toContain('terracotta');
  });

  it('writes English too', () => {
    const analysis = analyzeStyleFromFacts(
      input({
        locale: 'en',
        learned: {
          styles: [{ value: 'TRADITIONAL', weight: 0.8 }],
          colors: [{ value: 'gold', weight: 0.5 }],
          avoidedColors: [],
          occasionStyles: [{ occasion: 'WORK', style: 'SMART_CASUAL' }],
        },
      }),
    );
    expect(analysis.summary).toBe(
      'Your style leans towards traditional, with a palette of gold. For the office, you go smart casual.',
    );
  });

  it('falls back to declared preferences, and says when it lacks data', () => {
    const declared = analyzeStyleFromFacts(
      input({ preferredStyles: ['ELEGANT'], preferredColors: ['black'] }),
    );
    expect(declared.dominantStyles).toEqual(['ELEGANT']);
    expect(declared.summary).toBe('Ton style penche vers l’élégant, avec une palette de noir.');
    const accent = analyzeStyleFromFacts(
      input({ preferredStyles: ['CASUAL'], preferredColors: ['orange'] }),
    );
    expect(accent.summary).toContain('une palette d’orange');

    const empty = analyzeStyleFromFacts(input({ closet: [] }));
    expect(empty.summary).toContain('se dessine encore');
    expect(empty.suggestions).toHaveLength(1);
  });
});
