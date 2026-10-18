import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  addDays,
  daysBetween,
  dislikeReasonSchema,
  type GenerateOutfitResponse,
  type generateOutfitRequestSchema,
  type Outfit,
  type OutfitConstraints,
  outfitConstraintsSchema,
  type OutfitFeedbackInput,
  type OutfitPage,
  type outfitsQuerySchema,
  PLAN_AHEAD_DAYS,
  type Style,
  type UpdateOutfitInput,
} from '@vyra/shared';
import { type z } from 'zod';
import { type AIClothingItem, AIProvider, type OutfitCandidate } from '../ai/ai.provider';
import { explainOutfit, outfitName } from '../ai/mock/stylist-copy';
import { ClosetService } from '../closet/closet.service';
import { AppException } from '../common/errors/app.exception';
import { dateColumn, dayOfDateColumn, localDay, startOfLocalDay } from '../common/time/local-day';
import { type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { avoidedItemIds, readLearned } from '../style/learn-style';
import { StyleLearningService } from '../style/style-learning.service';
import {
  baseKeyOf,
  type Candidate,
  comboKey,
  type EngineItem,
  generateCandidates,
} from './engine/candidate-engine';

type GenerateRequest = z.output<typeof generateOutfitRequestSchema>;
type OutfitsQuery = z.output<typeof outfitsQuerySchema>;

const DAY_MS = 86_400_000;
const WEAR_WINDOW_DAYS = 30;
/** Looks planned this close to the target day count as a use of their pieces. */
const PLANNED_WINDOW_DAYS = 7;
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
  // Outfits are only ever read by their owner, so these are the owner's rows.
  feedback: { select: { rating: true, comment: true }, take: 1 },
  wearHistory: { select: { wornAt: true }, orderBy: { wornAt: 'desc' }, take: 1 },
} satisfies Prisma.OutfitInclude;
type OutfitRow = Prisma.OutfitGetPayload<{ include: typeof OUTFIT_INCLUDE }>;

@Injectable()
export class OutfitsService {
  private readonly logger = new Logger(OutfitsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AIProvider,
    private readonly closet: ClosetService,
    private readonly learning: StyleLearningService,
  ) {}

