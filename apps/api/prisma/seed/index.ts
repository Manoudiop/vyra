/**
 * Development seed: realistic demo accounts, closets, outfits, feedback, wear
 * history, calendar and usage. Idempotent — demo accounts are deleted and
 * recreated on every run. Refuses to run in production.
 *
 *   pnpm db:seed
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { ANALYTICS_EVENTS, type AnalyticsEventName, getMeteredLimit } from '@vyra/shared';
import { config as loadEnv } from 'dotenv';
import { hashPassword } from '../../src/common/security/password';
import { type Prisma, PrismaClient } from '../../src/generated/prisma/client';
import { LocalStorageAdapter } from '../../src/storage/local-storage.adapter';
import { S3StorageAdapter } from '../../src/storage/s3-storage.adapter';
import { type StorageService } from '../../src/storage/storage.service';
import { usageWindow } from '../../src/usage/usage-period';
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

/** Same driver as the API (STORAGE_DRIVER), so seeded images are where the API looks. */
async function createStorage(): Promise<{ storage: StorageService; label: string }> {
  if (process.env.STORAGE_DRIVER === 's3') {
    const bucket = requireEnv('S3_BUCKET');
    const storage = new S3StorageAdapter({
      bucket,
      region: requireEnv('S3_REGION'),
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
    });
    await storage.ensureBucket();
    return { storage, label: `s3://${bucket}` };
  }
  const root = process.env.STORAGE_LOCAL_DIR ?? './uploads';
  // The signing key is irrelevant here: the seed only writes objects.
  return { storage: new LocalStorageAdapter(root, 'http://localhost', 'seed'), label: root };
}

async function seedUser(
  prisma: PrismaClient,
  demo: DemoUser,
  passwordHash: string,
  storage: StorageService,
  now: Date,
): Promise<{ items: number; outfits: number }> {
  const user = await prisma.user.create({
    data: {
      email: demo.email,
      passwordHash,
      firstName: demo.firstName,
      // Consistent with the demo history (signup event, first outfits).
      createdAt: calendarDay(-30, now),
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
    await storage.upload(imageKey, rendered.image, 'image/webp');
    await storage.upload(thumbnailKey, rendered.thumbnail, 'image/webp');
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
    // Same windows as the API: the user's day, Monday week or month.
    const { start } = usageWindow(period, demo.profile.timezone, now);
    await prisma.usage.create({
      data: { userId: user.id, metric, periodStart: start, count },
    });
  }

  // Product events consistent with the demo data, each validated by the
  // shared catalog (same rules as the API: no personal data).
  if (demo.role === 'USER') {
    const events: { name: AnalyticsEventName; properties: unknown; createdAt: Date }[] = [
      { name: 'signup', properties: {}, createdAt: calendarDay(-30, now) },
      {
        name: 'onboarding_completed',
        properties: {
          styles: demo.preferences.styles.length,
          colors: demo.preferences.colors.length,
          occasions: demo.preferences.occasions.length,
        },
        createdAt: calendarDay(-30, now),
      },
      ...demo.items.map((item) => ({
        name: 'item_added' as const,
        properties: { category: item.category, aiPrefilled: false, corrections: 0 },
        createdAt: calendarDay(-29, now),
      })),
    ];
    for (const [index, outfit] of demo.outfits.entries()) {
      const generatedAt = new Date(now.getTime() - (25 - index * 3) * DAY_MS);
      const look = { occasion: outfit.occasion };
      events.push({
        name: 'outfit_generated',
        properties: {
          occasion: outfit.occasion,
          style: outfit.style,
          candidateCount: 5,
          planned: false,
          weather: null,
          provider: 'mock',
        },
        createdAt: generatedAt,
      });
      if (outfit.isSaved)
        events.push({ name: 'outfit_saved', properties: look, createdAt: generatedAt });
      if (outfit.rating === 'LOVE') {
        events.push({ name: 'outfit_liked', properties: look, createdAt: generatedAt });
      } else if (outfit.rating === 'DISLIKE') {
        events.push({
          name: 'outfit_disliked',
          properties: { ...look, reason: null },
          createdAt: generatedAt,
        });
      }
      for (const daysAgo of outfit.wornDaysAgo ?? []) {
        events.push({ name: 'outfit_worn', properties: look, createdAt: morningOf(daysAgo, now) });
      }
    }
    if (demo.plan !== 'FREE') {
      events.push(
        {
          name: 'paywall_viewed',
          properties: { reason: 'generations', currentPlan: 'FREE' },
          createdAt: calendarDay(-10, now),
        },
        {
          name: 'subscription_started',
          properties: { plan: demo.plan, previousPlan: 'FREE', provider: 'mock' },
          createdAt: calendarDay(-10, now),
        },
      );
    }
    await prisma.analyticsEvent.createMany({
      data: events.map((event) => ({
        userId: user.id,
        name: event.name,
        properties: ANALYTICS_EVENTS[event.name].parse(event.properties) as Prisma.InputJsonValue,
        createdAt: event.createdAt,
      })),
    });
  }

  return { items: demo.items.length, outfits: demo.outfits.length };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
  });
  const { storage, label } = await createStorage();
  const passwordHash = await hashPassword(requireEnv('SEED_DEMO_PASSWORD'));
  const now = new Date();

  try {
    // Cascades remove every demo row (closet, outfits, history, usage...); their images go too.
    const demoEmails = DEMO_USERS.map((u) => u.email);
    const previousImages = await prisma.clothingItem.findMany({
      where: { user: { email: { in: demoEmails } } },
      select: { imageKey: true, thumbnailKey: true },
    });
    await prisma.user.deleteMany({ where: { email: { in: demoEmails } } });
    for (const { imageKey, thumbnailKey } of previousImages) {
      await storage.delete(imageKey);
      if (thumbnailKey) await storage.delete(thumbnailKey);
    }

    for (const demo of DEMO_USERS) {
      const result = await seedUser(prisma, demo, passwordHash, storage, now);
      console.warn(
        `  ✓ ${demo.email.padEnd(18)} ${demo.role.padEnd(5)} ${demo.plan.padEnd(7)} ` +
          `${result.items} items, ${result.outfits} outfits`,
      );
    }
    console.warn(`Seed complete. Images written to ${label}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
