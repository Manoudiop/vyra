/**
 * Object storage abstraction. Business code only ever stores *keys* and asks
 * for short-lived URLs at read time, so the backing service can change freely.
 *
 * Phase 6 needs the read path only; `upload()` and `delete()` (and the S3
 * adapter) are added with the upload pipeline in phase 7.
 */
export abstract class StorageService {
  /** Signed, expiring URL the client can GET directly. */
  abstract getSignedUrl(key: string): string;
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
