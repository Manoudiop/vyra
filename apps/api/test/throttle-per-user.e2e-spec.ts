import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './create-test-app';
import { cleanupSuiteUsers, registerTestUser } from './helpers';

/**
 * Supertest requests all come from one IP, like subscribers behind a mobile
 * carrier's NAT. Signed-in limits must be per user, not per IP.
 */
describe('Rate limits per user (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupSuiteUsers(prisma);
    await app.close();
  });

  it('does not let one user’s usage block another behind the same IP', async () => {
    const alice = await registerTestUser(app);
    const bob = await registerTestUser(app);
    // analyze-style allows 5 calls a minute (FREE gets 402 without being charged).
    for (let i = 0; i < 5; i += 1) await alice.auth('post', '/api/ai/analyze-style').expect(402);
    const blocked = await alice.auth('post', '/api/ai/analyze-style').expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');

    // Same IP, different user: untouched budget.
    await bob.auth('post', '/api/ai/analyze-style').expect(402);
  });

  it('falls back to the IP for invalid tokens', async () => {
    const forged = () =>
      request(app.getHttpServer())
        .post('/api/ai/analyze-style')
        .set('Authorization', 'Bearer not-a-token');
    for (let i = 0; i < 5; i += 1) await forged().expect(401);
    // A made-up token does not buy a fresh budget.
    await forged().expect(429);
  });
});
