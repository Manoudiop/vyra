import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  type CheckoutResponse,
  type PaidPlan,
  PLAN_DEFINITIONS,
  type PlanOffer,
  PLANS,
  type Subscription,
  USAGE_METRICS,
} from '@vyra/shared';
import { AppException } from '../common/errors/app.exception';
import { AppConfigService } from '../config/app-config.service';
import { type Subscription as SubscriptionRow } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingProvider } from './billing.provider';
import { effectivePlan } from './plans.service';

/** One calendar month later (31 Jan → 28/29 Feb, not 3 Mar). */
export function addMonth(date: Date): Date {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingProvider,
    private readonly config: AppConfigService,
  ) {}

  /** The plans, prices in FCFA and what each one unlocks — one source: PLAN_DEFINITIONS. */
  offers(): PlanOffer[] {
    return PLANS.map((plan) => {
      const definition = PLAN_DEFINITIONS[plan];
      return {
        plan,
        monthlyPriceXof: definition.monthlyPriceXof,
        maxClothingItems: definition.maxClothingItems,
        metered: USAGE_METRICS.map((metric) => ({ metric, ...definition.metered[metric] })),
        features: [...definition.features],
      };
    });
  }

  async get(userId: string): Promise<Subscription> {
    return this.toDto(await this.sync(userId));
  }

  /**
   * Subscribe to a paid plan, or switch between paid plans. The mock bills
   * at once and starts a fresh month; a real provider may answer PENDING with
   * a payment page, and its webhook will activate the plan.
   */
  async checkout(userId: string, email: string, plan: PaidPlan): Promise<CheckoutResponse> {
    const current = await this.sync(userId);
    const active = effectivePlan(current);
    if (active === plan) {
      if (current.cancelAtPeriodEnd) {
        // Coming back to the plan still running: just stop the cancellation.
        return { status: 'COMPLETED', paymentUrl: null, subscription: await this.resume(userId) };
      }
      throw new AppException('CONFLICT', `You are already on ${plan}.`, {
        reason: 'ALREADY_SUBSCRIBED',
      });
    }

    // Simulated payments must never unlock paid plans in production.
    if (this.billing.name === 'mock' && this.config.isProduction) {
      throw new AppException('FORBIDDEN', 'Payments are not available yet.', {
        reason: 'BILLING_UNAVAILABLE',
      });
    }
    const result = await this.billing.createCheckout({
      userId,
      email,
      plan,
      amountXof: PLAN_DEFINITIONS[plan].monthlyPriceXof,
    });
    if (result.status === 'PENDING') {
      return {
        status: 'PENDING',
        paymentUrl: result.paymentUrl,
        subscription: this.toDto(current),
      };
    }

    const now = new Date();
    const row = await this.prisma.subscription.update({
      where: { userId },
      data: {
        plan,
        status: 'ACTIVE',
        provider: this.billing.name,
        providerRef: result.providerRef,
        currentPeriodStart: now,
        currentPeriodEnd: addMonth(now),
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    });
    this.logger.log(`Subscription ${userId}: ${active} -> ${plan} (${this.billing.name})`);
    return { status: 'COMPLETED', paymentUrl: null, subscription: this.toDto(row) };
  }

  /** Stop renewing. The plan stays until the end of the month already paid. */
  async cancel(userId: string): Promise<Subscription> {
    const current = await this.sync(userId);
    if (effectivePlan(current) === 'FREE') {
      throw new AppException('CONFLICT', 'There is no paid plan to cancel.', {
        reason: 'NOTHING_TO_CANCEL',
      });
    }
    if (current.cancelAtPeriodEnd) return this.toDto(current);
    if (current.providerRef) await this.billing.cancelSubscription(current.providerRef);
    const row = await this.prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
    });
    return this.toDto(row);
  }

  /** Undo a cancellation while the paid period is still running. */
  async resume(userId: string): Promise<Subscription> {
    const current = await this.sync(userId);
    if (!current.cancelAtPeriodEnd || effectivePlan(current) === 'FREE') {
      throw new AppException(
        'CONFLICT',
        'There is no cancellation to undo.',
        { reason: 'NOTHING_TO_RESUME' },
        HttpStatus.CONFLICT,
      );
    }
    if (current.providerRef) await this.billing.resumeSubscription(current.providerRef);
    const row = await this.prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: false, canceledAt: null },
    });
    return this.toDto(row);
  }

  /**
   * Brings the stored subscription up to date: a canceled plan whose month is
   * over expires; an uncanceled one is renewed month by month (the mock
   * provider "charges" automatically; a real one would confirm by webhook).
   */
  private async sync(userId: string): Promise<SubscriptionRow> {
    const row =
      (await this.prisma.subscription.findUnique({ where: { userId } })) ??
      (await this.prisma.subscription.create({
        data: { userId, plan: 'FREE', status: 'ACTIVE', provider: this.billing.name },
      }));
    const now = new Date();
    if (row.plan === 'FREE' || !row.currentPeriodEnd || row.currentPeriodEnd > now) return row;
    if (!['ACTIVE', 'TRIALING'].includes(row.status)) return row;

    if (row.cancelAtPeriodEnd) {
      return this.prisma.subscription.update({
        where: { userId },
        data: {
          plan: 'FREE',
          status: 'ACTIVE',
          cancelAtPeriodEnd: false,
          currentPeriodStart: null,
          currentPeriodEnd: null,
        },
      });
    }
    let start = row.currentPeriodEnd;
    let end = addMonth(start);
    while (end <= now) {
      start = end;
      end = addMonth(start);
    }
    return this.prisma.subscription.update({
      where: { userId },
      data: { currentPeriodStart: start, currentPeriodEnd: end },
    });
  }

  private toDto(row: SubscriptionRow): Subscription {
    return {
      plan: effectivePlan(row),
      status: row.status,
      provider: row.provider,
      currentPeriodStart: row.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      canceledAt: row.canceledAt?.toISOString() ?? null,
    };
  }
}
