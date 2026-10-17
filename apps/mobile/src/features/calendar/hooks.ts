import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Outfit, type OutfitSummary, type PlanDayInput } from '@vyra/shared';
import { useTranslation } from 'react-i18next';
import { haptics } from '@/ui';
import { calendarApi, calendarKeys } from './calendar-api';

export function useCalendarMonth(month: string) {
  return useQuery({
    queryKey: calendarKeys.month(month),
    queryFn: () => calendarApi.month(month),
    placeholderData: (previous) => previous,
  });
}

export function usePlanDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ date, ...body }: PlanDayInput & { date: string }) =>
      calendarApi.plan(date, body),
    onSuccess: () => {
      haptics.success();
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    },
    onError: () => haptics.error(),
  });
}

export function useUnplanDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => calendarApi.unplan(date),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: calendarKeys.all }),
    onError: () => haptics.error(),
  });
}

/** Calendar days are "YYYY-MM-DD"; format them as the day itself, whatever the device timezone. */
export function useDayFormat() {
  const { i18n } = useTranslation();
  return (day: string, options: Intl.DateTimeFormatOptions) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString(i18n.language, { ...options, timeZone: 'UTC' });
}

/** The calendar's view of a full outfit: its first four piece thumbnails. */
export function summaryOf(outfit: Outfit): OutfitSummary {
  return {
    id: outfit.id,
    name: outfit.name,
    occasion: outfit.occasion,
    style: outfit.style,
    thumbnails: outfit.items.slice(0, 4).map((item) => item.thumbnailUrl),
  };
}
