import { type PrismaService } from '../prisma/prisma.service';
import { StyleLearningService } from './style-learning.service';

/** A Prisma stand-in whose writes take a while, recording how many overlap. */
function slowPrisma() {
  const state = { writes: 0, active: 0, maxActive: 0, lastComputedAt: null as Date | null };
  const prisma = {
    outfitFeedback: { findMany: jest.fn(async () => []) },
    wearHistory: { findMany: jest.fn(async () => []) },
    outfit: { findMany: jest.fn(async () => []) },
    stylePreference: {
      findUnique: jest.fn(async () => ({ metadata: {}, lastComputedAt: state.lastComputedAt })),
      upsert: jest.fn(async () => {
        state.active += 1;
        state.maxActive = Math.max(state.maxActive, state.active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        state.active -= 1;
        state.writes += 1;
        state.lastComputedAt = new Date();
      }),
    },
  };
  return { prisma: prisma as unknown as PrismaService, state };
}

describe('StyleLearningService', () => {
  it('runs recomputes of one user one after the other', async () => {
    const { prisma, state } = slowPrisma();
    const service = new StyleLearningService(prisma);
    await Promise.all([service.recompute('u1'), service.recompute('u1'), service.recompute('u1')]);
    expect(state.writes).toBe(3);
    expect(state.maxActive).toBe(1);
  });

  it('makes a read wait for the recompute in progress', async () => {
    const { prisma, state } = slowPrisma();
    const service = new StyleLearningService(prisma);
    void service.recompute('u1');
    await service.ensureFresh('u1');
    expect(state.writes).toBe(1);
  });

  it('applies a pending change right away when the profile is read', async () => {
    const { prisma, state } = slowPrisma();
    state.lastComputedAt = new Date();
    const service = new StyleLearningService(prisma);
    service.markDirty('u1');
    service.markDirty('u1'); // bursts coalesce
    await service.ensureFresh('u1');
    expect(state.writes).toBe(1);
    // Nothing left pending: the debounce timer was consumed.
    await service.ensureFresh('u1');
    expect(state.writes).toBe(1);
    service.onModuleDestroy();
  });

  it('computes once for a profile never computed', async () => {
    const { prisma, state } = slowPrisma();
    const service = new StyleLearningService(prisma);
    await service.ensureFresh('u1');
    await service.ensureFresh('u1');
    expect(state.writes).toBe(1);
  });
});
