import { addDays, type UsagePeriod, weekOf } from '@vyra/shared';
import { localDay, startOfLocalDay } from '../common/time/local-day';

/**
 * The usage window containing `at`, in the user's timezone: a "day" ends at
 * their midnight, weeks start on their Monday, months on their 1st. Returns
 * the instants the window starts and resets.
 */
export function usageWindow(
  period: UsagePeriod,
  timezone: string,
  at: Date = new Date(),
): { start: Date; resetsAt: Date } {
  const today = localDay(at, timezone);
  let first: string;
  let next: string;
  if (period === 'DAY') {
    first = today;
    next = addDays(today, 1);
  } else if (period === 'WEEK') {
    first = weekOf(today).from;
    next = addDays(first, 7);
  } else {
    first = `${today.slice(0, 7)}-01`;
    const [year, month] = today.split('-').map(Number) as [number, number];
    next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  }
  return { start: startOfLocalDay(first, timezone), resetsAt: startOfLocalDay(next, timezone) };
}
