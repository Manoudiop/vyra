import {
  type ClothingAnalysis,
  type ClothingCategory,
  type Occasion,
  type Season,
  type Style,
} from '@vyra/shared';

/**
 * Provider-agnostic AI contract. Business code depends only on this class;
 * an implementation is chosen by AI_PROVIDER (only "mock" in the MVP — a
 * hosted model plugs in here without touching callers). Credentials, when a
 * real provider is added, come from environment variables on the API only.
 */
export abstract class AIProvider {
  abstract readonly name: string;

  /** Identify a garment on a normalized product photo (WebP from the upload pipeline). */
  abstract analyzeClothing(input: AnalyzeClothingInput): Promise<ClothingAnalysis>;

  /** Choose the best outfit among engine-built candidates and phrase it (phase 9). */
  abstract generateOutfit(input: GenerateOutfitInput): Promise<GeneratedOutfit>;

  /** Explain why an outfit works for an occasion (phase 9). */
  abstract explainOutfit(input: ExplainOutfitInput): Promise<string>;

  /** Summarize a user's style from preferences, closet and feedback (phase 12). */
  abstract analyzeStyle(input: AnalyzeStyleInput): Promise<StyleAnalysis>;
}

export interface AnalyzeClothingInput {
  image: Buffer;
  /** UI locale for generated names ("fr", "en"). */
  locale: string;
}

/** A closet item as the AI sees it: only what is needed, no user data. */
export interface AIClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  subcategory: string | null;
  color: string;
  style: Style | null;
  season: Season;
}

export interface WeatherContext {
  temperatureC: number;
  condition: string;
  rainProbability: number;
}

export interface OutfitCandidate {
  items: AIClothingItem[];
  /** Engine score in [0, 1] (occasion fit, preferences, recency, weather). */
  score: number;
  /** Items of this candidate worn in the last 7 days (for the explanation). */
  recentlyWornIds: string[];
}

export interface GenerateOutfitInput {
  occasion: Occasion;
  style: Style;
  candidates: OutfitCandidate[];
  preferences: { colors: string[]; styles: Style[] };
  weather: WeatherContext | null;
  locale: string;
}

export interface GeneratedOutfit {
  /** Index into `candidates`; the API validates it and the item ids. */
  candidateIndex: number;
  name: string;
  reason: string;
}

export interface ExplainOutfitInput {
  items: AIClothingItem[];
  occasion: Occasion;
  style: Style;
  weather: WeatherContext | null;
  locale: string;
}

export interface Weighted<T extends string = string> {
  value: T;
  weight: number;
}

export interface AnalyzeStyleInput {
  /** Declared at onboarding / in the profile. */
  preferredStyles: Style[];
  preferredColors: string[];
  closet: AIClothingItem[];
  lovedOutfits: AIClothingItem[][];
  dislikedOutfits: AIClothingItem[][];
  /** Looks worn over the last months, most recent first. */
  wornOutfits: AIClothingItem[][];
  /** What style learning measured from ratings, wears and saves (weights in [-1, 1]). */
  learned: {
    colors: Weighted[];
    avoidedColors: Weighted[];
    styles: Weighted<Style>[];
    occasionStyles: { occasion: Occasion; style: Style }[];
  };
  locale: string;
}

export interface StyleAnalysis {
  summary: string;
  dominantStyles: Style[];
  signatureColors: string[];
  suggestions: string[];
}
