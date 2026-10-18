import { randomUUID } from 'node:crypto';
import { BillingProvider, type CheckoutInput, type CheckoutResult } from './billing.provider';

/** Simulated billing for development and demos: payment succeeds at once, nothing is charged. */
export class MockBillingProvider extends BillingProvider {
  readonly name = 'mock';

  createCheckout(_input: CheckoutInput): Promise<CheckoutResult> {
    return Promise.resolve({
      status: 'COMPLETED',
      providerRef: `mock_${randomUUID()}`,
      paymentUrl: null,
    });
  }

  cancelSubscription(_providerRef: string): Promise<void> {
    return Promise.resolve();
  }

  resumeSubscription(_providerRef: string): Promise<void> {
    return Promise.resolve();
  }
}
