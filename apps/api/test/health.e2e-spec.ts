import { type INestApplication } from '@nestjs/common';
import { healthResponseSchema, isApiErrorBody } from '@vyra/shared';
import request from 'supertest';
import { createTestApp } from './create-test-app';

describe('HTTP pipeline (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns the health contract', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(healthResponseSchema.parse(res.body).status).toBe('ok');
  });

  it('sets secure headers', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('allows configured CORS origins only', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'http://localhost:4101');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:4101');

    const denied = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('formats unknown routes as NOT_FOUND errors', async () => {
    const res = await request(app.getHttpServer()).get('/api/does-not-exist').expect(404);
    expect(isApiErrorBody(res.body)).toBe(true);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('serves the Swagger document outside production', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    expect(res.body.paths).toHaveProperty('/api/health');
  });
});

describe('Database readiness (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health/ready reaches the migrated test database', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/ready').expect(200);
    expect(res.body).toEqual({ status: 'ready', checks: { database: 'up' } });
  });
});
