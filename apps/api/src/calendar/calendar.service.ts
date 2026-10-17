import { HttpStatus, Injectable } from '@nestjs/common';
import {
  addDays,
  type CalendarAccess,
  type CalendarDay,
  type CalendarEvent,
  type CalendarMonth,
  daysBetween,
  FREE_WEAR_HISTORY_DAYS,
  monthRange,
  type OutfitSummary,
  PLAN_AHEAD_DAYS,
  type PlanDayInput,
  planHasFeature,
  type WearHistoryPage,
  type wearHistoryQuerySchema,
  weekOf,
} from '@vyra/shared';
import { type z } from 'zod';
import { AppException } from '../common/errors/app.exception';
import { dateColumn, dayOfDateColumn, localDay, startOfLocalDay } from '../common/time/local-day';
import { type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PlansService } from '../subscriptions/plans.service';

type WearHistoryQuery = z.output<typeof wearHistoryQuerySchema>;

/** What the calendar and history need to show a look. */
const SUMMARY_SELECT = {
  id: true,
  name: true,
  occasion: true,
  style: true,
  items: {
    orderBy: { position: 'asc' },
    take: 4,
    select: { clothingItem: { select: { imageKey: true, thumbnailKey: true } } },
  },
} satisfies Prisma.OutfitSelect;
type SummaryRow = Prisma.OutfitGetPayload<{ select: typeof SUMMARY_SELECT }>;

