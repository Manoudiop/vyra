import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** High-entropy opaque token (256 bits), URL-safe. */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Uniformly random numeric code, zero-padded (e.g. "042917"). */
export function generateNumericCode(length: number): string {
  return randomInt(0, 10 ** length)
    .toString()
    .padStart(length, '0');
}

/**
 * Keyed hash for secrets stored at rest (refresh tokens, reset codes). A leaked
 * table is useless without the key, and lookups stay O(1) via a unique index.
 */
export function hmacSha256(key: string, value: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}
