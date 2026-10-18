import { Injectable, Logger } from '@nestjs/common';
import {
  getMeteredLimit,
  type Plan,
  suggestUpgrade,
  type UsageLimitDetails,
  type UsageMeter,
  type UsageMetric,
  USAGE_METRICS,
  type UsageResponse,
} from '@vyra/shared';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../subscriptions/plans.service';
import { usageWindow } from './usage-period';

const LIMIT_MESSAGES: Record<UsageMetric, string> = {
  OUTFIT_GENERATION: 'You have used all the outfit generations of your plan for this period.',
  CLOTHING_ANALYSIS: 'You have used all the clothing analyses of your plan for this period.',
};

/**
 * Counts metered features per plan (decisions in docs/IMPLEMENTATION_PLAN.md
 * §4). `meter` reserves one unit atomically before the work and gives it back
 * if the work fails, so only delivered results are counted and two parallel
 * requests can never exceed the limit.
 */
@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
  ) {}

  async meter<T>(userId: string, metric: UsageMetric, work: () => Promise<T>): Promise<T> {
    const reservation = await this.reserve(userId, metric);
    try {
      return await work();
    } catch (error) {
      await this.release(reservation).catch((releaseError: unknown) =>
        this.logger.error(
          `Could not release ${metric} for ${userId}: ${
            releaseError instanceof Error ? releaseError.message : String(releaseError)
          }`,
        ),
      );
      throw error;
    }
  }

  async summary(userId: string): Promise<UsageResponse> {
    const [plan, timezone] = await Promise.all([
      this.plans.currentPlan(userId),
      this.timezoneOf(userId),
    ]);
    const meters = await Promise.all(
      USAGE_METRICS.map(async (metric): Promise<UsageMeter> => {
        const { limit, period } = getMeteredLimit(plan, metric);
        const window = usageWindow(period, timezone);
        const row = await this.prisma.usage.findUnique({
          where: { userId_metric_periodStart: { userId, metric, periodStart: window.start } },
          select: { count: true },
        });
        const used = row?.count ?? 0;
        return {
          metric,
          used,
          limit,
          remaining: limit === null ? null : Math.max(0, limit - used),
          period,
          resetsAt: window.resetsAt.toISOString(),
        };
      }),
    );
    return { plan, meters };
  }

  /** Takes one unit, or throws 402 LIMIT_REACHED with what the app needs to explain it. */
  private async reserve(userId: string, metric: UsageMetric) {
    const [plan, timezone] = await Promise.all([
      this.plans.currentPlan(userId),
      this.timezoneOf(userId),
    ]);
    const { limit, period } = getMeteredLimit(plan, metric);
    const window = usageWindow(period, timezone);
    const key = { userId_metric_periodStart: { userId, metric, periodStart: window.start } };

    await this.ensureRow(userId, metric, window.start);
    // A single conditional UPDATE: Postgres locks the row, so concurrent
    // requests are serialized and the count never goes past the limit.
    const taken = await this.prisma.usage.updateMany({
      where: {
        userId,
        metric,
        periodStart: window.start,
        ...(limit === null ? {} : { count: { lt: limit } }),
      },
      data: { count: { increment: 1 } },
    });
    if (taken.count === 0) {
      const row = await this.prisma.usage.findUnique({ where: key, select: { count: true } });
      throw this.limitReached(plan, metric, limit!, row?.count ?? limit!, period, window.resetsAt);
    }
    return { userId, metric, periodStart: window.start };
  }

  private async release(reservation: { userId: string; metric: UsageMetric; periodStart: Date }) {
    await this.prisma.usage.updateMany({
      where: { ...reservation, count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    });
  }

  private async ensureRow(userId: string, metric: UsageMetric, periodStart: Date) {
    try {
      await this.prisma.usage.upsert({
        where: { userId_metric_periodStart: { userId, metric, periodStart } },
        create: { userId, metric, periodStart, count: 0 },
        update: {},
      });
    } catch (error) {
      // Two first requests of a period raced to create the row: it exists now.
      if ((error as { code?: string }).code !== 'P2002') throw error;
    }
  }

  private limitReached(
    plan: Plan,
    metric: UsageMetric,
    limit: number,
    used: number,
    period: UsageLimitDetails['period'],
    resetsAt: Date,
  ) {
    const details: UsageLimitDetails = {
      metric,
      limit,
      used,
      period,
      resetsAt: resetsAt.toISOString(),
      currentPlan: plan,
      suggestedPlan: suggestUpgrade(plan, metric),
    };
    return new AppException('LIMIT_REACHED', LIMIT_MESSAGES[metric], details);
  }

  private async timezoneOf(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    return profile?.timezone ?? 'UTC';
  }
}
