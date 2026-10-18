/** Shared by the server helpers and the proxy (which cannot import `server-only` modules). */
export const ACCESS_COOKIE = 'vyra_admin_at';
export const REFRESH_COOKIE = 'vyra_admin_rt';

export function cookieOptions(expiresAt: string) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  };
}

/** Seconds left before a JWT expires, read without verifying (the API verifies). */
export function secondsLeft(jwt: string): number {
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as { exp?: number };
    return payload.exp ? payload.exp - Date.now() / 1000 : 0;
  } catch {
    return 0;
  }
}
