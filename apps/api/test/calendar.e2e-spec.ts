import { type INestApplication } from '@nestjs/common';
import {
  addDays,
  calendarEventSchema,
  calendarMonthResponseSchema,
  type Outfit,
  outfitSchema,
  wearHistoryPageSchema,
  weekOf,
} from '@vyra/shared';
import { dateColumn, localDay, startOfLocalDay } from '../src/common/time/local-day';
import { PrismaService } from '../src/prisma/prisma.service';
import { MEN_CLOSET, withCloset } from './closet-fixtures';
import { createTestApp } from './create-test-app';
import { cleanupSuiteUsers, type TestUser } from './helpers';

const TZ = 'Africa/Abidjan';

describe('Calendar and wear history (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const today = () => localDay(new Date(), TZ);
  const monthOf = (day: string) => day.slice(0, 7);

  async function member(plan: 'FREE' | 'PRO', timezone = TZ) {
    const { user, ids } = await withCloset(app, prisma, MEN_CLOSET);
    const userId = user.session.user.id;
    await prisma.profile.update({ where: { userId }, data: { timezone } });
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, plan, status: 'ACTIVE' },
      update: { plan, status: 'ACTIVE' },
    });
    return { user, ids, userId };
  }

  const generate = async (user: TestUser, body: Record<string, unknown> = {}) => {
    const res = await user
      .auth('post', '/api/ai/generate-outfit')
      .send({ occasion: 'WORK', style: 'SMART_CASUAL', ...body })
      .expect(200);
    return outfitSchema.parse(res.body.outfit);
  };
  const month = async (user: TestUser, value: string) =>
    calendarMonthResponseSchema.parse(
      (await user.auth('get', `/api/calendar?month=${value}`).expect(200)).body,
    );
  const shirt = (outfit: Outfit) =>
    outfit.items.find((item) => item.name.startsWith('Chemise'))?.name;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupSuiteUsers(prisma);
    await app.close();
  });

  it('plans, replaces and removes the look of a day', async () => {
    const { user, userId } = await member('PRO');
    const first = await generate(user);
    const second = await generate(user, { excludeOutfitIds: [first.id] });
    const day = addDays(today(), 3);

    const planned = calendarEventSchema.parse(
      (
        await user
          .auth('put', `/api/calendar/${day}`)
          .send({ outfitId: first.id, notes: '  Présentation client  ' })
          .expect(200)
      ).body,
    );
    expect(planned).toMatchObject({ date: day, notes: 'Présentation client', occasion: null });
    expect(planned.outfit.id).toBe(first.id);
    expect(planned.outfit.thumbnails.length).toBeGreaterThan(0);
    expect(planned.outfit.thumbnails[0]).toContain('sig=');

    const view = await month(user, monthOf(day));
    expect(view.access).toBeNull();
    expect(view.today).toBe(today());
    expect(view.days.find((entry) => entry.date === day)?.planned?.outfit.id).toBe(first.id);

    // One look per day: planning again replaces it.
    await user
      .auth('put', `/api/calendar/${day}`)
      .send({ outfitId: second.id, occasion: 'WEDDING' })
      .expect(200);
    expect(await prisma.calendarEvent.count({ where: { userId } })).toBe(1);
    const replaced = await month(user, monthOf(day));
    expect(replaced.days.find((entry) => entry.date === day)?.planned).toMatchObject({
      occasion: 'WEDDING',
      notes: null,
      outfit: { id: second.id },
    });

    await user.auth('delete', `/api/calendar/${day}`).expect(204);
    expect(await prisma.calendarEvent.count({ where: { userId } })).toBe(0);
  });

  it('shows worn looks on their local day', async () => {
    // UTC+14: local mornings are still "yesterday" in UTC.
    const zone = 'Pacific/Kiritimati';
    const { user, userId } = await member('PRO', zone);
    const outfit = await generate(user);
    const localToday = localDay(new Date(), zone);
    const wornAt = new Date(startOfLocalDay(localToday, zone).getTime() + 30 * 60_000);
    await prisma.wearHistory.create({ data: { userId, outfitId: outfit.id, wornAt } });

    const view = await month(user, monthOf(localToday));
    expect(view.today).toBe(localToday);
    const day = view.days.find((entry) => entry.date === localToday);
    expect(day?.worn.map((worn) => worn.id)).toEqual([outfit.id]);
    expect(day?.planned).toBeNull();
  });

  it('keeps FREE to the current week', async () => {
    const { user, userId } = await member('FREE');
    const outfit = await generate(user);
    const week = weekOf(today());
    const outside = addDays(week.to, 1);

    // A look planned outside the week (e.g. while PRO) is not shown.
    await prisma.calendarEvent.create({
      data: { userId, outfitId: outfit.id, date: dateColumn(outside) },
    });

    await user.auth('put', `/api/calendar/${today()}`).send({ outfitId: outfit.id }).expect(200);
    const res = await user
      .auth('put', `/api/calendar/${addDays(week.to, 2)}`)
      .send({ outfitId: outfit.id })
      .expect(402);
    expect(res.body.error).toMatchObject({
      code: 'LIMIT_REACHED',
      details: {
        feature: 'CALENDAR_FULL',
        currentPlan: 'FREE',
        suggestedPlan: 'PRO',
        access: week,
      },
    });
    await user.auth('delete', `/api/calendar/${outside}`).expect(402);

    for (const value of new Set([monthOf(week.from), monthOf(week.to), monthOf(outside)])) {
      const view = await month(user, value);
      expect(view.access).toEqual(week);
      expect(view.days.every((day) => day.date >= week.from && day.date <= week.to)).toBe(true);
    }
    const far = await month(user, monthOf(addDays(today(), 70)));
    expect(far.days).toEqual([]);
  });

  it('validates days, months and outfits', async () => {
    const { user } = await member('PRO');
    const outfit = await generate(user);
    const yesterday = addDays(today(), -1);

    const past = await user
      .auth('put', `/api/calendar/${yesterday}`)
      .send({ outfitId: outfit.id })
      .expect(422);
    expect(past.body.error.details).toEqual({ reason: 'DATE_OUT_OF_RANGE' });
    await user.auth('put', '/api/calendar/2026-02-30').send({ outfitId: outfit.id }).expect(400);
    await user.auth('put', '/api/calendar/demain').send({ outfitId: outfit.id }).expect(400);
    await user
      .auth('put', `/api/calendar/${today()}`)
      .send({ outfitId: outfit.id, notes: 'x'.repeat(121) })
      .expect(400);
    await user.auth('get', '/api/calendar?month=2026-13').expect(400);
    await user.auth('get', '/api/calendar').expect(400);
    // Removing a past day's look is allowed (tidying the calendar).
    await user.auth('delete', `/api/calendar/${yesterday}`).expect(204);
  });

  it("never exposes or plans someone else's looks", async () => {
    const alice = await member('PRO');
    const bob = await member('PRO');
    const outfit = await generate(alice.user);
    const day = addDays(today(), 1);
    await alice.user.auth('put', `/api/calendar/${day}`).send({ outfitId: outfit.id }).expect(200);
    await alice.user.auth('post', `/api/outfits/${outfit.id}/wear`).expect(200);

    await bob.user.auth('put', `/api/calendar/${day}`).send({ outfitId: outfit.id }).expect(404);
    expect((await month(bob.user, monthOf(day))).days).toEqual([]);
    const history = wearHistoryPageSchema.parse(
      (await bob.user.auth('get', '/api/wear-history').expect(200)).body,
    );
    expect(history.items).toEqual([]);
    // Bob deleting "his" day does not touch Alice's plan.
    await bob.user.auth('delete', `/api/calendar/${day}`).expect(204);
    expect(await prisma.calendarEvent.count({ where: { userId: alice.userId } })).toBe(1);
  });

  it('lists the wear history newest first, limited to a week on FREE', async () => {
    const pro = await member('PRO');
    const free = await member('FREE');
    for (const { user, userId } of [pro, free]) {
      const outfit = await generate(user);
      for (const daysAgo of [0, 3, 10]) {
        const day = addDays(today(), -daysAgo);
        await prisma.wearHistory.create({
          data: {
            userId,
            outfitId: outfit.id,
            wornAt: new Date(startOfLocalDay(day, TZ).getTime() + 9 * 3_600_000),
          },
        });
      }
    }

    const proPage1 = wearHistoryPageSchema.parse(
      (await pro.user.auth('get', '/api/wear-history?limit=2').expect(200)).body,
    );
    expect(proPage1.visibleFrom).toBeNull();
    expect(proPage1.items.map((entry) => entry.date)).toEqual([today(), addDays(today(), -3)]);
    const proPage2 = wearHistoryPageSchema.parse(
      (
        await pro.user
          .auth('get', `/api/wear-history?limit=2&cursor=${proPage1.nextCursor}`)
          .expect(200)
      ).body,
    );
    expect(proPage2.items.map((entry) => entry.date)).toEqual([addDays(today(), -10)]);
    expect(proPage2.nextCursor).toBeNull();

    const freePage = wearHistoryPageSchema.parse(
      (await free.user.auth('get', '/api/wear-history').expect(200)).body,
    );
    expect(freePage.visibleFrom).toBe(addDays(today(), -6));
    expect(freePage.items.map((entry) => entry.date)).toEqual([today(), addDays(today(), -3)]);
  });

  it('keeps pieces planned around the target day out of its suggestion', async () => {
    const day = addDays(today(), 4);
    // Control: with nothing planned, this closet's best work look for that day.
    const control = await member('PRO');
    const usual = await generate(control.user, { date: day });
    expect(shirt(usual)).toBeDefined();

    // Same closet; the very same look is planned the day after. It is stored
    // as an old look so only the calendar (not "recently generated") can matter.
    const { user, userId, ids } = await member('PRO');
    const planned = await prisma.outfit.create({
      data: {
        userId,
        name: 'Look prévu',
        occasion: 'WORK',
        style: 'SMART_CASUAL',
        reason: 'Prévu',
        createdAt: new Date(Date.now() - 30 * 86_400_000),
        items: {
          create: usual.items.map((item, position) => ({
            clothingItemId: ids.get(item.name)!,
            position,
          })),
        },
      },
    });
    await user
      .auth('put', `/api/calendar/${addDays(day, 1)}`)
      .send({ outfitId: planned.id })
      .expect(200);

    const next = await generate(user, { date: day });
    expect(shirt(next)).toBeDefined();
    expect(shirt(next)).not.toBe(shirt(usual));
    // How the penalty fades with distance is covered deterministically by the engine unit tests.
  });

  it('refuses to generate for a past day', async () => {
    const { user } = await member('PRO');
    const res = await user
      .auth('post', '/api/ai/generate-outfit')
      .send({ occasion: 'WORK', style: 'SMART_CASUAL', date: addDays(today(), -1) })
      .expect(422);
    expect(res.body.error.details).toEqual({ reason: 'DATE_OUT_OF_RANGE' });
  });
});
