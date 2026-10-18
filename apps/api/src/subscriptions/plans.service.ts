import { Injectable } from '@nestjs/common';
import { type Plan } from '@vyra/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface SubscriptionState {
  plan: Plan;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * The plan in effect. Active or trialing subscriptions count; a canceled one
 * keeps its plan until the end of the period already paid; anything else
 * (past due, expired) falls back to FREE. A paid period that ended without
 * cancellation is being renewed by the billing provider and still counts.
 */
export function effectivePlan(subscription: SubscriptionState | null, now = new Date()): Plan {
  if (!subscription || !['ACTIVE', 'TRIALING'].includes(subscription.status)) return 'FREE';
  if (
    subscription.cancelAtPeriodEnd &&
    subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd <= now
  ) {
    return 'FREE';
  }
  return subscription.plan;
}

/** Reads the user's effective plan for every feature gate. */
@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async currentPlan(userId: string): Promise<Plan> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
    });
    return effectivePlan(subscription);
  }
}
