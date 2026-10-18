import 'server-only';
import { type AuthTokens } from '@vyra/shared';
import { cookies } from 'next/headers';
import { ACCESS_COOKIE, cookieOptions, REFRESH_COOKIE } from './session-cookies';

/**
 * The admin session lives in two httpOnly cookies set by the server: the
 * browser never sees a token (no XSS exfiltration), SameSite=Strict blocks
 * cross-site requests. Server components read them; server actions and the
 * proxy write them.
 */
export async function readAccessToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_COOKIE)?.value ?? null;
}

export async function readRefreshToken(): Promise<string | null> {
  return (await cookies()).get(REFRESH_COOKIE)?.value ?? null;
}

/** Only callable from a server action or route handler. */
export async function storeSession(tokens: AuthTokens): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(tokens.accessTokenExpiresAt));
  store.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(tokens.refreshTokenExpiresAt));
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}
