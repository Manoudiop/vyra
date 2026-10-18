import { Logger } from '@nestjs/common';
import { type Prisma } from '../generated/prisma/client';
import { type PrismaService } from '../prisma/prisma.service';
import { AnalyticsProvider, type TrackedEvent } from './analytics.provider';

/** Development sink: one structured log line per event, stored for the admin metrics. */
export class MockAnalyticsProvider extends AnalyticsProvider {
  readonly name = 'mock';
  private readonly logger = new Logger('Analytics');

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async track(event: TrackedEvent): Promise<void> {
    // Logs carry no user id: the event name and its (non-personal) properties suffice.
    this.logger.log(JSON.stringify({ event: event.name, properties: event.properties }));
    await this.prisma.analyticsEvent.create({
      data: {
        userId: event.userId,
        name: event.name,
        properties: event.properties as Prisma.InputJsonValue,
        createdAt: event.occurredAt,
      },
    });
  }
}
