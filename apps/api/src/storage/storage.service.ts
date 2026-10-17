/**
 * Object storage abstraction. Business code only ever stores *keys* and asks
 * for short-lived URLs at read time, so the backing service can change freely
 * (local disk in development, any S3-compatible service otherwise).
 */
export abstract class StorageService {
  abstract upload(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Idempotent: deleting a missing object is not an error. */
  abstract delete(key: string): Promise<void>;
  abstract exists(key: string): Promise<boolean>;
  /** Signed, expiring URL the client can GET directly. */
  abstract getSignedUrl(key: string): Promise<string>;
}

/** Signed URLs stay valid for at least this long. */
export const SIGNED_URL_MIN_TTL_SECONDS = 60 * 60;

/**
 * Start of the current signing window. URLs signed within the same hour are
 * byte-identical, so clients (expo-image) can cache images by URL.
 */
export function signingWindowStart(now = Date.now()): number {
  const seconds = Math.floor(now / 1000);
  return seconds - (seconds % SIGNED_URL_MIN_TTL_SECONDS);
}

/** Keys are always namespaced per user: `users/<userId>/...`. */
export function userKeyPrefix(userId: string): string {
  return `users/${userId}/`;
}

/** Safe object key: no traversal, no absolute paths, conservative charset. */
export function isSafeKey(key: string): boolean {
  return (
    key.length > 0 &&
    key.length <= 300 &&
    /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(key) &&
    !key.split('/').some((segment) => segment === '..' || segment === '.' || segment === '')
  );
}
