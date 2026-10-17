import { Injectable } from '@nestjs/common';
import {
  type ClosetPage,
  type ClosetSummary,
  type ClothingItem,
  type ClothingItemDetail,
  closetQuerySchema,
  type CreateClothingItemInput,
  emptyCategoryCounts,
  PLAN_DEFINITIONS,
  type UpdateClothingItemInput,
} from '@vyra/shared';
import { type z } from 'zod';
import { AppException } from '../common/errors/app.exception';
import { type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, userKeyPrefix } from '../storage/storage.service';

type ClosetQueryParsed = z.output<typeof closetQuerySchema>;
export type ItemRow = Prisma.ClothingItemGetPayload<object>;

const notFound = () => new AppException('NOT_FOUND', 'Item not found');

/**
 * The user's closet. Every query is scoped by `userId` and excludes archived
 * items; another user's item id behaves exactly like a missing one (404).
 */
@Injectable()
export class ClosetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(userId: string, query: ClosetQueryParsed): Promise<ClosetPage> {
    const where: Prisma.ClothingItemWhereInput = {
      userId,
      archivedAt: null,
      ...(query.category ? { category: query.category } : {}),
      ...(query.favorite !== undefined ? { isFavorite: query.favorite } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { subcategory: { contains: query.search, mode: 'insensitive' } },
              { color: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // Keyset pagination on (createdAt desc, id desc): stable while items are added.
    const rows = await this.prisma.clothingItem.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const page = rows.slice(0, query.limit);
    return {
      items: await Promise.all(page.map((row) => this.toDto(row))),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async summary(userId: string): Promise<ClosetSummary> {
    const [groups, favorites, plan] = await Promise.all([
      this.prisma.clothingItem.groupBy({
        by: ['category'],
        where: { userId, archivedAt: null },
        _count: { _all: true },
      }),
      this.prisma.clothingItem.count({ where: { userId, archivedAt: null, isFavorite: true } }),
      this.currentPlan(userId),
    ]);

    const byCategory = emptyCategoryCounts();
    for (const group of groups) byCategory[group.category] = group._count._all;
    return {
      total: groups.reduce((sum, group) => sum + group._count._all, 0),
      favorites,
      byCategory,
      limit: PLAN_DEFINITIONS[plan].maxClothingItems,
    };
  }

  async get(userId: string, id: string): Promise<ClothingItemDetail> {
    const row = await this.findOwned(userId, id);
    const [outfitCount, wears] = await Promise.all([
      this.prisma.outfitItem.count({ where: { clothingItemId: id, outfit: { userId } } }),
      this.prisma.wearHistory.aggregate({
        where: { userId, outfit: { items: { some: { clothingItemId: id } } } },
        _count: { _all: true },
        _max: { wornAt: true },
      }),
    ]);
    return {
      ...(await this.toDto(row)),
      stats: {
        outfitCount,
        wearCount: wears._count._all,
        lastWornAt: wears._max.wornAt?.toISOString() ?? null,
      },
    };
  }

  async create(userId: string, input: CreateClothingItemInput): Promise<ClothingItem> {
    // Images must have been uploaded by this user (phase 7 issues keys under this prefix).
    const prefix = userKeyPrefix(userId);
    for (const key of [input.imageKey, input.thumbnailKey]) {
      if (key !== undefined && !key.startsWith(prefix)) {
        throw new AppException('FORBIDDEN', 'Image does not belong to this account');
      }
    }

    const plan = await this.currentPlan(userId);
    const max = PLAN_DEFINITIONS[plan].maxClothingItems;
    if (max !== null) {
      const count = await this.prisma.clothingItem.count({ where: { userId, archivedAt: null } });
      if (count >= max) {
        throw new AppException('LIMIT_REACHED', `Your ${plan} closet is limited to ${max} items`, {
          metric: 'CLOSET_ITEMS',
          limit: max,
          used: count,
          currentPlan: plan,
          suggestedPlan: 'PRO',
        });
      }
    }

    // The photo must really have been uploaded (keys are not guessable, but be strict).
    const missing = await Promise.all(
      [input.imageKey, input.thumbnailKey]
        .filter((key): key is string => key !== undefined)
        .map(async (key) => !(await this.storage.exists(key))),
    );
    if (missing.some(Boolean)) {
      throw new AppException('VALIDATION_ERROR', 'Image not found. Upload the photo again.', {
        reason: 'IMAGE_NOT_FOUND',
      });
    }

    const row = await this.prisma.clothingItem.create({
      data: {
        userId,
        name: input.name,
        category: input.category,
        subcategory: input.subcategory ?? null,
        color: input.color,
        colorHex: input.colorHex ?? null,
        style: input.style ?? null,
        season: input.season ?? 'ALL_SEASON',
        isFavorite: input.isFavorite ?? false,
        imageKey: input.imageKey,
        thumbnailKey: input.thumbnailKey ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    return this.toDto(row);
  }

  async update(userId: string, id: string, input: UpdateClothingItemInput): Promise<ClothingItem> {
    // updateMany scoped by owner: a foreign id matches zero rows instead of leaking existence.
    const { count } = await this.prisma.clothingItem.updateMany({
      where: { id, userId, archivedAt: null },
      data: input,
    });
    if (count === 0) throw notFound();
    return this.toDto(await this.findOwned(userId, id));
  }

  /** Soft delete: the item leaves the closet but past outfits keep their pieces. */
  async archive(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.clothingItem.updateMany({
      where: { id, userId, archivedAt: null },
      data: { archivedAt: new Date(), isFavorite: false },
    });
    if (count === 0) throw notFound();
  }

  private async findOwned(userId: string, id: string): Promise<ItemRow> {
    const row = await this.prisma.clothingItem.findFirst({
      where: { id, userId, archivedAt: null },
    });
    if (!row) throw notFound();
    return row;
  }

  private async currentPlan(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true },
    });
    return subscription && ['ACTIVE', 'TRIALING'].includes(subscription.status)
      ? subscription.plan
      : 'FREE';
  }

  /** Public so other modules (outfits) present items exactly like the closet does. */
  async toDto(row: ItemRow): Promise<ClothingItem> {
    const [imageUrl, thumbnailUrl] = await Promise.all([
      this.storage.getSignedUrl(row.imageKey),
      this.storage.getSignedUrl(row.thumbnailKey ?? row.imageKey),
    ]);
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      subcategory: row.subcategory,
      color: row.color,
      colorHex: row.colorHex,
      style: row.style,
      season: row.season,
      isFavorite: row.isFavorite,
      imageUrl,
      thumbnailUrl,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
