import { type INestApplication } from '@nestjs/common';
import { profileSchema } from '@vyra/shared';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './create-test-app';
import { cleanupSuiteUsers, registerTestUser } from './helpers';

const ONBOARDING = {
  firstName: 'Awa',
  genderPreference: 'WOMEN',
  preferredStyles: ['ELEGANT', 'TRADITIONAL'],
  preferredColors: ['beige', 'gold', 'terracotta'],
  preferredOccasions: ['WORK', 'WEDDING'],
  city: 'Dakar',
  countryCode: 'sn',
  timezone: 'Africa/Dakar',
};

describe('Profile (e2e)', () => {
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

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/profile').expect(401);
    await request(app.getHttpServer()).put('/api/profile/onboarding').send(ONBOARDING).expect(401);
  });

  it('starts empty for a new account', async () => {
    const user = await registerTestUser(app, { firstName: 'Awa' });
    const res = await user.auth('get', '/api/profile').expect(200);
    expect(profileSchema.parse(res.body)).toMatchObject({
      firstName: 'Awa',
      onboardingCompleted: false,
      genderPreference: null,
      city: null,
      timezone: 'UTC',
      preferredStyles: [],
    });
  });

  it('completes onboarding atomically and reflects it on /users/me', async () => {
    const user = await registerTestUser(app, { firstName: 'Placeholder' });
    const res = await user.auth('put', '/api/profile/onboarding').send(ONBOARDING).expect(200);

    expect(profileSchema.parse(res.body)).toMatchObject({
      firstName: 'Awa',
      genderPreference: 'WOMEN',
      city: 'Dakar',
      countryCode: 'SN',
      timezone: 'Africa/Dakar',
      onboardingCompleted: true,
      preferredStyles: ['ELEGANT', 'TRADITIONAL'],
      preferredColors: ['beige', 'gold', 'terracotta'],
      preferredOccasions: ['WORK', 'WEDDING'],
    });

    const me = await user.auth('get', '/api/users/me').expect(200);
    expect(me.body).toMatchObject({ firstName: 'Awa', onboardingCompleted: true });
  });

  it('keeps the first completion date when onboarding is re-submitted', async () => {
    const user = await registerTestUser(app);
    await user.auth('put', '/api/profile/onboarding').send(ONBOARDING).expect(200);
    const first = await prisma.profile.findUniqueOrThrow({
      where: { userId: user.session.user.id },
    });

    await user
      .auth('put', '/api/profile/onboarding')
      .send({ ...ONBOARDING, city: 'Thiès' })
      .expect(200);
    const second = await prisma.profile.findUniqueOrThrow({
      where: { userId: user.session.user.id },
    });

    expect(second.city).toBe('Thiès');
    expect(second.onboardingCompletedAt).toEqual(first.onboardingCompletedAt);
  });

  it('rejects an incomplete or invalid onboarding without saving anything', async () => {
    const user = await registerTestUser(app);
    const res = await user
      .auth('put', '/api/profile/onboarding')
      .send({
        ...ONBOARDING,
        preferredColors: ['plaid'],
        preferredStyles: [],
        timezone: 'Mars/Olympus',
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.issues.map((issue: { path: string }) => issue.path);
    expect(paths).toEqual(
      expect.arrayContaining(['preferredColors.0', 'preferredStyles', 'timezone']),
    );
    const profile = await user.auth('get', '/api/profile').expect(200);
    expect(profile.body.onboardingCompleted).toBe(false);
  });

  it('edits any subset later without touching the rest', async () => {
    const user = await registerTestUser(app);
    await user.auth('put', '/api/profile/onboarding').send(ONBOARDING).expect(200);

    const res = await user
      .auth('patch', '/api/profile')
      .send({ city: 'Abidjan', countryCode: 'CI', preferredColors: ['navy'], lastName: 'Diallo' })
      .expect(200);

    expect(res.body).toMatchObject({
      city: 'Abidjan',
      countryCode: 'CI',
      lastName: 'Diallo',
      preferredColors: ['navy'],
      // untouched
      preferredStyles: ['ELEGANT', 'TRADITIONAL'],
      genderPreference: 'WOMEN',
      onboardingCompleted: true,
    });
  });

  it('rejects an empty update', async () => {
    const user = await registerTestUser(app);
    const res = await user.auth('patch', '/api/profile').send({}).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('only ever touches the caller’s own profile', async () => {
    const alice = await registerTestUser(app, { firstName: 'Alice' });
    const bob = await registerTestUser(app, { firstName: 'Bob' });

    // A userId smuggled in the body is not part of the schema and is ignored.
    await alice
      .auth('patch', '/api/profile')
      .send({ city: 'Lomé', userId: bob.session.user.id })
      .expect(200);

    const bobProfile = await bob.auth('get', '/api/profile').expect(200);
    expect(bobProfile.body).toMatchObject({ firstName: 'Bob', city: null });
    const aliceProfile = await alice.auth('get', '/api/profile').expect(200);
    expect(aliceProfile.body.city).toBe('Lomé');
  });
});
