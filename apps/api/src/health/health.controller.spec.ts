import { AppException } from '../common/errors/app.exception';
import { type PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController.ready', () => {
  const controllerWith = (reachable: boolean) =>
    new HealthController({ isReachable: async () => reachable } as unknown as PrismaService);

  it('reports ready when the database answers', async () => {
    await expect(controllerWith(true).ready()).resolves.toEqual({
      status: 'ready',
      checks: { database: 'up' },
    });
  });

  it('fails with 503 when the database is unreachable', async () => {
    const error = await controllerWith(false)
      .ready()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(503);
  });
});
