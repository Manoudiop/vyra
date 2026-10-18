import { type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { authSessionSchema, authUserSchema } from '@vyra/shared';
import request from 'supertest';
import { MAIL_PROVIDER } from '../src/mail/mail.provider';
import { type MockMailProvider } from '../src/mail/mock-mail.provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './create-test-app';
import { cleanupSuiteUsers, newTestEmail } from './helpers';

const PASSWORD = 'letters123';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: MockMailProvider;
  const http = () => request(app.getHttpServer());
  const newEmail = newTestEmail;

  async function register(email = newEmail(), password = PASSWORD) {
    const res = await http()
      .post('/api/auth/register')
      .send({ email, password, firstName: 'Test' })
      .expect(201);
    return { email, session: authSessionSchema.parse(res.body) };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    mail = app.get(MAIL_PROVIDER);
  });

  afterAll(async () => {
    await cleanupSuiteUsers(prisma);
    await app.close();
  });

  describe('register', () => {
    it('creates the account with profile, preferences and a FREE plan', async () => {
      const { email, session } = await register(newEmail().toUpperCase());

      expect(session.user.email).toBe(email.toLowerCase());
      expect(session.user.onboardingCompleted).toBe(false);
      expect(session.user.role).toBe('USER');

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: session.user.id },
        include: { profile: true, stylePreference: true, subscription: true },
      });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.passwordHash).not.toContain(PASSWORD);
      expect(user.profile).not.toBeNull();
      expect(user.stylePreference).not.toBeNull();
      expect(user.subscription?.plan).toBe('FREE');
    });

    it('rejects a duplicate email regardless of case', async () => {
      const { email } = await register();
      const res = await http()
        .post('/api/auth/register')
        .send({ email: `  ${email.toUpperCase()} `, password: PASSWORD, firstName: 'Dup' })
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('validates the payload and reports each issue', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'short', firstName: '' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const paths = res.body.error.details.issues.map((issue: { path: string }) => issue.path);
      expect(paths).toEqual(expect.arrayContaining(['email', 'password', 'firstName']));
    });
  });

  describe('login', () => {
    it('opens a session with valid credentials', async () => {
      const { email } = await register();
      const res = await http()
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      const session = authSessionSchema.parse(res.body);
      expect(new Date(session.tokens.accessTokenExpiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('gives the same answer for a wrong password and an unknown email', async () => {
      const { email } = await register();
      const wrong = await http().post('/api/auth/login').send({ email, password: 'nope12345' });
      const unknown = await http()
        .post('/api/auth/login')
        .send({ email: newEmail(), password: PASSWORD });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body).toEqual(unknown.body);
      expect(wrong.body.error.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('protected routes', () => {
    it('requires a bearer token', async () => {
      const res = await http().get('/api/users/me').expect(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('returns the signed-in user', async () => {
      const { session } = await register();
      const res = await http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${session.tokens.accessToken}`)
        .expect(200);
      expect(authUserSchema.parse(res.body).id).toBe(session.user.id);
    });

    it('rejects forged, unsigned and expired tokens', async () => {
      const { session } = await register();
      const forged = new JwtService({ secret: 'x'.repeat(48) }).sign(
        { sub: session.user.id, role: 'ADMIN' },
        { issuer: 'vyra-api' },
      );
      const [header, payload] = session.tokens.accessToken.split('.');
      const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${payload}.`;
      const expired = app
        .get(JwtService)
        .sign({ sub: session.user.id, role: 'USER' }, { expiresIn: '1s' });
      await new Promise((resolve) => setTimeout(resolve, 1100));

      for (const token of [forged, unsigned, expired, `${header}.${payload}.tampered`]) {
        await http().get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(401);
      }
    });

    it('treats a token for a deleted account as unauthenticated', async () => {
      const { session } = await register();
      await prisma.user.delete({ where: { id: session.user.id } });
      await http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${session.tokens.accessToken}`)
        .expect(401);
    });
  });

  describe('refresh tokens', () => {
    it('rotates on every refresh', async () => {
      const { session } = await register();
      const res = await http()
        .post('/api/auth/refresh')
        .send({ refreshToken: session.tokens.refreshToken })
        .expect(200);
      expect(res.body.tokens.refreshToken).not.toBe(session.tokens.refreshToken);
      await http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${res.body.tokens.accessToken}`)
        .expect(200);
    });

    it('revokes the whole session when a rotated token is reused', async () => {
      const { session } = await register();
      const first = await http()
        .post('/api/auth/refresh')
        .send({ refreshToken: session.tokens.refreshToken })
        .expect(200);

      // An attacker replays the old token...
      await http()
        .post('/api/auth/refresh')
        .send({ refreshToken: session.tokens.refreshToken })
        .expect(401);
      // ...which also kills the legitimate, newer token.
      await http()
        .post('/api/auth/refresh')
        .send({ refreshToken: first.body.tokens.refreshToken })
        .expect(401);
    });

    it('refuses an expired refresh token', async () => {
      const { session } = await register();
      await prisma.refreshToken.updateMany({
        where: { userId: session.user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await http()
        .post('/api/auth/refresh')
        .send({ refreshToken: session.tokens.refreshToken })
        .expect(401);
    });

    it('lets only one of two simultaneous refreshes through, then ends the session', async () => {
      // A stolen token used at the same moment as the real one.
      const { session } = await register();
      const refresh = () =>
        http().post('/api/auth/refresh').send({ refreshToken: session.tokens.refreshToken });
      const results = await Promise.all([refresh(), refresh()]);
      expect(results.map((res) => res.status).sort()).toEqual([200, 401]);

      const winner = results.find((res) => res.status === 200)!;
      await http()
        .post('/api/auth/refresh')
        .send({ refreshToken: winner.body.tokens.refreshToken })
        .expect(401);
      const live = await prisma.refreshToken.count({
        where: { userId: session.user.id, revokedAt: null },
      });
      expect(live).toBe(0);
    });

    it('stores only hashes of refresh tokens', async () => {
      const { session } = await register();
      const rows = await prisma.refreshToken.findMany({ where: { userId: session.user.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.tokenHash).not.toContain(session.tokens.refreshToken);
    });

    it('rejects unknown tokens', async () => {
      const res = await http()
        .post('/api/auth/refresh')
        .send({ refreshToken: 'x'.repeat(43) })
        .expect(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });
  });

  describe('logout', () => {
    it('ends the session and is idempotent', async () => {
      const { session } = await register();
      const body = { refreshToken: session.tokens.refreshToken };
      await http().post('/api/auth/logout').send(body).expect(204);
      await http().post('/api/auth/logout').send(body).expect(204);
      await http().post('/api/auth/refresh').send(body).expect(401);
    });

    it('only ends that session, not the other devices', async () => {
      const { email, session: phone } = await register();
      const tablet = await http().post('/api/auth/login').send({ email, password: PASSWORD });
      await http()
        .post('/api/auth/logout')
        .send({ refreshToken: phone.tokens.refreshToken })
        .expect(204);
      await http()
        .post('/api/auth/refresh')
        .send({ refreshToken: tablet.body.tokens.refreshToken })
        .expect(200);
    });
  });

  describe('password reset', () => {
    const codeFor = (email: string) => mail.lastTo(email)?.data?.code;

    it('answers identically for known and unknown emails', async () => {
      const { email } = await register();
      const known = await http().post('/api/auth/forgot-password').send({ email }).expect(202);
      const unknown = await http()
        .post('/api/auth/forgot-password')
        .send({ email: newEmail() })
        .expect(202);
      expect(known.body).toEqual(unknown.body);
      expect(codeFor(email)).toMatch(/^\d{6}$/);
    });

    it('resets the password, signs out every device and is single use', async () => {
      const { email, session } = await register();
      await http().post('/api/auth/forgot-password').send({ email }).expect(202);
      const code = codeFor(email)!;
      const newPassword = 'brandnew456';

      await http().post('/api/auth/reset-password').send({ email, code, newPassword }).expect(204);

      await http().post('/api/auth/login').send({ email, password: PASSWORD }).expect(401);
      await http().post('/api/auth/login').send({ email, password: newPassword }).expect(200);
      await http()
        .post('/api/auth/refresh')
        .send({ refreshToken: session.tokens.refreshToken })
        .expect(401);
      await http()
        .post('/api/auth/reset-password')
        .send({ email, code, newPassword: 'another789' })
        .expect(400);
    });

    it('locks the code after 5 wrong attempts', async () => {
      const { email } = await register();
      await http().post('/api/auth/forgot-password').send({ email }).expect(202);
      const code = codeFor(email)!;
      const wrong = code === '000000' ? '111111' : '000000';

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const res = await http()
          .post('/api/auth/reset-password')
          .send({ email, code: wrong, newPassword: 'brandnew456' })
          .expect(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
      // Even the right code no longer works.
      await http()
        .post('/api/auth/reset-password')
        .send({ email, code, newPassword: 'brandnew456' })
        .expect(400);
    });

    it('invalidates the previous code when a new one is requested', async () => {
      const { email } = await register();
      await http().post('/api/auth/forgot-password').send({ email }).expect(202);
      const first = codeFor(email)!;
      await http().post('/api/auth/forgot-password').send({ email }).expect(202);
      const second = codeFor(email)!;
      if (first !== second) {
        await http()
          .post('/api/auth/reset-password')
          .send({ email, code: first, newPassword: 'brandnew456' })
          .expect(400);
      }
      await http()
        .post('/api/auth/reset-password')
        .send({ email, code: second, newPassword: 'brandnew456' })
        .expect(204);
    });
  });
});
