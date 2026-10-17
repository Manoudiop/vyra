import { useSession } from '@/features/auth/session-store';
import { ApiError, apiRequest, type RequestOptions } from './api-client';

/**
 * Request on behalf of the signed-in user. Attaches the access token, refreshes
 * it when expired, and retries once if the API still answers AUTH_REQUIRED
 * (e.g. token revoked server-side). If the session is gone, the store signs out
 * and the router sends the user back to the welcome screen.
 */
export async function authorizedRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const session = useSession.getState();
  const token = await session.getValidAccessToken();
  if (!token) throw new ApiError('AUTH_REQUIRED', 'Not signed in', 401);

  try {
    return await apiRequest<T>(path, withBearer(options, token));
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== 'AUTH_REQUIRED') throw error;
    const refreshed = await session.refresh();
    if (!refreshed) throw error;
    return apiRequest<T>(path, withBearer(options, refreshed));
  }
}

function withBearer(options: RequestOptions, token: string): RequestOptions {
  return { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } };
}
