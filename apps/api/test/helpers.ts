import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { type AuthSession, authSessionSchema } from '@vyra/shared';
import request from 'supertest';

/** All e2e accounts use this domain so suites can clean up after themselves. */
export const TEST_EMAIL_DOMAIN = '@test.vyra.dev';

export const newTestEmail = () => `user-${randomUUID()}${TEST_EMAIL_DOMAIN}`;

export interface TestUser {
  email: string;
  session: AuthSession;
  /** supertest agent pre-authorized with the user's access token. */
  auth: (method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string) => request.Test;
}

export async function registerTestUser(
  app: INestApplication,
  overrides: { firstName?: string } = {},
): Promise<TestUser> {
  const email = newTestEmail();
  const res = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, password: 'letters123', firstName: overrides.firstName ?? 'Test' })
    .expect(201);
  const session = authSessionSchema.parse(res.body);
  return {
    email,
    session,
    auth: (method, path) => {
      const agent = request(app.getHttpServer());
      return agent[method](path).set('Authorization', `Bearer ${session.tokens.accessToken}`);
    },
  };
}