  async generate(userId: string, request: GenerateRequest): Promise<GenerateOutfitResponse> {
    const now = Date.now();
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { locale: true, timezone: true },
    });
    const timezone = profile?.timezone ?? 'UTC';
    const today = localDay(new Date(now), timezone);
    // The day the look is for: anti-repetition is measured around it, not around now.
    const target = request.date ?? today;
    const ahead = daysBetween(today, target);
    if (ahead < 0 || ahead > PLAN_AHEAD_DAYS) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Outfits can be generated for today or an upcoming day.',
        { reason: 'DATE_OUT_OF_RANGE' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // Apply any rating, wear or save that has not been learned from yet.
    await this.learning.ensureFresh(userId);
    const [items, preferences, wears, planned, recentOutfits, feedback, excluded] =
      await Promise.all([
        this.prisma.clothingItem.findMany({ where: { userId, archivedAt: null } }),
        this.prisma.stylePreference.findUnique({ where: { userId } }),
        this.prisma.wearHistory.findMany({
          where: {
            userId,
            wornAt: {
              gte: startOfLocalDay(addDays(target, -WEAR_WINDOW_DAYS), timezone),
              lt: startOfLocalDay(addDays(target, 1), timezone),
            },
          },
          select: { wornAt: true, outfit: { select: PIECES_SELECT } },
        }),
        this.prisma.calendarEvent.findMany({
          where: {
            userId,
            date: {
              gte: dateColumn(addDays(target, -PLANNED_WINDOW_DAYS)),
              lte: dateColumn(addDays(target, PLANNED_WINDOW_DAYS)),
              not: dateColumn(target),
            },
          },
          select: { date: true, outfit: { select: PIECES_SELECT } },
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

    const learned = readLearned(preferences?.metadata);
    const keyOf = (outfit: { items: { clothingItemId: string }[] }) =>
      comboKey(outfit.items.map((item) => item.clothingItemId));
    const piecesKey = (outfit: OutfitPieces) =>
      comboKey(outfit.items.map((item) => item.clothingItem.id));
    const piecesBase = (outfit: OutfitPieces) =>
      baseKeyOf(outfit.items.map((item) => item.clothingItem));
    const disliked = feedback
      .filter((entry) => entry.rating === 'DISLIKE')
      .map((entry) => entry.outfit);

    // Closest use of each piece around the target day: worn before it, or
    // planned in the calendar a few days before or after.
    const wornDistance = new Map<string, number>();
    const useDistanceDays = new Map<string, number>();
    const usedBases = new Map<string, number>();
    const closest = (map: Map<string, number>, key: string, days: number) => {
      const previous = map.get(key);
      if (previous === undefined || days < previous) map.set(key, days);
    };
    const use = (outfit: OutfitPieces, days: number, worn: boolean) => {
      for (const { clothingItem } of outfit.items) {
        closest(useDistanceDays, clothingItem.id, days);
        if (worn) closest(wornDistance, clothingItem.id, days);
      }
      closest(usedBases, piecesBase(outfit), days);
    };
    for (const wear of wears)
      use(wear.outfit, daysBetween(localDay(wear.wornAt, timezone), target), true);
    for (const event of planned) {
      use(event.outfit, Math.abs(daysBetween(dayOfDateColumn(event.date), target)), false);
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
        // Pieces the user marked, plus pieces they keep rejecting.
        dislikedItemIds: [...(preferences?.dislikedItems ?? []), ...avoidedItemIds(learned)],
      },
      useDistanceDays,
      affinity: {
        colors: new Map(Object.entries(learned.colors)),
        styles: new Map(Object.entries(learned.styles)),
        items: new Map(Object.entries(learned.items)),
        occasionStyles: new Map(Object.entries(learned.occasionStyles[request.occasion] ?? {})),
      },
      recentCombos: new Set(recentOutfits.map(keyOf)),
      dislikedCombos: new Set(disliked.map(piecesKey)),
      dislikedBases: new Set(disliked.map(piecesBase)),
      excludedCombos: new Set(excluded.map(piecesKey)),
      excludedBases: new Set(excluded.map(piecesBase)),
      usedBases,
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
        .filter((id) => (wornDistance.get(id) ?? Number.POSITIVE_INFINITY) <= 7);
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

    const created = await this.prisma.outfit.create({
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
      // Read back outside the nested-create transaction: Prisma loads included
      // relations in parallel, which pg forbids on a single transaction client.
      select: { id: true },
    });
    const outfit = await this.prisma.outfit.findUniqueOrThrow({
      where: { id: created.id },
      include: OUTFIT_INCLUDE,
    });

    return {
      outfit: await this.toDto(outfit, timezone),
      provider: this.provider.name,
      candidateCount: result.candidates.length,
    };
  }

  async get(userId: string, id: string): Promise<Outfit> {
    const [outfit, timezone] = await Promise.all([
      this.prisma.outfit.findFirst({ where: { id, userId }, include: OUTFIT_INCLUDE }),
      this.timezoneOf(userId),
    ]);
    if (!outfit) throw new AppException('NOT_FOUND', 'Outfit not found');
    return this.toDto(outfit, timezone);
  }

  /** The user's outfits, newest first; `saved=true` lists the looks they kept. */
  async list(userId: string, query: OutfitsQuery): Promise<OutfitPage> {
    const [rows, timezone] = await Promise.all([
      this.prisma.outfit.findMany({
        where: { userId, ...(query.saved !== undefined ? { isSaved: query.saved } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        include: OUTFIT_INCLUDE,
      }),
      this.timezoneOf(userId),
    ]);
    const page = rows.slice(0, query.limit);
    return {
      items: await Promise.all(page.map((row) => this.toDto(row, timezone))),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async update(userId: string, id: string, input: UpdateOutfitInput): Promise<Outfit> {
    await this.assertOwned(userId, id);
    await this.prisma.outfit.update({ where: { id }, data: { isSaved: input.isSaved } });
    this.learning.markDirty(userId);
    return this.get(userId, id);
  }

  /**
   * "Wear today": records one wear per local day (tapping twice does not count
   * twice). Wear history feeds the engine's recency penalty, so these pieces
   * step back in the next suggestions.
   */
  async wear(userId: string, id: string): Promise<Outfit> {
    await this.assertOwned(userId, id);
    const now = new Date();
    if ((await this.wearsToday(userId, id, now)).length === 0) {
      await this.prisma.wearHistory.create({ data: { userId, outfitId: id, wornAt: now } });
    }
    this.learning.markDirty(userId);
    return this.get(userId, id);
  }

  /** Undo today's wear (a mis-tap); earlier days stay in the history. */
  async unwear(userId: string, id: string): Promise<Outfit> {
    await this.assertOwned(userId, id);
    const today = await this.wearsToday(userId, id, new Date());
    if (today.length) {
      await this.prisma.wearHistory.deleteMany({
        where: { userId, id: { in: today.map((wear) => wear.id) } },
      });
    }
    this.learning.markDirty(userId);
    return this.get(userId, id);
  }

  /** "Love it" / "Not for me": one rating per look, changeable. */
  async rate(userId: string, id: string, input: OutfitFeedbackInput): Promise<Outfit> {
    await this.assertOwned(userId, id);
    const comment = input.rating === 'DISLIKE' ? (input.reason ?? null) : null;
    await this.prisma.outfitFeedback.upsert({
      where: { outfitId_userId: { outfitId: id, userId } },
      create: { outfitId: id, userId, rating: input.rating, comment },
      update: { rating: input.rating, comment },
    });
    this.learning.markDirty(userId);
    return this.get(userId, id);
  }

  async clearRating(userId: string, id: string): Promise<Outfit> {
    await this.assertOwned(userId, id);
    await this.prisma.outfitFeedback.deleteMany({ where: { outfitId: id, userId } });
    this.learning.markDirty(userId);
    return this.get(userId, id);
  }

  private async assertOwned(userId: string, id: string) {
    const owned = await this.prisma.outfit.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!owned) throw new AppException('NOT_FOUND', 'Outfit not found');
  }

  private async timezoneOf(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    return profile?.timezone ?? 'UTC';
  }

  private async wearsToday(userId: string, outfitId: string, now: Date) {
    const timezone = await this.timezoneOf(userId);
    // A local day spans at most ~26 h of UTC; filter precisely by local date.
    const recent = await this.prisma.wearHistory.findMany({
      where: { userId, outfitId, wornAt: { gte: new Date(now.getTime() - 2 * DAY_MS) } },
      select: { id: true, wornAt: true },
    });
    const today = localDay(now, timezone);
    return recent.filter((wear) => localDay(wear.wornAt, timezone) === today);
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

  private async toDto(outfit: OutfitRow, timezone: string): Promise<Outfit> {
    const constraints = outfitConstraintsSchema.safeParse(outfit.constraints ?? undefined);
    const feedback = outfit.feedback[0];
    const lastWornAt = outfit.wearHistory[0]?.wornAt ?? null;
    const reason = dislikeReasonSchema.safeParse(feedback?.comment);
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
      feedback: feedback
        ? { rating: feedback.rating, reason: reason.success ? reason.data : null }
        : null,
      wornToday:
        lastWornAt !== null && localDay(lastWornAt, timezone) === localDay(new Date(), timezone),
      lastWornAt: lastWornAt?.toISOString() ?? null,
      createdAt: outfit.createdAt.toISOString(),
    };
  }
}
