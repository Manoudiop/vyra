import { Injectable } from '@nestjs/common';
import { type AdminMetrics, ANALYTICS_EVENT_NAMES, type Plan, PLANS } from '@vyra/shared';
import { PrismaService } from '../prisma/prisma.service';
import { effectivePlan } from '../subscriptions/plans.service';

const DAY_MS = 86_400_000;
const ratio = (part: number, whole: number) =>
  whole === 0 ? null : Math.round((part / whole) * 1000) / 1000;

/**
 * Basic product metrics for the admin. Users and plans come from the source
 * tables (complete); event counts only reflect users who keep analytics on.
 */
@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async compute(now = new Date()): Promise<AdminMetrics> {
    const week = new Date(now.getTime() - 7 * DAY_MS);
    const month = new Date(now.getTime() - 30 * DAY_MS);
    const [content, aiUsage] = await Promise.all([
      Promise.all([
        this.prisma.clothingItem.count({ where: { archivedAt: null, user: { role: 'USER' } } }),
        this.prisma.outfit.count({ where: { user: { role: 'USER' } } }),
        this.prisma.wearHistory.count({ where: { user: { role: 'USER' } } }),
      ]),
      this.prisma.usage.groupBy({
        by: ['metric'],
        where: { periodStart: { gte: month }, user: { role: 'USER' } },
        _sum: { count: true },
      }),
    ]);
    const [total, recent, onboarded, subscriptions, grouped, ...activity] = await Promise.all([
      this.prisma.user.count({ where: { role: 'USER' } }),
      this.prisma.user.count({ where: { role: 'USER', createdAt: { gte: week } } }),
      this.prisma.profile.count({
        where: { onboardingCompletedAt: { not: null }, user: { role: 'USER' } },
      }),
      this.prisma.subscription.findMany({
        where: { user: { role: 'USER' } },
        select: { plan: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['name'],
        where: { createdAt: { gte: month } },
        _count: { _all: true },
      }),
      // Active = did something this week: generated, wore or added a piece.
      this.prisma.outfit.findMany({
        where: { createdAt: { gte: week }, user: { role: 'USER' } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.wearHistory.findMany({
        where: { createdAt: { gte: week }, user: { role: 'USER' } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.clothingItem.findMany({
        where: { createdAt: { gte: week }, user: { role: 'USER' } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const plans = Object.fromEntries(PLANS.map((plan) => [plan, 0])) as Record<Plan, number>;
    for (const subscription of subscriptions) plans[effectivePlan(subscription, now)] += 1;
    // Users without a subscription row are FREE.
    plans.FREE += Math.max(0, total - subscriptions.length);

    const events = Object.fromEntries(ANALYTICS_EVENT_NAMES.map((name) => [name, 0])) as Record<
      string,
      number
    >;
    for (const row of grouped) events[row.name] = row._count._all;

    const active = new Set(activity.flat().map((row) => row.userId));
    return {
      generatedAt: now.toISOString(),
      users: { total, newLast7Days: recent, activeLast7Days: active.size, onboarded },
      plans,
      content: { clothingItems: content[0], outfits: content[1], wears: content[2] },
      aiUsage: {
        OUTFIT_GENERATION:
          aiUsage.find((row) => row.metric === 'OUTFIT_GENERATION')?._sum.count ?? 0,
        CLOTHING_ANALYSIS:
          aiUsage.find((row) => row.metric === 'CLOTHING_ANALYSIS')?._sum.count ?? 0,
      },
      events,
      rates: {
        paywallConversion: ratio(events.subscription_started ?? 0, events.paywall_viewed ?? 0),
        outfitApproval: ratio(
          events.outfit_liked ?? 0,
          (events.outfit_liked ?? 0) + (events.outfit_disliked ?? 0),
        ),
      },
    };
  }
}
