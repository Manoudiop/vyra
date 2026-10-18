import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ANALYTICS_EVENTS, type AnalyticsEventName, type AnalyticsProperties } from '@vyra/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsProvider } from './analytics.provider';

/** Stored events older than this are deleted (13 months, the usual analytics retention). */
export const RETENTION_DAYS = 395;
const PURGE_EVERY_MS = 24 * 3_600_000;

/**
 * Records product events. Tracking is a side effect, never a dependency: it
 * runs in the background, cannot slow down or fail the request that caused
 * it, drops anything outside the event's schema, and does nothing for users
 * who turned analytics off.
 */
@Injectable()
export class AnalyticsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly inFlight = new Set<Promise<void>>();
  private purgeTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly provider: AnalyticsProvider,
    private readonly prisma: PrismaService,
  ) {}

  /** Fire-and-forget: call without awaiting. */
  track<E extends AnalyticsEventName>(
    userId: string | null,
    name: E,
    properties: AnalyticsProperties<E>,
  ): void {
    const task = this.record(userId, name, properties).finally(() => this.inFlight.delete(task));
    this.inFlight.add(task);
  }

  /** Waits for events being recorded (tests, graceful shutdown). */
  async flush(): Promise<void> {
    while (this.inFlight.size) await Promise.allSettled([...this.inFlight]);
  }

  async purgeExpired(now = new Date()): Promise<number> {
    const { count } = await this.prisma.analyticsEvent.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 86_400_000) } },
    });
    return count;
  }

  onModuleInit(): void {
    const purge = () =>
      void this.purgeExpired().catch((error: unknown) =>
        this.logger.warn(
          `Analytics purge failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    purge();
    this.purgeTimer = setInterval(purge, PURGE_EVERY_MS);
    this.purgeTimer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
    await this.flush();
  }

  private async record(userId: string | null, name: AnalyticsEventName, properties: unknown) {
    try {
      const parsed = ANALYTICS_EVENTS[name].safeParse(properties);
      if (!parsed.success) {
        // A tracking bug must not leak data: drop the event, keep a trace.
        this.logger.warn(`Dropped ${name}: properties outside its schema`);
        return;
      }
      if (userId) {
        const profile = await this.prisma.profile.findUnique({
          where: { userId },
          select: { analyticsEnabled: true },
        });
        if (profile && !profile.analyticsEnabled) return;
      }
      await this.provider.track({
        name,
        userId,
        properties: parsed.data as Record<string, unknown>,
        occurredAt: new Date(),
      });
    } catch (error) {
      this.logger.warn(
        `Could not record ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
