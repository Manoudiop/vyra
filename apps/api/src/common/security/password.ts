import argon2 from 'argon2';

// argon2id with the OWASP-recommended baseline (19 MiB, 2 iterations, 1 lane).
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // Malformed hash: treat as a failed verification, never as a server error.
    return false;
  }
}