interface UserClock {
  timezone: string;
  today: string;
  /** Days the plan may see and plan; `null` = no restriction. */
  access: CalendarAccess;
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly plans: PlansService,
  ) {}

  /**
   * A month of planned and worn looks. FREE only sees the current week
   * (decision 2026-10-17): other days are not returned at all, and the app
   * shows them locked.
   */
  async month(userId: string, month: string): Promise<CalendarMonth> {
    const clock = await this.clock(userId);
    let { from, to } = monthRange(month);
    if (clock.access) {
      from = from > clock.access.from ? from : clock.access.from;
      to = to < clock.access.to ? to : clock.access.to;
    }
    if (from > to) return { month, today: clock.today, days: [], access: clock.access };

    const [events, wears] = await Promise.all([
      this.prisma.calendarEvent.findMany({
        where: { userId, date: { gte: dateColumn(from), lte: dateColumn(to) } },
        select: {
          id: true,
          date: true,
          occasion: true,
          notes: true,
          outfit: { select: SUMMARY_SELECT },
        },
      }),
      this.prisma.wearHistory.findMany({
        where: {
          userId,
          wornAt: {
            gte: startOfLocalDay(from, clock.timezone),
            lt: startOfLocalDay(addDays(to, 1), clock.timezone),
          },
        },
        orderBy: { wornAt: 'asc' },
        select: { wornAt: true, outfit: { select: SUMMARY_SELECT } },
      }),
    ]);

    const days = new Map<string, CalendarDay>();
    const dayOf = (date: string) => {
      let day = days.get(date);
      if (!day) {
        day = { date, planned: null, worn: [] };
        days.set(date, day);
      }
      return day;
    };
    for (const event of events) {
      dayOf(dayOfDateColumn(event.date)).planned = await this.eventDto(event);
    }
    for (const wear of wears) {
      const day = dayOf(localDay(wear.wornAt, clock.timezone));
      // The same look worn twice in a day (two separate records) shows once.
      if (!day.worn.some((outfit) => outfit.id === wear.outfit.id)) {
        day.worn.push(await this.summary(wear.outfit));
      }
    }
    return {
      month,
      today: clock.today,
      days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
      access: clock.access,
    };
  }

  /** Plans (or replaces) the look of a day: one look per day in the MVP. */
  async plan(userId: string, date: string, input: PlanDayInput): Promise<CalendarEvent> {
    const clock = await this.clock(userId);
    const ahead = daysBetween(clock.today, date);
    if (ahead < 0 || ahead > PLAN_AHEAD_DAYS) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Looks can be planned for today or an upcoming day.',
        { reason: 'DATE_OUT_OF_RANGE' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    await this.assertAccess(userId, clock, date);
    const outfit = await this.prisma.outfit.findFirst({
      where: { id: input.outfitId, userId },
      select: { id: true },
    });
    if (!outfit) throw new AppException('NOT_FOUND', 'Outfit not found');

    const data = {
      outfitId: outfit.id,
      occasion: input.occasion ?? null,
      notes: input.notes ? input.notes : null,
    };
    const event = await this.prisma.calendarEvent.upsert({
      where: { userId_date: { userId, date: dateColumn(date) } },
      create: { userId, date: dateColumn(date), ...data },
      update: data,
      select: {
        id: true,
        date: true,
        occasion: true,
        notes: true,
        outfit: { select: SUMMARY_SELECT },
      },
    });
    return this.eventDto(event);
  }

  /** Removes the planned look of a day (past days included, to tidy the calendar). */
  async unplan(userId: string, date: string): Promise<void> {
    const clock = await this.clock(userId);
    await this.assertAccess(userId, clock, date);
    await this.prisma.calendarEvent.deleteMany({ where: { userId, date: dateColumn(date) } });
  }

  /** Worn looks, newest first. FREE sees the last 7 days; the full history is PRO. */
  async wearHistory(userId: string, query: WearHistoryQuery): Promise<WearHistoryPage> {
    const clock = await this.clock(userId);
    const visibleFrom = clock.access ? addDays(clock.today, -(FREE_WEAR_HISTORY_DAYS - 1)) : null;
    const rows = await this.prisma.wearHistory.findMany({
      where: {
        userId,
        ...(visibleFrom ? { wornAt: { gte: startOfLocalDay(visibleFrom, clock.timezone) } } : {}),
      },
      orderBy: [{ wornAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: { id: true, wornAt: true, outfit: { select: SUMMARY_SELECT } },
    });
    const page = rows.slice(0, query.limit);
    return {
      items: await Promise.all(
        page.map(async (row) => ({
          id: row.id,
          wornAt: row.wornAt.toISOString(),
          date: localDay(row.wornAt, clock.timezone),
          outfit: await this.summary(row.outfit),
        })),
      ),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
      visibleFrom,
    };
  }

  private async clock(userId: string): Promise<UserClock> {
    const [profile, plan] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { timezone: true } }),
      this.plans.currentPlan(userId),
    ]);
    const timezone = profile?.timezone ?? 'UTC';
    const today = localDay(new Date(), timezone);
    return {
      timezone,
      today,
      access: planHasFeature(plan, 'CALENDAR_FULL') ? null : weekOf(today),
    };
  }

  private async assertAccess(userId: string, clock: UserClock, date: string) {
    if (!clock.access || (date >= clock.access.from && date <= clock.access.to)) return;
    throw new AppException(
      'LIMIT_REACHED',
      'Planning beyond the current week is part of VYRA Pro.',
      {
        feature: 'CALENDAR_FULL',
        currentPlan: await this.plans.currentPlan(userId),
        suggestedPlan: 'PRO',
        access: clock.access,
      },
    );
  }

  private async eventDto(event: {
    id: string;
    date: Date;
    occasion: CalendarEvent['occasion'];
    notes: string | null;
    outfit: SummaryRow;
  }): Promise<CalendarEvent> {
    return {
      id: event.id,
      date: dayOfDateColumn(event.date),
      occasion: event.occasion,
      notes: event.notes,
      outfit: await this.summary(event.outfit),
    };
  }

  private async summary(outfit: SummaryRow): Promise<OutfitSummary> {
    return {
      id: outfit.id,
      name: outfit.name,
      occasion: outfit.occasion,
      style: outfit.style,
      thumbnails: await Promise.all(
        outfit.items.map(({ clothingItem }) =>
          this.storage.getSignedUrl(clothingItem.thumbnailKey ?? clothingItem.imageKey),
        ),
      ),
    };
  }
}
