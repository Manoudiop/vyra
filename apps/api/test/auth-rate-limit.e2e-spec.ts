import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

describe('Auth rate limiting (e2e)', () => {
  let app: INestApplication;
  const previous = process.env.THROTTLE_AUTH_LIMIT;

  beforeAll(async () => {
    // Limits are resolved per request, so a low value applies to this app instance.
    process.env.THROTTLE_AUTH_LIMIT = '3';
    app = await createTestApp();
  });

  afterAll(async () => {
    process.env.THROTTLE_AUTH_LIMIT = previous;
    await app.close();
  });

  it('answers RATE_LIMITED once the per-IP budget is spent', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@test.vyra.dev', password: 'whatever1' });

    for (let i = 0; i < 3; i += 1) expect((await attempt()).status).toBe(401);

    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('does not throttle unrelated routes with the auth budget', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });
});
