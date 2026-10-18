import { Injectable } from '@nestjs/common';
import {
  type AdminSubscriptions,
  type adminSubscriptionsQuerySchema,
  type AdminUserDetail,
  type AdminUsersPage,
  type adminUsersQuerySchema,
  type Plan,
  PLAN_DEFINITIONS,
} from '@vyra/shared';
import { type z } from 'zod';
import { AppException } from '../common/errors/app.exception';
import { type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { effectivePlan } from '../subscriptions/plans.service';
import { UsageService } from '../usage/usage.service';

type UsersQuery = z.output<typeof adminUsersQuerySchema>;
type SubscriptionsQuery = z.output<typeof adminSubscriptionsQuerySchema>;

const ROW_SELECT = {
  id: true,
  email: true,
  firstName: true,
  role: true,
  createdAt: true,
  profile: { select: { onboardingCompletedAt: true } },
  subscription: {
    select: { plan: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
  },
  _count: {
    select: { clothingItems: { where: { archivedAt: null } }, outfits: true },
  },
} satisfies Prisma.UserSelect;
type Row = Prisma.UserGetPayload<{ select: typeof ROW_SELECT }>;

/** Read-only views for the internal admin. Every endpoint is ADMIN-only. */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly usage: UsageService,
  ) {}

  async users(query: UsersQuery): Promise<AdminUsersPage> {
    const where: Prisma.UserWhereInput = {
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      // The stored plan is the candidate; the effective plan is checked below.
      ...(query.plan === 'FREE' ? {} : query.plan ? { subscription: { plan: query.plan } } : {}),
    };
    const rows: Row[] = [];
    let cursor = query.cursor;
    // Filtering by effective plan may drop rows (expired paid plans): page until full.
    for (let round = 0; round < 5 && rows.length <= query.limit; round += 1) {
      const batch = await this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: ROW_SELECT,
      });
      rows.push(...batch.filter((row) => !query.plan || this.planOf(row) === query.plan));
      if (batch.length <= query.limit) break;
      cursor = batch.at(-1)!.id;
    }
    const page = rows.slice(0, query.limit);
    return {
      items: page.map((row) => this.toRow(row)),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async user(id: string): Promise<AdminUserDetail> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...ROW_SELECT,
        profile: {
          select: {
            onboardingCompletedAt: true,
            city: true,
            timezone: true,
            locale: true,
            analyticsEnabled: true,
          },
        },
        subscription: {
          select: {
            plan: true,
            status: true,
            provider: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
          },
        },
      },
    });
    if (!row) throw new AppException('NOT_FOUND', 'User not found');

    const [
      archivedItems,
      savedOutfits,
      wears,
      loves,
      dislikes,
      plannedDays,
      items,
      outfits,
      usage,
    ] = await Promise.all([
      this.prisma.clothingItem.count({ where: { userId: id, archivedAt: { not: null } } }),
      this.prisma.outfit.count({ where: { userId: id, isSaved: true } }),
      this.prisma.wearHistory.count({ where: { userId: id } }),
      this.prisma.outfitFeedback.count({ where: { userId: id, rating: 'LOVE' } }),
      this.prisma.outfitFeedback.count({ where: { userId: id, rating: 'DISLIKE' } }),
      this.prisma.calendarEvent.count({ where: { userId: id } }),
      this.prisma.clothingItem.findMany({
        where: { userId: id, archivedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          name: true,
          category: true,
          color: true,
          imageKey: true,
          thumbnailKey: true,
          createdAt: true,
        },
      }),
      this.prisma.outfit.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          name: true,
          occasion: true,
          style: true,
          isSaved: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      }),
      this.usage.summary(id),
    ]);

    return {
      ...this.toRow(row),
      city: row.profile?.city ?? null,
      timezone: row.profile?.timezone ?? 'UTC',
      locale: row.profile?.locale ?? 'fr',
      analyticsEnabled: row.profile?.analyticsEnabled ?? true,
      subscription: {
        status: row.subscription?.status ?? 'ACTIVE',
        provider: row.subscription?.provider ?? 'mock',
        currentPeriodEnd: row.subscription?.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: row.subscription?.cancelAtPeriodEnd ?? false,
      },
      usage: usage.meters,
      counts: {
        items: row._count.clothingItems,
        archivedItems,
        outfits: row._count.outfits,
        savedOutfits,
        wears,
        loves,
        dislikes,
        plannedDays,
      },
      recentItems: await Promise.all(
        items.map(async (item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          color: item.color,
          thumbnailUrl: await this.storage.getSignedUrl(item.thumbnailKey ?? item.imageKey),
          createdAt: item.createdAt.toISOString(),
        })),
      ),
      recentOutfits: outfits.map((outfit) => ({
        id: outfit.id,
        name: outfit.name,
        occasion: outfit.occasion,
        style: outfit.style,
        pieces: outfit._count.items,
        isSaved: outfit.isSaved,
        createdAt: outfit.createdAt.toISOString(),
      })),
    };
  }

  async subscriptions(query: SubscriptionsQuery): Promise<AdminSubscriptions> {
    const rows = await this.prisma.subscription.findMany({
      where: { plan: { not: 'FREE' } },
      orderBy: { updatedAt: 'desc' },
      take: 500,
      select: {
        userId: true,
        plan: true,
        status: true,
        provider: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        user: { select: { email: true } },
      },
    });
    const now = new Date();
    const live = rows.filter((row) => effectivePlan(row, now) !== 'FREE');
    const items = live
      .filter(
        (row) =>
          query.status === 'all' ||
          (query.status === 'canceling' ? row.cancelAtPeriodEnd : !row.cancelAtPeriodEnd),
      )
      .map((row) => ({
        userId: row.userId,
        email: row.user.email,
        plan: row.plan,
        status: row.status,
        provider: row.provider,
        currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        monthlyPriceXof: PLAN_DEFINITIONS[row.plan].monthlyPriceXof,
      }));
    const mrrXof = live
      .filter((row) => !row.cancelAtPeriodEnd)
      .reduce((sum, row) => sum + PLAN_DEFINITIONS[row.plan].monthlyPriceXof, 0);
    return { items, mrrXof };
  }

  private planOf(row: Pick<Row, 'subscription'>): Plan {
    return effectivePlan(row.subscription);
  }

  private toRow(row: Row) {
    return {
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      role: row.role,
      plan: this.planOf(row),
      onboarded: Boolean(row.profile?.onboardingCompletedAt),
      items: row._count.clothingItems,
      outfits: row._count.outfits,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
