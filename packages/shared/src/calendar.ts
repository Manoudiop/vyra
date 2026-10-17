import { z } from 'zod';
import { occasionSchema, styleSchema } from './catalog';

/**
 * Calendar days are plain "YYYY-MM-DD" strings in the user's timezone: a day
 * is a day wherever the server runs. Arithmetic goes through UTC midnight,
 * which has no DST, so adding days is always exact.
 */
const DAY_MS = 86_400_000;

function toUtc(day: string): Date {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, date));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export const calendarDateSchema = z
  .string()
  .regex(DAY_FORMAT, 'Expected YYYY-MM-DD')
  // Zod still runs refinements after a failed regex: never parse a malformed value.
  .refine((day) => !DAY_FORMAT.test(day) || fromUtc(toUtc(day)) === day, 'Not a real date');

export const calendarMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM');

export function addDays(day: string, days: number): string {
  return fromUtc(new Date(toUtc(day).getTime() + days * DAY_MS));
}

/** Signed number of days from `from` to `to`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS);
}

/** Monday to Sunday of the week containing `day`. */
export function weekOf(day: string): { from: string; to: string } {
  const sinceMonday = (toUtc(day).getUTCDay() + 6) % 7;
  const from = addDays(day, -sinceMonday);
  return { from, to: addDays(from, 6) };
}

/** First and last day of a "YYYY-MM" month. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, index] = month.split('-').map(Number) as [number, number];
  const from = fromUtc(new Date(Date.UTC(year, index - 1, 1)));
  const to = fromUtc(new Date(Date.UTC(year, index, 0)));
  return { from, to };
}

export function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split('-').map(Number) as [number, number];
  return fromUtc(new Date(Date.UTC(year, index - 1 + delta, 1))).slice(0, 7);
}

/** Days of the month grid, weeks starting on Monday; `null` pads the edges. */
export function monthGrid(month: string): (string | null)[][] {
  const { from, to } = monthRange(month);
  const lead = (toUtc(from).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = from; day <= to; day = addDays(day, 1)) cells.push(day);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

/** How far ahead a look can be planned. */
export const PLAN_AHEAD_DAYS = 365;

/** A look as shown in the calendar and the wear history. */
export const outfitSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  occasion: occasionSchema,
  style: styleSchema,
  /** Up to four piece thumbnails (signed URLs), in display order. */
  thumbnails: z.array(z.string()).max(4),
});
export type OutfitSummary = z.infer<typeof outfitSummarySchema>;

export const calendarEventSchema = z.object({
  id: z.string(),
  date: calendarDateSchema,
  occasion: occasionSchema.nullable(),
  notes: z.string().nullable(),
  outfit: outfitSummarySchema,
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

export const calendarDaySchema = z.object({
  date: calendarDateSchema,
  planned: calendarEventSchema.nullable(),
  /** Looks actually worn that day (usually one). */
  worn: z.array(outfitSummarySchema),
});
export type CalendarDay = z.infer<typeof calendarDaySchema>;

/** Days the plan can see and plan; `null` means no restriction (PRO+). */
export const calendarAccessSchema = z
  .object({ from: calendarDateSchema, to: calendarDateSchema })
  .nullable();
export type CalendarAccess = z.infer<typeof calendarAccessSchema>;

export const calendarMonthQuerySchema = z.object({ month: calendarMonthSchema });

export const calendarMonthResponseSchema = z.object({
  month: calendarMonthSchema,
  /** Today in the user's timezone. */
  today: calendarDateSchema,
  /** Only days with a planned or worn look, in order. */
  days: z.array(calendarDaySchema),
  access: calendarAccessSchema,
});
export type CalendarMonth = z.infer<typeof calendarMonthResponseSchema>;

export const planDayInputSchema = z.object({
  outfitId: z.uuid(),
  occasion: occasionSchema.optional(),
  notes: z.string().trim().max(120).optional(),
});
export type PlanDayInput = z.infer<typeof planDayInputSchema>;

export const wearHistoryEntrySchema = z.object({
  id: z.string(),
  wornAt: z.string(),
  /** Local calendar day of the wear. */
  date: calendarDateSchema,
  outfit: outfitSummarySchema,
});
export type WearHistoryEntry = z.infer<typeof wearHistoryEntrySchema>;

export const WEAR_HISTORY_PAGE_SIZE = 20;
/** FREE sees the last week of history; the full history is PRO. */
export const FREE_WEAR_HISTORY_DAYS = 7;

export const wearHistoryQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(WEAR_HISTORY_PAGE_SIZE),
});

export const wearHistoryPageSchema = z.object({
  items: z.array(wearHistoryEntrySchema),
  nextCursor: z.string().nullable(),
  /** Oldest visible day when the plan limits history, else `null`. */
  visibleFrom: calendarDateSchema.nullable(),
});
export type WearHistoryPage = z.infer<typeof wearHistoryPageSchema>;
