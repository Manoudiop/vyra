import { type INestApplication } from '@nestjs/common';
import { uploadedImageSchema } from '@vyra/shared';
import sharp from 'sharp';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './create-test-app';
import { cleanupSuiteUsers, registerTestUser, type TestUser } from './helpers';

/** A camera-like JPEG: 1200×800 stored sideways (EXIF orientation 6) with GPS tags. */
async function phonePhoto(): Promise<Buffer> {
  return sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 181, g: 87, b: 59 } },
  })
    .jpeg()
    .withMetadata({
      orientation: 6,
      exif: {
        IFD0: { Make: 'TestPhone' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '14/1 41/1 0/1' },
      },
    })
    .toBuffer();
}

const png = (size: number) =>
  sharp({ create: { width: size, height: size, channels: 4, background: '#1F2A44' } })
    .png()
    .toBuffer();

describe('Image upload (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let user: TestUser;

  const upload = (
    who: TestUser,
    body: Buffer,
    filename = 'photo.jpg',
    contentType = 'image/jpeg',
  ) => who.auth('post', '/api/storage/images').attach('file', body, { filename, contentType });

  const fetchSigned = (url: string) => {
    const parsed = new URL(url);
    return request(app.getHttpServer()).get(`${parsed.pathname}${parsed.search}`);
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    user = await registerTestUser(app);
  });

  afterAll(async () => {
    await cleanupSuiteUsers(prisma);
    await app.close();
  });

  it('normalizes a phone photo: rotation applied, metadata stripped, WebP + thumbnail', async () => {
    const res = await upload(user, await phonePhoto()).expect(201);
    const uploaded = uploadedImageSchema.parse(res.body);

    expect(uploaded.imageKey).toMatch(
      new RegExp(`^users/${user.session.user.id}/clothing/[0-9a-f-]{36}\\.webp$`),
    );
    expect(uploaded.thumbnailKey).toBe(uploaded.imageKey.replace('.webp', '_thumb.webp'));
    // Stored sideways, displayed upright: 800×1200 after applying orientation.
    expect({ width: uploaded.width, height: uploaded.height }).toEqual({
      width: 800,
      height: 1200,
    });
    expect(uploaded.dominantColorHex).toMatch(/^#[0-9A-F]{6}$/);

    const image = await fetchSigned(uploaded.imageUrl).buffer(true).expect(200);
    const meta = await sharp(image.body as Buffer).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation ?? 1).toBe(1);

    const thumb = await fetchSigned(uploaded.thumbnailUrl).buffer(true).expect(200);
    const thumbMeta = await sharp(thumb.body as Buffer).metadata();
    expect(thumbMeta.width).toBeLessThanOrEqual(480);
    expect(thumbMeta.height).toBeLessThanOrEqual(600);
  });

  it('accepts PNG and creates a closet item from the uploaded keys', async () => {
    const res = await upload(user, await png(600), 'shirt.png', 'image/png').expect(201);
    const { imageKey, thumbnailKey } = uploadedImageSchema.parse(res.body);
    await user
      .auth('post', '/api/closet')
      .send({ name: 'Chemise marine', category: 'TOPS', color: 'navy', imageKey, thumbnailKey })
      .expect(201);
  });

  it.each([
    [
      'an SVG disguised as a JPEG',
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    ],
    ['a text file renamed .jpg', Buffer.from('definitely not an image')],
  ])('rejects %s based on content, not name or MIME', async (_label, body) => {
    const res = await upload(user, body).expect(415);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { reason: 'UNSUPPORTED_FORMAT' },
    });
  });

  it('rejects animated or legacy formats like GIF', async () => {
    const gif = await sharp({
      create: { width: 300, height: 300, channels: 3, background: '#000' },
    })
      .gif()
      .toBuffer();
    const res = await upload(user, gif, 'a.gif', 'image/gif').expect(415);
    expect(res.body.error.details).toMatchObject({ detected: 'gif' });
  });

  it('rejects truncated files that only have a valid header', async () => {
    const photo = await phonePhoto();
    await upload(user, photo.subarray(0, Math.floor(photo.length / 3))).expect(415);
  });

  it('rejects images that are too small to be useful', async () => {
    const res = await upload(user, await png(120), 'tiny.png', 'image/png').expect(400);
    expect(res.body.error.details).toMatchObject({ reason: 'TOO_SMALL' });
  });

  it('rejects files over 10 MB before processing', async () => {
    const res = await upload(user, Buffer.alloc(10 * 1024 * 1024 + 1, 1)).expect(413);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires a file and authentication', async () => {
    await user.auth('post', '/api/storage/images').expect(400);
    await request(app.getHttpServer())
      .post('/api/storage/images')
      .attach('file', await png(400), 'a.png')
      .expect(401);
  });

  it('refuses closet items pointing at images that were never uploaded', async () => {
    const res = await user
      .auth('post', '/api/closet')
      .send({
        name: 'Ghost',
        category: 'TOPS',
        color: 'white',
        imageKey: `users/${user.session.user.id}/clothing/does-not-exist.webp`,
      })
      .expect(400);
    expect(res.body.error.details).toMatchObject({ reason: 'IMAGE_NOT_FOUND' });
  });

  describe('discarding an upload', () => {
    it('deletes an unused upload of the caller', async () => {
      const uploaded = uploadedImageSchema.parse(
        (await upload(user, await png(400), 'a.png', 'image/png').expect(201)).body,
      );
      await user
        .auth('delete', '/api/storage/images')
        .send({ imageKey: uploaded.imageKey, thumbnailKey: uploaded.thumbnailKey })
        .expect(204);
      await fetchSigned(uploaded.imageUrl).expect(404);
    });

    it('refuses images in use by a closet item, and other users’ images', async () => {
      const uploaded = uploadedImageSchema.parse(
        (await upload(user, await png(400), 'b.png', 'image/png').expect(201)).body,
      );
      await user
        .auth('post', '/api/closet')
        .send({ name: 'Kept', category: 'TOPS', color: 'navy', imageKey: uploaded.imageKey })
        .expect(201);
      await user
        .auth('delete', '/api/storage/images')
        .send({ imageKey: uploaded.imageKey })
        .expect(409);

      const intruder = await registerTestUser(app);
      await intruder
        .auth('delete', '/api/storage/images')
        .send({ imageKey: uploaded.imageKey })
        .expect(403);
      await fetchSigned(uploaded.imageUrl).expect(200);
    });
  });
});
