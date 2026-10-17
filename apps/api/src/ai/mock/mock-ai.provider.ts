import { type ClothingAnalysis } from '@vyra/shared';
import { AppException } from '../../common/errors/app.exception';
import {
  type AnalyzeClothingInput,
  type AnalyzeStyleInput,
  AIProvider,
  type ExplainOutfitInput,
  type GeneratedOutfit,
  type GenerateOutfitInput,
  type StyleAnalysis,
} from '../ai.provider';
import { analyzeFeatures } from './clothing-classifier';
import { extractFeatures } from './garment-vision';
import { explainOutfit, outfitName } from './stylist-copy';

/**
 * Offline provider used in development and tests: deterministic, no network,
 * no API key. Clothing analysis really looks at the photo (silhouette + color
 * segmentation); outfits are chosen among engine-ranked candidates and
 * explained from facts about them. Style analysis arrives in phase 12.
 */
export class MockAIProvider extends AIProvider {
  readonly name = 'mock';

  async analyzeClothing({ image, locale }: AnalyzeClothingInput): Promise<ClothingAnalysis> {
    return analyzeFeatures(await extractFeatures(image), locale);
  }

  /** The engine already ranked the candidates: the mock takes the best one and explains it. */
  async generateOutfit(input: GenerateOutfitInput): Promise<GeneratedOutfit> {
    const best = input.candidates[0];
    if (!best) throw new AppException('AI_ERROR', 'No candidate to choose from');
    return {
      candidateIndex: 0,
      name: outfitName(best.items, input.occasion, input.locale),
      reason: explainOutfit({
        items: best.items,
        occasion: input.occasion,
        style: input.style,
        weather: input.weather,
        recentlyWornIds: best.recentlyWornIds,
        preferredColors: input.preferences.colors,
        locale: input.locale,
      }),
    };
  }

  async explainOutfit(input: ExplainOutfitInput): Promise<string> {
    return explainOutfit(input);
  }

  analyzeStyle(_input: AnalyzeStyleInput): Promise<StyleAnalysis> {
    return Promise.reject(notYetAvailable('analyzeStyle'));
  }
}

function notYetAvailable(method: string) {
  return new AppException('AI_ERROR', `The mock provider does not implement ${method} yet`);
}
