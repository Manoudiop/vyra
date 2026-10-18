import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { BillingProvider } from './billing.provider';
import { MockBillingProvider } from './mock-billing.provider';
import { PlansService } from './plans.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

/** Plans (every feature gate reads PlansService), billing and the subscription endpoints. */
@Global()
@Module({
  controllers: [SubscriptionsController],
  providers: [
    PlansService,
    SubscriptionsService,
    {
      provide: BillingProvider,
      inject: [AppConfigService],
      // Only "mock" exists in the MVP; real providers plug in here.
      useFactory: (config: AppConfigService): BillingProvider => {
        switch (config.get('BILLING_PROVIDER')) {
          case 'mock':
            return new MockBillingProvider();
        }
      },
    },
  ],
  exports: [PlansService, SubscriptionsService],
})
export class SubscriptionsModule {}
