/**
 * Development seed: realistic demo accounts, closets, outfits, feedback, wear
 * history, calendar and usage. Idempotent — demo accounts are deleted and
 * recreated on every run. Refuses to run in production.
 *
 *   pnpm db:seed
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { getMeteredLimit, getPeriodStart } from '@vyra/shared';
import { config as loadEnv } from 'dotenv';
import { hashPassword } from '../../src/common/security/password';
import { PrismaClient } from '../../src/generated/prisma/client';
import { DEMO_USERS, type DemoUser } from './demo-data';
import { renderGarment } from './garment-images';

loadEnv({ path: ['.env', '../../.env'], quiet: true });

const DAY_MS = 24 * 60 * 60 * 1000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required to run the seed (see .env.example)`);
  return value;
}

/** UTC midnight `days` from today, for `@db.Date` columns. */
function calendarDay(days: number, now: Date): Date {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(day.getTime() + days * DAY_MS);
}

/** A morning timestamp `daysAgo` days back. */
function morningOf(daysAgo: number, now: Date): Date {
  const day = calendarDay(-daysAgo, now);
  return new Date(day.getTime() + 8.5 * 60 * 60 * 1000);
}

async function writeObject(storageRoot: string, key: string, data: Buffer): Promise<void> {
  const target = resolve(storageRoot, key);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
}

