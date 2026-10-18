import { type PrismaService } from '../prisma/prisma.service';
import { AnalyticsProvider, type TrackedEvent } from './analytics.provider';
import { AnalyticsService, RETENTION_DAYS } from './analytics.service';

class RecordingProvider extends AnalyticsProvider {
  readonly name = 'recording';
  readonly events: TrackedEvent[] = [];
  fail = false;
  track(event: TrackedEvent): Promise<void> {
    if (this.fail) return Promise.reject(new Error('sink down'));
    this.events.push(event);
    return Promise.resolve();
  }
}

function setup(analyticsEnabled = true) {
  const provider = new RecordingProvider();
  const prisma = {
    profile: { findUnique: jest.fn(async () => ({ analyticsEnabled })) },
    analyticsEvent: { deleteMany: jest.fn(async () => ({ count: 4 })) },
  };
  const service = new AnalyticsService(provider, prisma as unknown as PrismaService);
  return { provider, prisma, service };
}

describe('AnalyticsService', () => {
  it('records valid events in the background', async () => {
    const { provider, service } = setup();
    service.track('u1', 'outfit_worn', { occasion: 'WORK' });
    expect(provider.events).toHaveLength(0); // not awaited by the caller
    await service.flush();
    expect(provider.events).toEqual([
      expect.objectContaining({
        name: 'outfit_worn',
        userId: 'u1',
        properties: { occasion: 'WORK' },
      }),
    ]);
  });

  it('drops events whose properties leave the schema (no personal data slips in)', async () => {
    const { provider, service } = setup();
    // Simulates a call site passing more than the catalog allows.
    service.track('u1', 'outfit_worn', {
      occasion: 'WORK',
      email: 'amina@vyra.dev',
    } as never);
    service.track('u1', 'item_added', {
      category: 'HATS',
      aiPrefilled: true,
      corrections: 0,
    } as never);
    await service.flush();
    expect(provider.events).toEqual([]);
  });

  it('respects users who turned analytics off', async () => {
    const { provider, service } = setup(false);
    service.track('u1', 'signup', {});
    await service.flush();
    expect(provider.events).toEqual([]);
  });

  it('never fails the caller when the sink is down', async () => {
    const { provider, service } = setup();
    provider.fail = true;
    expect(() => service.track('u1', 'signup', {})).not.toThrow();
    await expect(service.flush()).resolves.toBeUndefined();
  });

  it('purges events past the retention period', async () => {
    const { prisma, service } = setup();
    const now = new Date('2026-10-18T00:00:00Z');
    expect(await service.purgeExpired(now)).toBe(4);
    expect(prisma.analyticsEvent.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 86_400_000) } },
    });
  });
});
