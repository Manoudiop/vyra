import { type AuthTokens } from '@vyra/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, cookieOptions, REFRESH_COOKIE, secondsLeft } from './lib/session-cookies';

const API_URL = (process.env.VYRA_API_URL ?? 'http://localhost:4100/api').replace(/\/+$/, '');
/** Refresh a little before expiry so a page never renders with a dying token. */
const REFRESH_MARGIN_SECONDS = 60;

/**
 * Every admin page needs a session. A missing or expiring access token is
 * renewed with the refresh token (rotated by the API); without a usable
 * session the browser goes to /login.
 */
export async function proxy(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  if (access && secondsLeft(access) > REFRESH_MARGIN_SECONDS) return NextResponse.next();

  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    }).catch(() => null);
    if (res?.ok) {
      const { tokens } = (await res.json()) as { tokens: AuthTokens };
      // Forward the new token to this very request, and store both for the next ones.
      request.cookies.set(ACCESS_COOKIE, tokens.accessToken);
      const response = NextResponse.next({ request });
      response.cookies.set(
        ACCESS_COOKIE,
        tokens.accessToken,
        cookieOptions(tokens.accessTokenExpiresAt),
      );
      response.cookies.set(
        REFRESH_COOKIE,
        tokens.refreshToken,
        cookieOptions(tokens.refreshTokenExpiresAt),
      );
      return response;
    }
  }

  const login = new URL('/login', request.url);
  if (refresh || access) login.searchParams.set('expired', '1');
  const response = NextResponse.redirect(login);
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}

export const config = {
  // Everything but the login page, Next.js internals and static files.
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico).*)'],
};
