import { createHmac } from 'node:crypto';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { safeEqualHex } from '../common/security/tokens';
import {
  assertUserId,
  isSafeKey,
  SIGNED_URL_MIN_TTL_SECONDS,
  signingWindowStart,
  StorageService,
  userKeyPrefix,
} from './storage.service';

export const LOCAL_FILES_ROUTE = 'storage/files';

/**
 * Development storage on local disk, served by StorageController through
 * HMAC-signed, expiring URLs (same contract as S3 presigned URLs).
 */
export class LocalStorageAdapter extends StorageService {
  readonly root: string;

  constructor(
    rootDir: string,
    private readonly publicApiUrl: string,
    private readonly signingKey: string,
  ) {
    super();
    this.root = resolve(rootDir);
  }

  async upload(key: string, body: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async deleteUserFolder(userId: string): Promise<void> {
    assertUserId(userId);
    const path = this.safePath(userKeyPrefix(userId).slice(0, -1));
    if (!path) throw new Error(`Unsafe user folder: ${userId}`);
    await rm(path, { recursive: true, force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  download(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async getSignedUrl(key: string): Promise<string> {
    // Valid until the end of the next window: between 1 and 2 hours.
    const expires = signingWindowStart() + 2 * SIGNED_URL_MIN_TTL_SECONDS;
    const signature = this.sign(key, expires);
    const base = this.publicApiUrl.replace(/\/+$/, '');
    return `${base}/api/${LOCAL_FILES_ROUTE}/${key}?exp=${expires}&sig=${signature}`;
  }

  /**
   * Validates a signed request and returns the absolute file path, or null if
   * the key is unsafe, the signature is wrong or the URL has expired.
   */
  resolveSignedPath(key: string, exp: string | undefined, sig: string | undefined): string | null {
    if (!isSafeKey(key) || !exp || !sig || !/^\d+$/.test(exp) || !/^[0-9a-f]{64}$/.test(sig)) {
      return null;
    }
    const expires = Number(exp);
    if (expires < Math.floor(Date.now() / 1000)) return null;
    if (!safeEqualHex(sig, this.sign(key, expires))) return null;
    return this.safePath(key);
  }

  private pathFor(key: string): string {
    const path = isSafeKey(key) ? this.safePath(key) : null;
    if (!path) throw new Error(`Unsafe storage key: ${key}`);
    return path;
  }

  /** Defense in depth: never touch anything outside the storage root. */
  private safePath(key: string): string | null {
    const path = resolve(this.root, key);
    return path.startsWith(this.root + sep) ? path : null;
  }

  private sign(key: string, expires: number): string {
    return createHmac('sha256', this.signingKey).update(`${key}\n${expires}`).digest('hex');
  }
}
