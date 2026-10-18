import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  LEARNING_MIN_SIGNALS,
  OCCASIONS,
  planHasFeature,
  type Style,
  type StyleAnalysisResult,
  styleAnalysisSchema,
  STYLES,
  type StyleProfile,
} from '@vyra/shared';
import { type AIClothingItem, AIProvider, type Weighted } from '../ai/ai.provider';
import { ClosetService } from '../closet/closet.service';
import { AppException } from '../common/errors/app.exception';
import { type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../subscriptions/plans.service';
import { avoidedItemIds, type LearnedStyle, readLearned } from './learn-style';
import { StyleLearningService } from './style-learning.service';

/** Shown as a liking / an aversion from this weight on. */
const SHOWN_WEIGHT = 0.2;
const FAVORITE_PIECE_WEIGHT = 0.3;
/** An occasion → style habit needs at least this much evidence. */
const OCCASION_STYLE_WEIGHT = 0.25;

const AI_ITEM_SELECT = {
  id: true,
  name: true,
  category: true,
  subcategory: true,
  color: true,
  style: true,
  season: true,
} satisfies Prisma.ClothingItemSelect;
const LOOK_ITEMS = {
  items: { orderBy: { position: 'asc' }, select: { clothingItem: { select: AI_ITEM_SELECT } } },
} satisfies Prisma.OutfitSelect;

const ranked = <T extends string>(
  weights: Partial<Record<T, number>>,
  sign: 1 | -1,
  limit: number,
) =>
  (Object.entries(weights) as [T, number][])
    .filter(([, weight]) => weight * sign >= SHOWN_WEIGHT)
    .sort((a, b) => (b[1] - a[1]) * sign)
    .slice(0, limit)
    .map(([value, weight]): Weighted<T> => ({ value, weight }));

function occasionHabits(learned: LearnedStyle) {
  return OCCASIONS.flatMap((occasion) => {
    const best = ranked(learned.occasionStyles[occasion] ?? {}, 1, 1)[0];
    // "Traditional → traditional" teaches nothing.
    return best && best.weight >= OCCASION_STYLE_WEIGHT && (best.value as string) !== occasion
      ? [{ occasion, style: best.value, weight: best.weight }]
      : [];
  });
}

@Injectable()
export class StyleProfileService {
  private readonly logger = new Logger(StyleProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly learning: StyleLearningService,
    private readonly closet: ClosetService,
    private readonly plans: PlansService,
    private readonly provider: AIProvider,
  ) {}

  /** Declared preferences side by side with what VYRA learned. */
  async get(userId: string): Promise<StyleProfile> {
    await this.learning.ensureFresh(userId);
    const [preference, plan] = await Promise.all([
      this.prisma.stylePreference.findUnique({ where: { userId } }),
      this.plans.currentPlan(userId),
    ]);
    const learned = readLearned(preference?.metadata);

    const favoriteIds = ranked(learned.items, 1, 8)
      .filter((entry) => entry.weight >= FAVORITE_PIECE_WEIGHT)
      .map((entry) => entry.value);
    // Pieces the engine never suggests: marked by the user, or learned from rejections.
    const avoidedIds = [
      ...new Set([...(preference?.dislikedItems ?? []), ...avoidedItemIds(learned)]),
    ];
    const pieces = await this.prisma.clothingItem.findMany({
      where: { userId, archivedAt: null, id: { in: [...favoriteIds, ...avoidedIds] } },
    });
    const byId = new Map(pieces.map((piece) => [piece.id, piece]));
    const toDtos = (ids: string[], limit: number) =>
      Promise.all(
        ids
          .flatMap((id) => {
            const piece = byId.get(id);
            return piece ? [piece] : [];
          })
          .slice(0, limit)
          .map((piece) => this.closet.toDto(piece)),
      );
    const { loves, dislikes, wears, saves } = learned.signals;
    const analysis = styleAnalysisSchema.safeParse(
      (preference?.metadata as { analysis?: unknown } | null)?.analysis,
    );

    return {
      declared: {
        styles: preference?.preferredStyles ?? [],
        colors: preference?.preferredColors ?? [],
        occasions: preference?.preferredOccasions ?? [],
      },
      learned: {
        colors: ranked(learned.colors, 1, 5),
        avoidedColors: ranked(learned.colors, -1, 3),
        styles: ranked(learned.styles, 1, 3),
        avoidedStyles: ranked(learned.styles, -1, 2),
        occasionStyles: occasionHabits(learned),
        favoritePieces: await toDtos(favoriteIds, 4),
        avoidedPieces: await toDtos(
          [...avoidedIds].sort((a, b) => (learned.items[a] ?? 0) - (learned.items[b] ?? 0)),
          4,
        ),
      },
      signals: { loves, dislikes, wears, saves },
      ready: loves + dislikes + wears + saves >= LEARNING_MIN_SIGNALS,
      computedAt: preference?.lastComputedAt?.toISOString() ?? null,
      analysis: analysis.success ? analysis.data : null,
      canAnalyze: planHasFeature(plan, 'STYLE_ANALYSIS'),
    };
  }

  /**
   * PREMIUM: the AIProvider reads the learned profile, closet and history and
   * writes a short analysis. The answer is validated, then kept as the
   * latest analysis.
   */
  async analyze(userId: string): Promise<StyleAnalysisResult> {
    const plan = await this.plans.currentPlan(userId);
    if (!planHasFeature(plan, 'STYLE_ANALYSIS')) {
      throw new AppException('LIMIT_REACHED', 'Style analysis is part of VYRA Premium.', {
        feature: 'STYLE_ANALYSIS',
        currentPlan: plan,
        suggestedPlan: 'PREMIUM',
      });
    }
    await this.learning.ensureFresh(userId);

    const since = new Date(Date.now() - 90 * 86_400_000);
    const [preference, profile, closet, feedback, wears] = await Promise.all([
      this.prisma.stylePreference.findUnique({ where: { userId } }),
      this.prisma.profile.findUnique({ where: { userId }, select: { locale: true } }),
      this.prisma.clothingItem.findMany({
        where: { userId, archivedAt: null },
        select: AI_ITEM_SELECT,
      }),
      this.prisma.outfitFeedback.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 40,
        select: { rating: true, outfit: { select: LOOK_ITEMS } },
      }),
      this.prisma.wearHistory.findMany({
        where: { userId, wornAt: { gte: since } },
        orderBy: { wornAt: 'desc' },
        take: 40,
        select: { outfit: { select: LOOK_ITEMS } },
      }),
    ]);
    const learned = readLearned(preference?.metadata);
    const { loves, dislikes, wears: wearCount, saves } = learned.signals;
    if (loves + dislikes + wearCount + saves < LEARNING_MIN_SIGNALS) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Rate or wear a few looks first so the analysis has something to read.',
        { reason: 'NOT_ENOUGH_SIGNALS', needed: LEARNING_MIN_SIGNALS },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const looks = (rating: 'LOVE' | 'DISLIKE') =>
      feedback
        .filter((entry) => entry.rating === rating)
        .map((entry) =>
          entry.outfit.items.map(({ clothingItem }) => clothingItem as AIClothingItem),
        );
    const result = await this.provider.analyzeStyle({
      preferredStyles: preference?.preferredStyles ?? [],
      preferredColors: preference?.preferredColors ?? [],
      closet,
      lovedOutfits: looks('LOVE'),
      dislikedOutfits: looks('DISLIKE'),
      wornOutfits: wears.map((wear) =>
        wear.outfit.items.map(({ clothingItem }) => clothingItem as AIClothingItem),
      ),
      learned: {
        colors: ranked(learned.colors, 1, 5),
        avoidedColors: ranked(learned.colors, -1, 3),
        styles: ranked(learned.styles, 1, 3),
        occasionStyles: occasionHabits(learned),
      },
      locale: profile?.locale ?? 'fr',
    });

    // Never trust provider output blindly: keep known styles, cap sizes.
    const analysis: StyleAnalysisResult = {
      summary: result.summary?.trim().slice(0, 1200) ?? '',
      dominantStyles: (result.dominantStyles ?? [])
        .filter((style): style is Style => STYLES.includes(style))
        .slice(0, 3),
      signatureColors: (result.signatureColors ?? []).slice(0, 5),
      suggestions: (result.suggestions ?? [])
        .map((text) => text.trim())
        .filter(Boolean)
        .slice(0, 4),
      createdAt: new Date().toISOString(),
    };
    if (!analysis.summary) {
      this.logger.warn(`Empty style analysis from ${this.provider.name}`);
      throw new AppException('AI_ERROR', 'The style analysis could not be produced. Try again.');
    }

    await this.prisma.stylePreference.update({
      where: { userId },
      data: {
        metadata: {
          ...((preference?.metadata as Record<string, unknown> | null) ?? {}),
          analysis,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    return analysis;
  }
}
