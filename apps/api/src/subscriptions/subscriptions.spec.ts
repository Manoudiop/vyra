import { type AppConfigService } from '../config/app-config.service';
import { type PrismaService } from '../prisma/prisma.service';
import { MockBillingProvider } from './mock-billing.provider';
import { effectivePlan } from './plans.service';
import { addMonth, SubscriptionsService } from './subscriptions.service';

const NOW = new Date('2026-10-18T12:00:00Z');
const later = new Date('2026-11-18T12:00:00Z');
const earlier = new Date('2026-10-01T12:00:00Z');

describe('addMonth', () => {
  it('moves one calendar month, clamping to the month’s last day', () => {
    expect(addMonth(new Date('2026-10-18T09:30:00Z')).toISOString()).toBe(
      '2026-11-18T09:30:00.000Z',
    );
    expect(addMonth(new Date('2026-01-31T00:00:00Z')).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
    expect(addMonth(new Date('2028-01-31T00:00:00Z')).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
    expect(addMonth(new Date('2026-12-15T00:00:00Z')).toISOString()).toBe(
      '2027-01-15T00:00:00.000Z',
    );
  });
});

describe('effectivePlan', () => {
  const sub = (overrides: Partial<Parameters<typeof effectivePlan>[0] & object>) => ({
    plan: 'PRO' as const,
    status: 'ACTIVE',
    currentPeriodEnd: later,
    cancelAtPeriodEnd: false,
    ...overrides,
  });

  it('keeps a paid plan while active, trialing or canceled-but-paid', () => {
    expect(effectivePlan(sub({}), NOW)).toBe('PRO');
    expect(effectivePlan(sub({ status: 'TRIALING' }), NOW)).toBe('PRO');
    expect(effectivePlan(sub({ cancelAtPeriodEnd: true }), NOW)).toBe('PRO');
    // Ended without cancellation: being renewed.
    expect(effectivePlan(sub({ currentPeriodEnd: earlier }), NOW)).toBe('PRO');
  });

  it('falls back to FREE otherwise', () => {
    expect(effectivePlan(null, NOW)).toBe('FREE');
    expect(effectivePlan(sub({ status: 'PAST_DUE' }), NOW)).toBe('FREE');
    expect(effectivePlan(sub({ status: 'EXPIRED' }), NOW)).toBe('FREE');
    expect(effectivePlan(sub({ cancelAtPeriodEnd: true, currentPeriodEnd: earlier }), NOW)).toBe(
      'FREE',
    );
  });
});

describe('SubscriptionsService in production', () => {
  it('refuses simulated payments', async () => {
    const prisma = {
      subscription: {
        findUnique: jest.fn(async () => ({
          userId: 'u1',
          plan: 'FREE',
          status: 'ACTIVE',
          provider: 'mock',
          providerRef: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
        })),
        update: jest.fn(),
      },
    } as unknown as PrismaService;
    const service = new SubscriptionsService(prisma, new MockBillingProvider(), {
      isProduction: true,
    } as AppConfigService);
    await expect(service.checkout('u1', 'u1@vyra.dev', 'PRO')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });
});
