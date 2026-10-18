import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

/**
 * The API's routes, as the OpenAPI document declares them, are committed in
 * contract/routes.json. The mobile app's contract test checks every client
 * call against this file, so an API change that would break the app fails a
 * test on both sides. Regenerate with: UPDATE_CONTRACT=1 pnpm --filter
 * @vyra/api test -- routes-contract
 */
const CONTRACT = join(__dirname, '..', 'contract', 'routes.json');

describe('Route contract (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('matches the committed contract', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    const paths = res.body.paths as Record<string, Record<string, unknown>>;
    const routes = Object.entries(paths)
      .flatMap(([path, methods]) =>
        Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
      )
      .sort();

    if (process.env.UPDATE_CONTRACT === '1') {
      writeFileSync(CONTRACT, `${JSON.stringify(routes, null, 2)}\n`);
    }
    const committed = JSON.parse(readFileSync(CONTRACT, 'utf8')) as string[];
    expect(routes).toEqual(committed);
  });
});
