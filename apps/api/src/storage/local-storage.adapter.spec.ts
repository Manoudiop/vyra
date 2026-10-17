import { join } from 'node:path';
import { LocalStorageAdapter } from './local-storage.adapter';
import { isSafeKey } from './storage.service';

const root = join(__dirname, '__storage_root__');
const adapter = new LocalStorageAdapter(root, 'http://api.test', 'k'.repeat(64));

function parts(url: string) {
  const parsed = new URL(url);
  const key = parsed.pathname.replace('/api/storage/files/', '');
  return { key, exp: parsed.searchParams.get('exp')!, sig: parsed.searchParams.get('sig')! };
}

describe('LocalStorageAdapter signed URLs', () => {
  afterEach(() => jest.useRealTimers());

  it('round-trips a valid signature to a path inside the root', () => {
    const { key, exp, sig } = parts(adapter.getSignedUrl('users/u1/clothing/a.webp'));
    expect(key).toBe('users/u1/clothing/a.webp');
    expect(adapter.resolveSignedPath(key, exp, sig)).toBe(join(root, 'users/u1/clothing/a.webp'));
  });

  it('keeps the same URL within the hour so clients can cache images', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-17T10:05:00Z'));
    const first = adapter.getSignedUrl('users/u1/a.webp');
    jest.setSystemTime(new Date('2026-10-17T10:40:00Z'));
    expect(adapter.getSignedUrl('users/u1/a.webp')).toBe(first);
  });

  it('rejects tampered keys, signatures and expiry', () => {
    const { key, exp, sig } = parts(adapter.getSignedUrl('users/u1/a.webp'));
    expect(adapter.resolveSignedPath('users/u2/a.webp', exp, sig)).toBeNull();
    expect(adapter.resolveSignedPath(key, String(Number(exp) + 3600), sig)).toBeNull();
    expect(adapter.resolveSignedPath(key, exp, 'f'.repeat(64))).toBeNull();
    expect(adapter.resolveSignedPath(key, undefined, sig)).toBeNull();
  });

  it('rejects expired links', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-17T10:00:00Z'));
    const { key, exp, sig } = parts(adapter.getSignedUrl('users/u1/a.webp'));
    jest.setSystemTime(new Date('2026-10-17T13:00:00Z'));
    expect(adapter.resolveSignedPath(key, exp, sig)).toBeNull();
  });

  it('refuses unsafe keys even when correctly signed', () => {
    for (const key of ['../secret', 'users/../../etc/passwd', '/abs/path', 'users//a', 'a\\b']) {
      expect(isSafeKey(key)).toBe(false);
      const { exp, sig } = parts(adapter.getSignedUrl('placeholder'));
      expect(adapter.resolveSignedPath(key, exp, sig)).toBeNull();
    }
  });
});
