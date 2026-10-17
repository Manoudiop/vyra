import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  type GenerateOutfitResponse,
  type generateOutfitRequestSchema,
  type Outfit,
  type OutfitConstraints,
  outfitConstraintsSchema,
  type Style,
} from '@vyra/shared';
import { type z } from 'zod';
import { type AIClothingItem, AIProvider, type OutfitCandidate } from '../ai/ai.provider';
import { explainOutfit, outfitName } from '../ai/mock/stylist-copy';
import { ClosetService } from '../closet/closet.service';
import { AppException } from '../common/errors/app.exception';
import { type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  baseKeyOf,
  type Candidate,
  comboKey,
  type EngineItem,
  generateCandidates,
} from './engine/candidate-engine';

type GenerateRequest = z.output<typeof generateOutfitRequestSchema>;

const DAY_MS = 86_400_000;
const WEAR_WINDOW_DAYS = 30;
const RECENT_GENERATION_DAYS = 14;

/** Display order of pieces in an outfit. */
const SLOT_ORDER = { outer: 0, onePiece: 1, top: 1, bottom: 2, shoes: 3, accessory: 4 } as const;

/** Outfit pieces with what the engine needs to recognize a look's main pieces. */
const PIECES_SELECT = {
  items: {
    select: {
      clothingItem: {
        select: {
          id: true,
          name: true,
          category: true,
          subcategory: true,
          color: true,
          style: true,
          season: true,
          isFavorite: true,
        },
      },
    },
  },
} satisfies Prisma.OutfitSelect;
type OutfitPieces = Prisma.OutfitGetPayload<{ select: typeof PIECES_SELECT }>;

const OUTFIT_INCLUDE = {
  items: { orderBy: { position: 'asc' }, include: { clothingItem: true } },
} satisfies Prisma.OutfitInclude;
type OutfitRow = Prisma.OutfitGetPayload<{ include: typeof OUTFIT_INCLUDE }>;

@Injectable()
export class OutfitsService {
  private readonly logger = new Logger(OutfitsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AIProvider,
    private readonly closet: ClosetService,
  ) {}

