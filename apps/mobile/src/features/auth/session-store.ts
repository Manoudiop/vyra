import { type AuthSession, type AuthTokens, type AuthUser } from '@vyra/shared';
import { create } from 'zustand';
import { ApiError } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { authApi } from './auth-api';
import { tokenStorage } from './token-storage';

export type SessionStatus =
  /** Reading the stored refresh token at launch. */
  | 'restoring'
  /** Stored session exists but the API could not be reached: offer a retry. */
  | 'unreachable'
  | 'signedOut'
  | 'signedIn';

interface SessionState {
  status: SessionStatus;
  user: AuthUser | null;
  accessToken: string | null;
  accessTokenExpiresAt: number | null;

  restore(): Promise<void>;
  signIn(session: AuthSession): Promise<void>;
  signOut(): Promise<void>;
  setUser(user: AuthUser): void;
  /** Returns a valid access token, refreshing it if needed. Null when signed out. */
  getValidAccessToken(): Promise<string | null>;
  /** Forces a refresh (single-flight). Signs out if the session is no longer valid. */
  refresh(): Promise<string | null>;
}

/** Refresh a little before expiry to avoid racing the clock. */
const EXPIRY_MARGIN_MS = 30_000;

let refreshInFlight: Promise<string | null> | null = null;

const isAuthError = (error: unknown) => error instanceof ApiError && error.code === 'AUTH_REQUIRED';

export const useSession = create<SessionState>()((set, get) => {
  const applyTokens = async (tokens: AuthTokens) => {
    await tokenStorage.setRefreshToken(tokens.refreshToken);
    set({
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: Date.parse(tokens.accessTokenExpiresAt),
    });
  };

  const clearLocalSession = async () => {
    await tokenStorage.clear();
    queryClient.clear();
    set({ status: 'signedOut', user: null, accessToken: null, accessTokenExpiresAt: null });
  };

  return {
    status: 'restoring',
    user: null,
    accessToken: null,
    accessTokenExpiresAt: null,

    async restore() {
      set({ status: 'restoring' });
      const stored = await tokenStorage.getRefreshToken();
      if (!stored) {
        set({ status: 'signedOut' });
        return;
      }
      try {
        const accessToken = await get().refresh();
        if (!accessToken) return; // refresh() already signed out
        const user = await authApi.me(accessToken);
        set({ status: 'signedIn', user });
      } catch (error) {
        if (isAuthError(error)) await clearLocalSession();
        else set({ status: 'unreachable' });
      }
    },

    async signIn(session) {
      await applyTokens(session.tokens);
      set({ status: 'signedIn', user: session.user });
    },

    async signOut() {
      const stored = await tokenStorage.getRefreshToken();
      // Best effort: the local session ends even if the server cannot be reached.
      if (stored) await authApi.logout(stored).catch(() => undefined);
      await clearLocalSession();
    },

    setUser(user) {
      set({ user });
    },

    async getValidAccessToken() {
      const { accessToken, accessTokenExpiresAt } = get();
      if (
        accessToken &&
        accessTokenExpiresAt &&
        accessTokenExpiresAt - EXPIRY_MARGIN_MS > Date.now()
      ) {
        return accessToken;
      }
      return get().refresh();
    },

    refresh() {
      // Concurrent callers share one request: rotating the same token twice
      // would look like token theft to the API and revoke the session.
      refreshInFlight ??= (async () => {
        try {
          const stored = await tokenStorage.getRefreshToken();
          if (!stored) {
            await clearLocalSession();
            return null;
          }
          const { tokens } = await authApi.refresh(stored);
          await applyTokens(tokens);
          return tokens.accessToken;
        } catch (error) {
          if (isAuthError(error)) {
            await clearLocalSession();
            return null;
          }
          throw error;
        } finally {
          refreshInFlight = null;
        }
      })();
      return refreshInFlight;
    },
  };
});
