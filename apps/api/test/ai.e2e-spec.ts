import { type INestApplication } from '@nestjs/common';
import { analyzeClothingResponseSchema, uploadedImageSchema } from '@vyra/shared';
import request from 'supertest';
import { renderGarment } from '../prisma/seed/garment-images';
import { AIProvider } from '../src/ai/ai.provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './create-test-app';
import { cleanupSuiteUsers, registerTestUser, type TestUser } from './helpers';

describe('AI clothing analysis (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let user: TestUser;

  async function uploadGarment(who: TestUser, art: Parameters<typeof renderGarment>[0]) {
    const { image } = await renderGarment(art);
    const res = await who
      .auth('post', '/api/storage/images')
      .attach('file', image, { filename: 'garment.webp', contentType: 'image/webp' })
      .expect(201);
    return uploadedImageSchema.parse(res.body);
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    user = await registerTestUser(app);
  });

  afterAll(async () => {
    await cleanupSuiteUsers(prisma);
    await app.close();
  });

  it('analyzes an uploaded photo end to end (upload pipeline → storage → provider)', async () => {
    const { imageKey } = await uploadGarment(user, { shape: 'pants', colorHex: '#1C1C1C' });
    const res = await user.auth('post', '/api/ai/analyze-clothing').send({ imageKey }).expect(200);
    const { analysis, provider } = analyzeClothingResponseSchema.parse(res.body);

    expect(provider).toBe('mock');
    expect(analysis).toMatchObject({
      name: 'Pantalon noir',
      category: 'BOTTOMS',
      subcategory: 'pantalon',
      color: 'black',
    });
  });

  it('names items in the profile language', async () => {
    const english = await registerTestUser(app);
    await prisma.profile.update({
      where: { userId: english.session.user.id },
      data: { locale: 'en' },
    });
    const { imageKey } = await uploadGarment(english, { shape: 'sneaker', colorHex: '#F7F6F2' });
    const res = await english
      .auth('post', '/api/ai/analyze-clothing')
      .send({ imageKey })
      .expect(200);
    expect(res.body.analysis.name).toBe('White sneakers');
  });

  it('refuses images of other accounts and unknown images', async () => {
    const { imageKey } = await uploadGarment(user, { shape: 'tshirt', colorHex: '#C9A45C' });
    const intruder = await registerTestUser(app);
    await intruder.auth('post', '/api/ai/analyze-clothing').send({ imageKey }).expect(403);

    const res = await user
      .auth('post', '/api/ai/analyze-clothing')
      .send({ imageKey: `users/${user.session.user.id}/clothing/missing.webp` })
      .expect(400);
    expect(res.body.error.details).toMatchObject({ reason: 'IMAGE_NOT_FOUND' });
  });

  it('requires authentication and a valid body', async () => {
    await request(app.getHttpServer())
      .post('/api/ai/analyze-clothing')
      .send({ imageKey: 'x' })
      .expect(401);
    await user.auth('post', '/api/ai/analyze-clothing').send({}).expect(400);
  });

  it('turns provider failures and malformed output into AI_ERROR without leaking details', async () => {
    const provider = app.get(AIProvider);
    const { imageKey } = await uploadGarment(user, { shape: 'tshirt', colorHex: '#C9A45C' });

    const crash = jest
      .spyOn(provider, 'analyzeClothing')
      .mockRejectedValueOnce(new Error('upstream timeout with secret-token-123'));
    const failed = await user
      .auth('post', '/api/ai/analyze-clothing')
      .send({ imageKey })
      .expect(502);
    expect(failed.body.error.code).toBe('AI_ERROR');
    expect(JSON.stringify(failed.body)).not.toContain('secret-token-123');

    crash.mockResolvedValueOnce({ name: 'x', category: 'HATS' } as never);
    const malformed = await user
      .auth('post', '/api/ai/analyze-clothing')
      .send({ imageKey })
      .expect(502);
    expect(malformed.body.error.code).toBe('AI_ERROR');
    crash.mockRestore();
  });
});