  async generate(userId: string, request: GenerateRequest): Promise<GenerateOutfitResponse> {
    const now = Date.now();
    const [items, preferences, profile, wears, recentOutfits, feedback, excluded] =
      await Promise.all([
        this.prisma.clothingItem.findMany({ where: { userId, archivedAt: null } }),
        this.prisma.stylePreference.findUnique({ where: { userId } }),
        this.prisma.profile.findUnique({ where: { userId }, select: { locale: true } }),
        this.prisma.wearHistory.findMany({
          where: { userId, wornAt: { gte: new Date(now - WEAR_WINDOW_DAYS * DAY_MS) } },
          select: {
            wornAt: true,
            outfit: { select: { items: { select: { clothingItemId: true } } } },
          },
        }),
        this.prisma.outfit.findMany({
          where: { userId, createdAt: { gte: new Date(now - RECENT_GENERATION_DAYS * DAY_MS) } },
          select: { items: { select: { clothingItemId: true } } },
        }),
        this.prisma.outfitFeedback.findMany({
          where: { userId },
          select: { rating: true, outfit: { select: PIECES_SELECT } },
        }),
        request.excludeOutfitIds.length
          ? this.prisma.outfit.findMany({
              where: { userId, id: { in: request.excludeOutfitIds } },
              select: PIECES_SELECT,
            })
          : Promise.resolve([]),
      ]);

    const keyOf = (outfit: { items: { clothingItemId: string }[] }) =>
      comboKey(outfit.items.map((item) => item.clothingItemId));
    const piecesKey = (outfit: OutfitPieces) =>
      comboKey(outfit.items.map((item) => item.clothingItem.id));
    const piecesBase = (outfit: OutfitPieces) =>
      baseKeyOf(outfit.items.map((item) => item.clothingItem));
    const disliked = feedback
      .filter((entry) => entry.rating === 'DISLIKE')
      .map((entry) => entry.outfit);

    const lastWornDaysAgo = new Map<string, number>();
    for (const wear of wears) {
      const days = Math.floor((now - wear.wornAt.getTime()) / DAY_MS);
      for (const { clothingItemId } of wear.outfit.items) {
        const previous = lastWornDaysAgo.get(clothingItemId);
        if (previous === undefined || days < previous) lastWornDaysAgo.set(clothingItemId, days);
      }
    }

    const engineItems: EngineItem[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      subcategory: item.subcategory,
      color: item.color,
      style: item.style,
      season: item.season,
      isFavorite: item.isFavorite,
    }));

    const result = generateCandidates(engineItems, {
      occasion: request.occasion,
      style: request.style,
      constraints: request.constraints,
      preferences: {
        colors: preferences?.preferredColors ?? [],
        styles: preferences?.preferredStyles ?? [],
        dislikedItemIds: preferences?.dislikedItems ?? [],
      },
      lastWornDaysAgo,
      lovedItemIds: new Set(
        feedback
          .filter((entry) => entry.rating === 'LOVE')
          .flatMap((entry) => entry.outfit.items.map((item) => item.clothingItem.id)),
      ),
      recentCombos: new Set(recentOutfits.map(keyOf)),
      dislikedCombos: new Set(disliked.map(piecesKey)),
      dislikedBases: new Set(disliked.map(piecesBase)),
      excludedCombos: new Set(excluded.map(piecesKey)),
      excludedBases: new Set(excluded.map(piecesBase)),
      // Varies across requests; "try another" relies on exclusions, not luck.
      seed: Math.floor(now / 1000),
    });

    if (!result.ok) throw this.engineFailure(result);

    const locale = profile?.locale ?? 'fr';
    const toAI = (item: EngineItem): AIClothingItem => ({
      id: item.id,
      name: item.name,
      category: item.category,
      subcategory: item.subcategory,
      color: item.color,
      style: item.style,
      season: item.season,
    });
    const recentlyWorn = (candidate: Candidate) =>
      candidate.items
        .map((item) => item.id)
        .filter((id) => (lastWornDaysAgo.get(id) ?? Number.POSITIVE_INFINITY) <= 7);
    const aiCandidates: OutfitCandidate[] = result.candidates.map((candidate) => ({
      items: candidate.items.map(toAI),
      score: candidate.score,
      recentlyWornIds: recentlyWorn(candidate),
    }));

    const choice = await this.chooseWithProvider(
      request,
      aiCandidates,
      preferences?.preferredColors ?? [],
      preferences?.preferredStyles ?? [],
      locale,
    );
    const chosen = result.candidates[choice.candidateIndex]!;

    const outfit = await this.prisma.outfit.create({
      data: {
        userId,
        name: choice.name,
        occasion: request.occasion,
        style: request.style,
        reason: choice.reason,
        score: Math.round(chosen.score * 1000) / 1000,
        source: 'AI',
        constraints: request.constraints as Prisma.InputJsonValue,
        items: {
          create: chosen.items
            .map((item, index) => ({ item, slot: chosen.slots[index]! }))
            .sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot])
            .map(({ item }, position) => ({ clothingItemId: item.id, position })),
        },
      },
      include: OUTFIT_INCLUDE,
    });

    return {
      outfit: await this.toDto(outfit),
      provider: this.provider.name,
      candidateCount: result.candidates.length,
    };
  }

  async get(userId: string, id: string): Promise<Outfit> {
    const outfit = await this.prisma.outfit.findFirst({
      where: { id, userId },
      include: OUTFIT_INCLUDE,
    });
    if (!outfit) throw new AppException('NOT_FOUND', 'Outfit not found');
    return this.toDto(outfit);
  }

  /**
   * Lets the provider pick and phrase the outfit, but never trusts it blindly:
   * an invalid index or empty text falls back to the engine's best candidate
   * with a template explanation, so the user always gets a look.
   */
  private async chooseWithProvider(
    request: GenerateRequest,
    candidates: OutfitCandidate[],
    colors: string[],
    styles: Style[],
    locale: string,
  ): Promise<{ candidateIndex: number; name: string; reason: string }> {
    try {
      const choice = await this.provider.generateOutfit({
        occasion: request.occasion,
        style: request.style,
        candidates,
        preferences: { colors, styles },
        weather: null, // phase 13
        locale,
      });
      const name = choice.name?.trim().slice(0, 80);
      const reason = choice.reason?.trim().slice(0, 1200);
      if (
        Number.isInteger(choice.candidateIndex) &&
        candidates[choice.candidateIndex] &&
        name &&
        reason
      ) {
        return { candidateIndex: choice.candidateIndex, name, reason };
      }
      this.logger.warn(`Invalid outfit choice from ${this.provider.name}; using the engine's best`);
    } catch (error) {
      this.logger.warn(
        `generateOutfit failed (${this.provider.name}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const best = candidates[0]!;
    return {
      candidateIndex: 0,
      name: outfitName(best.items, request.occasion, locale),
      reason: explainOutfit({
        items: best.items,
        occasion: request.occasion,
        style: request.style,
        weather: null,
        recentlyWornIds: best.recentlyWornIds,
        preferredColors: colors,
        locale,
      }),
    };
  }

  private engineFailure(result: Exclude<ReturnType<typeof generateCandidates>, { ok: true }>) {
    const status = HttpStatus.UNPROCESSABLE_ENTITY;
    switch (result.reason) {
      case 'INCOMPLETE_CLOSET':
        return new AppException(
          'VALIDATION_ERROR',
          'Your closet needs a few more pieces to build an outfit.',
          { reason: 'INCOMPLETE_CLOSET', missing: result.missing },
          status,
        );
      case 'REQUIRED_ITEM_UNAVAILABLE':
        return new AppException(
          'VALIDATION_ERROR',
          'The selected piece is not available with these constraints.',
          { reason: 'REQUIRED_ITEM_UNAVAILABLE' },
          status,
        );
      case 'NO_MATCH':
        return new AppException(
          'VALIDATION_ERROR',
          'No outfit matches these constraints. Try relaxing one of them.',
          { reason: 'NO_MATCH' },
          status,
        );
    }
  }

  private async toDto(outfit: OutfitRow): Promise<Outfit> {
    const constraints = outfitConstraintsSchema.safeParse(outfit.constraints ?? undefined);
    return {
      id: outfit.id,
      name: outfit.name,
      occasion: outfit.occasion,
      style: outfit.style,
      reason: outfit.reason,
      score: outfit.score,
      isSaved: outfit.isSaved,
      constraints:
        outfit.constraints && constraints.success ? (constraints.data as OutfitConstraints) : null,
      items: await Promise.all(outfit.items.map((entry) => this.closet.toDto(entry.clothingItem))),
      createdAt: outfit.createdAt.toISOString(),
    };
  }
}
