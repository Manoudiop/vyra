import { Injectable } from '@nestjs/common';
import { type Plan } from '@vyra/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Reads the user's effective plan; an inactive subscription falls back to FREE. */
@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async currentPlan(userId: string): Promise<Plan> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true },
    });
    return subscription && ['ACTIVE', 'TRIALING'].includes(subscription.status)
      ? subscription.plan
      : 'FREE';
  }
}
