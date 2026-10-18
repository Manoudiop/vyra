import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { dislikeReasonSchema } from '@vyra/shared';
import { type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { learnStyle, type StyleSignal } from './learn-style';

/** Signals older than this no longer move the profile (they would weigh < 2 %). */
const SIGNAL_WINDOW_DAYS = 365;

const LOOK_SELECT = {
  occasion: true,
  style: true,
  items: { select: { clothingItem: { select: { id: true, color: true } } } },
} satisfies Prisma.OutfitSelect;
type Look = Prisma.OutfitGetPayload<{ select: typeof LOOK_SELECT }>;

/**
 * Keeps each user's learned style in sync with what they do.
 *
 * A rating, wear or save marks the profile dirty; the recompute runs shortly
 * after (bursts of taps coalesce into one) and always from scratch, so it
 * cannot drift. Anything that reads the profile (generation, the style
 * screen) calls `ensureFresh` first, so a pending change is never missed.
 * In-process by design for the MVP (one API instance); a queue can take
 * over later without changing callers.
 */
@Injectable()
export class StyleLearningService implements OnModuleDestroy {
  static readonly DEBOUNCE_MS = 1500;
  private readonly logger = new Logger(StyleLearningService.name);
  private readonly pending = new Map<string, NodeJS.Timeout>();
  private readonly running = new Map<string, Promise<void>>();

  constructor(private readonly prisma: PrismaService) {}

  /** A signal changed (rating, wear, save): recompute soon. */
  markDirty(userId: string): void {
    clearTimeout(this.pending.get(userId));
    const timer = setTimeout(() => {
      this.pending.delete(userId);
      this.recompute(userId).catch((error: unknown) =>
        this.logger.warn(
          `Style recompute failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }, StyleLearningService.DEBOUNCE_MS);
    timer.unref();
    this.pending.set(userId, timer);
  }

  /** Before reading the learned profile: apply any pending or never-run recompute. */
  async ensureFresh(userId: string): Promise<void> {
    const timer = this.pending.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.pending.delete(userId);
      return this.recompute(userId);
    }
    const running = this.running.get(userId);
    if (running) return running;
    const preference = await this.prisma.stylePreference.findUnique({
      where: { userId },
      select: { lastComputedAt: true },
    });
    if (!preference?.lastComputedAt) await this.recompute(userId);
  }

  /** Recomputes now; concurrent calls for one user run one after the other. */
  recompute(userId: string): Promise<void> {
    const previous = this.running.get(userId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => this.run(userId));
    this.running.set(userId, next);
    void next.finally(() => {
      if (this.running.get(userId) === next) this.running.delete(userId);
    });
    return next;
  }

  onModuleDestroy(): void {
    for (const timer of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
  }

  private async run(userId: string): Promise<void> {
    const since = new Date(Date.now() - SIGNAL_WINDOW_DAYS * 86_400_000);
    const [feedback, wears, saved, preference] = await Promise.all([
      this.prisma.outfitFeedback.findMany({
        where: { userId, updatedAt: { gte: since } },
        select: { rating: true, comment: true, updatedAt: true, outfit: { select: LOOK_SELECT } },
      }),
      this.prisma.wearHistory.findMany({
        where: { userId, wornAt: { gte: since } },
        select: { wornAt: true, outfit: { select: LOOK_SELECT } },
      }),
      this.prisma.outfit.findMany({
        where: { userId, isSaved: true, updatedAt: { gte: since } },
        select: { updatedAt: true, ...LOOK_SELECT },
      }),
      this.prisma.stylePreference.findUnique({ where: { userId }, select: { metadata: true } }),
    ]);

    const itemsOf = (look: Look) => look.items.map(({ clothingItem }) => clothingItem);
    const signals: StyleSignal[] = [
      ...feedback.map((entry) => {
        const reason = dislikeReasonSchema.safeParse(entry.comment);
        return {
          kind: entry.rating,
          at: entry.updatedAt,
          occasion: entry.outfit.occasion,
          style: entry.outfit.style,
          reason: entry.rating === 'DISLIKE' && reason.success ? reason.data : null,
          items: itemsOf(entry.outfit),
        };
      }),
      ...wears.map((wear) => ({
        kind: 'WEAR' as const,
        at: wear.wornAt,
        occasion: wear.outfit.occasion,
        style: wear.outfit.style,
        items: itemsOf(wear.outfit),
      })),
      ...saved.map((look) => ({
        kind: 'SAVE' as const,
        at: look.updatedAt,
        occasion: look.occasion,
        style: look.style,
        items: itemsOf(look),
      })),
    ];

    const learned = learnStyle(signals);
    const metadata = {
      ...((preference?.metadata as Record<string, unknown> | null) ?? {}),
      learned,
    } as unknown as Prisma.InputJsonValue;
    const now = new Date();
    await this.prisma.stylePreference.upsert({
      where: { userId },
      create: { userId, metadata, lastComputedAt: now },
      update: { metadata, lastComputedAt: now },
    });
  }
}
