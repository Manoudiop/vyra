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

/**
 * Offline provider used in development and tests: deterministic, no network,
 * no API key. Clothing analysis really looks at the photo (silhouette + color
 * segmentation); outfit generation and style analysis are added in the phases
 * that introduce their engines (9 and 12).
 */
export class MockAIProvider extends AIProvider {
  readonly name = 'mock';

  async analyzeClothing({ image, locale }: AnalyzeClothingInput): Promise<ClothingAnalysis> {
    return analyzeFeatures(await extractFeatures(image), locale);
  }

  generateOutfit(_input: GenerateOutfitInput): Promise<GeneratedOutfit> {
    return Promise.reject(notYetAvailable('generateOutfit'));
  }

  explainOutfit(_input: ExplainOutfitInput): Promise<string> {
    return Promise.reject(notYetAvailable('explainOutfit'));
  }

  analyzeStyle(_input: AnalyzeStyleInput): Promise<StyleAnalysis> {
    return Promise.reject(notYetAvailable('analyzeStyle'));
  }
}

function notYetAvailable(method: string) {
  return new AppException('AI_ERROR', `The mock provider does not implement ${method} yet`);
}
