import { type PaidPlan } from '@vyra/shared';

export interface CheckoutInput {
  userId: string;
  email: string;
  plan: PaidPlan;
  /** Monthly price in FCFA, from PLAN_DEFINITIONS. */
  amountXof: number;
}

export interface CheckoutResult {
  /** COMPLETED: paid now. PENDING: the user pays at `paymentUrl`, a webhook confirms later. */
  status: 'COMPLETED' | 'PENDING';
  providerRef: string;
  paymentUrl: string | null;
}

/**
 * The only billing interface the app knows. The MVP ships `MockBillingProvider`
 * (simulated payment, nothing is charged). Real options — store in-app
 * purchases (RevenueCat) or a Mobile Money aggregator (CinetPay, PayDunya,
 * Wave…) — plug in here; see docs/IMPLEMENTATION_PLAN.md §6 for the store
 * policy question that decides which.
 */
export abstract class BillingProvider {
  abstract readonly name: string;
  abstract createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Stop renewing at the end of the current period. */
  abstract cancelSubscription(providerRef: string): Promise<void>;
  /** Undo a cancellation before the period ends. */
  abstract resumeSubscription(providerRef: string): Promise<void>;
}
