import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminMetricsController, AnalyticsController } from './analytics.controller';
import { AnalyticsProvider } from './analytics.provider';
import { AnalyticsService } from './analytics.service';
import { MetricsService } from './metrics.service';
import { MockAnalyticsProvider } from './mock-analytics.provider';

@Global()
@Module({
  controllers: [AnalyticsController, AdminMetricsController],
  providers: [
    AnalyticsService,
    MetricsService,
    {
      provide: AnalyticsProvider,
      inject: [AppConfigService, PrismaService],
      // Only "mock" exists in the MVP; PostHog/Segment plug in here.
      useFactory: (config: AppConfigService, prisma: PrismaService): AnalyticsProvider => {
        switch (config.get('ANALYTICS_PROVIDER')) {
          case 'mock':
            return new MockAnalyticsProvider(prisma);
        }
      },
    },
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
