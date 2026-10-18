import { randomUUID } from 'node:crypto';
import { S3StorageAdapter } from '../src/storage/s3-storage.adapter';

/**
 * Integration test against the MinIO container from docker-compose.
 * Skipped (not failed) when MinIO is not running, e.g. on a machine without Docker.
 */
const settings = {
  endpoint: process.env.S3_TEST_ENDPOINT ?? 'http://localhost:9100',
  region: 'us-east-1',
  bucket: 'vyra-test',
  forcePathStyle: true,
  accessKeyId: process.env.S3_TEST_ACCESS_KEY_ID ?? 'vyra',
  secretAccessKey: process.env.S3_TEST_SECRET_ACCESS_KEY ?? 'vyra_dev_password',
};

async function minioAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${settings.endpoint}/minio/health/live`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

describe('S3StorageAdapter against MinIO (integration)', () => {
  let available = false;
  const adapter = new S3StorageAdapter(settings);

  beforeAll(async () => {
    available = await minioAvailable();
    if (available) await adapter.ensureBucket();
    else if (process.env.REQUIRE_MINIO === '1') {
      // CI runs MinIO: a silent skip there would hide a broken S3 adapter.
      throw new Error(
        `MinIO is required (REQUIRE_MINIO=1) but not reachable at ${settings.endpoint}`,
      );
    } else console.warn('MinIO not reachable: S3 integration test skipped (run `pnpm db:up`).');
  });

  it('uploads, signs, serves and deletes objects', async () => {
    if (!available) return;
    const key = `users/test/clothing/${randomUUID()}.webp`;
    const body = Buffer.from('fake image bytes');

    expect(await adapter.exists(key)).toBe(false);
    await adapter.upload(key, body, 'image/webp');
    expect(await adapter.exists(key)).toBe(true);
    expect((await adapter.download(key)).equals(body)).toBe(true);

    const url = await adapter.getSignedUrl(key);
    expect(url).toContain('X-Amz-Signature=');
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(Buffer.from(await res.arrayBuffer()).equals(body)).toBe(true);

    // Same signing window → identical URL (cache friendly).
    expect(await adapter.getSignedUrl(key)).toBe(url);

    await adapter.delete(key);
    expect(await adapter.exists(key)).toBe(false);
    await adapter.delete(key); // idempotent
  });

  it('rejects unsigned access to objects', async () => {
    if (!available) return;
    const key = `users/test/clothing/${randomUUID()}.webp`;
    await adapter.upload(key, Buffer.from('x'), 'image/webp');
    const res = await fetch(`${settings.endpoint}/${settings.bucket}/${key}`);
    expect(res.status).toBe(403);
    await adapter.delete(key);
  });
});
