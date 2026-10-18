import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type PaidPlan, type Subscription } from '@vyra/shared';
import { calendarKeys } from '@/features/calendar/calendar-api';
import { closetKeys } from '@/features/closet/closet-api';
import { styleKeys } from '@/features/style/style-api';
import { usageKeys } from '@/features/usage/usage-api';
import { haptics } from '@/ui';
import { subscriptionKeys, subscriptionsApi } from './subscriptions-api';

export function useSubscription() {
  return useQuery({ queryKey: subscriptionKeys.me, queryFn: subscriptionsApi.me });
}

export function usePlans() {
  return useQuery({
    queryKey: subscriptionKeys.plans,
    queryFn: subscriptionsApi.plans,
    staleTime: Infinity,
  });
}

/** After any plan change, everything gated by the plan is refetched. */
function usePlanChanged() {
  const queryClient = useQueryClient();
  return (subscription: Subscription) => {
    queryClient.setQueryData(subscriptionKeys.me, subscription);
    for (const key of [usageKeys.all, calendarKeys.all, styleKeys.profile, closetKeys.all]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

export function useCheckout() {
  const planChanged = usePlanChanged();
  return useMutation({
    mutationFn: (plan: PaidPlan) => subscriptionsApi.checkout(plan),
    onSuccess: (result) => {
      haptics.success();
      planChanged(result.subscription);
    },
    onError: () => haptics.error(),
  });
}

export function useCancelSubscription() {
  const planChanged = usePlanChanged();
  return useMutation({
    mutationFn: () => subscriptionsApi.cancel(),
    onSuccess: planChanged,
    onError: () => haptics.error(),
  });
}

export function useResumeSubscription() {
  const planChanged = usePlanChanged();
  return useMutation({
    mutationFn: () => subscriptionsApi.resume(),
    onSuccess: (subscription) => {
      haptics.success();
      planChanged(subscription);
    },
    onError: () => haptics.error(),
  });
}

export type PaywallReason =
  'generations' | 'analyses' | 'calendar' | 'history' | 'style' | 'closet';
