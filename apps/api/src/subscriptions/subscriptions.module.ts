import { Global, Module } from '@nestjs/common';
import { PlansService } from './plans.service';

/** Plan lookup for every feature gate. Payments and the paywall arrive in phase 15. */
@Global()
@Module({
  providers: [PlansService],
  exports: [PlansService],
})
export class SubscriptionsModule {}
