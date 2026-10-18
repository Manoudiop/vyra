import {
  type CheckoutResponse,
  type PaidPlan,
  type PlanOffer,
  type Subscription,
} from '@vyra/shared';
import { authorizedRequest } from '@/lib/authorized-request';

export const subscriptionKeys = {
  me: ['subscription'] as const,
  plans: ['plans'] as const,
};

export const subscriptionsApi = {
  plans: () => authorizedRequest<PlanOffer[]>('/subscriptions/plans'),
  me: () => authorizedRequest<Subscription>('/subscriptions/me'),
  checkout: (plan: PaidPlan) =>
    authorizedRequest<CheckoutResponse>('/subscriptions/checkout', {
      method: 'POST',
      body: { plan },
    }),
  cancel: () => authorizedRequest<Subscription>('/subscriptions/cancel', { method: 'POST' }),
  resume: () => authorizedRequest<Subscription>('/subscriptions/resume', { method: 'POST' }),
};