async function seedUser(
  prisma: PrismaClient,
  demo: DemoUser,
  passwordHash: string,
  storageRoot: string,
  now: Date,
): Promise<{ items: number; outfits: number }> {
  const user = await prisma.user.create({
    data: {
      email: demo.email,
      passwordHash,
      firstName: demo.firstName,
      lastName: demo.lastName,
      role: demo.role,
      profile: {
        create: { ...demo.profile, locale: 'fr', onboardingCompletedAt: now },
      },
      subscription: {
        create:
          demo.plan === 'FREE'
            ? { plan: 'FREE', status: 'ACTIVE', provider: 'mock' }
            : {
                plan: demo.plan,
                status: 'ACTIVE',
                provider: 'mock',
                providerRef: `mock_sub_${demo.email}`,
                currentPeriodStart: calendarDay(-10, now),
                currentPeriodEnd: calendarDay(20, now),
              },
      },
    },
  });

  // Closet, with generated product images written where LocalStorageAdapter reads them.
  const itemIds = new Map<string, string>();
  for (const [index, demoItem] of demo.items.entries()) {
    const created = await prisma.clothingItem.create({
      data: {
        userId: user.id,
        name: demoItem.name,
        category: demoItem.category,
        subcategory: demoItem.subcategory,
        color: demoItem.color,
        colorHex: demoItem.art.colorHex.toUpperCase(),
        style: demoItem.style,
        season: demoItem.season,
        isFavorite: demoItem.isFavorite ?? false,
        imageKey: 'pending',
        metadata: { source: 'seed', analysis: { provider: 'seed', confidence: 1 } },
        // Spread creation times so "recently added" ordering looks natural.
        createdAt: new Date(now.getTime() - (demo.items.length - index) * 6 * 60 * 60 * 1000),
      },
    });
    const imageKey = `users/${user.id}/clothing/${created.id}.webp`;
    const thumbnailKey = `users/${user.id}/clothing/${created.id}_thumb.webp`;
    const rendered = await renderGarment(demoItem.art);
    await writeObject(storageRoot, imageKey, rendered.image);
    await writeObject(storageRoot, thumbnailKey, rendered.thumbnail);
    await prisma.clothingItem.update({
      where: { id: created.id },
      data: { imageKey, thumbnailKey },
    });
    itemIds.set(demoItem.ref, created.id);
  }

  const idOf = (ref: string): string => {
    const id = itemIds.get(ref);
    if (!id) throw new Error(`Unknown demo item ref "${ref}" for ${demo.email}`);
    return id;
  };

  await prisma.stylePreference.create({
    data: {
      userId: user.id,
      preferredColors: demo.preferences.colors,
      preferredStyles: demo.preferences.styles,
      preferredOccasions: demo.preferences.occasions,
      dislikedItems: (demo.preferences.dislikedRefs ?? []).map(idOf),
      metadata: { source: 'onboarding', version: 1 },
    },
  });

  for (const [index, outfit] of demo.outfits.entries()) {
    const created = await prisma.outfit.create({
      data: {
        userId: user.id,
        name: outfit.name,
        occasion: outfit.occasion,
        style: outfit.style,
        reason: outfit.reason,
        score: outfit.score,
        source: 'AI',
        isSaved: outfit.isSaved ?? false,
        createdAt: new Date(now.getTime() - (25 - index * 3) * DAY_MS),
        items: {
          create: outfit.items.map((ref, position) => ({ clothingItemId: idOf(ref), position })),
        },
      },
    });

    if (outfit.rating) {
      await prisma.outfitFeedback.create({
        data: { outfitId: created.id, userId: user.id, rating: outfit.rating },
      });
    }
    for (const daysAgo of outfit.wornDaysAgo ?? []) {
      await prisma.wearHistory.create({
        data: { userId: user.id, outfitId: created.id, wornAt: morningOf(daysAgo, now) },
      });
    }
    for (const plan of outfit.plannedInDays ?? []) {
      await prisma.calendarEvent.create({
        data: {
          userId: user.id,
          outfitId: created.id,
          date: calendarDay(plan.days, now),
          occasion: plan.occasion ?? outfit.occasion,
          notes: plan.notes,
        },
      });
    }
  }

  const usage = [
    ['OUTFIT_GENERATION', demo.usage?.outfitGenerations ?? 0],
    ['CLOTHING_ANALYSIS', demo.usage?.clothingAnalyses ?? 0],
  ] as const;
  for (const [metric, count] of usage) {
    if (count === 0) continue;
    const { period } = getMeteredLimit(demo.plan, metric);
    await prisma.usage.create({
      data: { userId: user.id, metric, periodStart: getPeriodStart(period, now), count },
    });
  }

  await prisma.analyticsEvent.createMany({
    data: [
      {
        userId: user.id,
        name: 'signup',
        properties: { source: 'seed' },
        createdAt: calendarDay(-30, now),
      },
      {
        userId: user.id,
        name: 'onboarding_completed',
        properties: {},
        createdAt: calendarDay(-30, now),
      },
      ...demo.outfits.map(() => ({
        userId: user.id,
        name: 'outfit_generated',
        properties: { source: 'seed' },
        createdAt: calendarDay(-20, now),
      })),
    ],
  });

  return { items: demo.items.length, outfits: demo.outfits.length };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
  });
  const storageRoot = resolve(process.env.STORAGE_LOCAL_DIR ?? './uploads');
  const passwordHash = await hashPassword(requireEnv('SEED_DEMO_PASSWORD'));
  const now = new Date();

  try {
    // Cascades remove every demo row (closet, outfits, history, usage...); their images go too.
    const demoEmails = DEMO_USERS.map((u) => u.email);
    const previous = await prisma.user.findMany({
      where: { email: { in: demoEmails } },
      select: { id: true },
    });
    await prisma.user.deleteMany({ where: { email: { in: demoEmails } } });
    for (const { id } of previous) {
      await rm(resolve(storageRoot, 'users', id), { recursive: true, force: true });
    }

    for (const demo of DEMO_USERS) {
      const result = await seedUser(prisma, demo, passwordHash, storageRoot, now);
      console.warn(
        `  ✓ ${demo.email.padEnd(18)} ${demo.role.padEnd(5)} ${demo.plan.padEnd(7)} ` +
          `${result.items} items, ${result.outfits} outfits`,
      );
    }
    console.warn(`Seed complete. Images written to ${storageRoot}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
