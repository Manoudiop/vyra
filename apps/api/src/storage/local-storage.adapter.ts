import { createHmac } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { safeEqualHex } from '../common/security/tokens';
import { isSafeKey, StorageService } from './storage.service';

export const LOCAL_FILES_ROUTE = 'storage/files';
const URL_TTL_SECONDS = 60 * 60;

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

  getSignedUrl(key: string): string {
    // Expiry is rounded up to the next hour so a URL stays identical for a while:
    // clients (expo-image) can then cache images by URL across list refreshes.
    const now = Math.floor(Date.now() / 1000);
    const expires = Math.ceil((now + URL_TTL_SECONDS) / URL_TTL_SECONDS) * URL_TTL_SECONDS;
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

    const path = resolve(this.root, key);
    // Defense in depth: never serve anything outside the storage root.
    return path.startsWith(this.root + sep) ? path : null;
  }

  private sign(key: string, expires: number): string {
    return createHmac('sha256', this.signingKey).update(`${key}\n${expires}`).digest('hex');
  }
}
