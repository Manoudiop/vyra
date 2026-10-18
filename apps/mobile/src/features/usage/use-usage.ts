import { useQuery } from '@tanstack/react-query';
import {
  suggestUpgrade,
  type UsageLimitDetails,
  usageLimitDetailsSchema,
  type UsageMetric,
} from '@vyra/shared';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/lib/api-client';
import { usageApi, usageKeys } from './usage-api';

export function useUsage() {
  return useQuery({ queryKey: usageKeys.all, queryFn: usageApi.get });
}

export function useMeter(metric: UsageMetric) {
  return useUsage().data?.meters.find((meter) => meter.metric === metric);
}

/**
 * The feature is used up: known from the refusal (`error`) or, before any
 * attempt, from the counters. Same shape either way.
 */
export function useUsedUp(metric: UsageMetric, error: unknown): UsageLimitDetails | null {
  const usage = useUsage().data;
  const fromError = limitOf(error, metric);
  if (fromError) return fromError;
  const meter = usage?.meters.find((entry) => entry.metric === metric);
  if (!usage || !meter || meter.limit === null || meter.remaining !== 0) return null;
  return {
    metric,
    limit: meter.limit,
    used: meter.used,
    period: meter.period,
    resetsAt: meter.resetsAt,
    currentPlan: usage.plan,
    suggestedPlan: suggestUpgrade(usage.plan, metric),
  };
}

/** The details of a 402 on a metered feature, or null for any other error. */
export function limitOf(error: unknown, metric?: UsageMetric): UsageLimitDetails | null {
  if (!(error instanceof ApiError) || error.code !== 'LIMIT_REACHED') return null;
  const parsed = usageLimitDetailsSchema.safeParse(error.details);
  if (!parsed.success) return null;
  return !metric || parsed.data.metric === metric ? parsed.data : null;
}

/** "lundi 19 octobre" for a reset instant. */
export function useResetDate() {
  const { i18n } = useTranslation();
  return (resetsAt: string) =>
    new Date(resetsAt).toLocaleDateString(i18n.language, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
}
