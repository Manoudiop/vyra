import { type AuthSession } from '@vyra/shared';
import { ApiError } from '@/lib/api-client';
import { authApi } from './auth-api';
import { useSession } from './session-store';
import { tokenStorage } from './token-storage';

jest.mock('./auth-api', () => ({
  authApi: { refresh: jest.fn(), me: jest.fn(), logout: jest.fn() },
}));

const api = authApi as jest.Mocked<typeof authApi>;

const user = {
  id: 'u1',
  email: 'amina@vyra.dev',
  firstName: 'Amina',
  lastName: null,
  avatarUrl: null,
  role: 'USER' as const,
  onboardingCompleted: true,
  createdAt: '2026-10-01T00:00:00.000Z',
};

const tokens = (suffix: string, expiresInMs = 15 * 60_000) => ({
  accessToken: `access-${suffix}`,
  accessTokenExpiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  refreshToken: `refresh-${suffix}`,
  refreshTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
});

const session = (suffix: string, expiresInMs?: number): AuthSession => ({
  user,
  tokens: tokens(suffix, expiresInMs),
});

beforeEach(async () => {
  jest.clearAllMocks();
  await tokenStorage.clear();
  useSession.setState({
    status: 'signedOut',
    user: null,
    accessToken: null,
    accessTokenExpiresAt: null,
  });
});

describe('session store', () => {
  it('stores only the refresh token on sign in', async () => {
    await useSession.getState().signIn(session('a'));
    expect(useSession.getState()).toMatchObject({
      status: 'signedIn',
      user,
      accessToken: 'access-a',
    });
    await expect(tokenStorage.getRefreshToken()).resolves.toBe('refresh-a');
  });

  it('reuses a fresh access token without calling the API', async () => {
    await useSession.getState().signIn(session('a'));
    await expect(useSession.getState().getValidAccessToken()).resolves.toBe('access-a');
    expect(api.refresh).not.toHaveBeenCalled();
  });

  it('shares one refresh between concurrent callers (single flight)', async () => {
    await useSession.getState().signIn(session('a', 1_000)); // expires within the margin
    let resolve!: (value: { tokens: ReturnType<typeof tokens> }) => void;
    api.refresh.mockReturnValue(new Promise((r) => (resolve = r)));

    const calls = [
      useSession.getState().getValidAccessToken(),
      useSession.getState().getValidAccessToken(),
      useSession.getState().refresh(),
    ];
    resolve({ tokens: tokens('b') });

    await expect(Promise.all(calls)).resolves.toEqual(['access-b', 'access-b', 'access-b']);
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(api.refresh).toHaveBeenCalledWith('refresh-a');
    await expect(tokenStorage.getRefreshToken()).resolves.toBe('refresh-b');
  });

  it('signs out when the refresh token is rejected', async () => {
    await useSession.getState().signIn(session('a', 0));
    api.refresh.mockRejectedValue(new ApiError('AUTH_REQUIRED', 'expired', 401));

    await expect(useSession.getState().getValidAccessToken()).resolves.toBeNull();
    expect(useSession.getState().status).toBe('signedOut');
    await expect(tokenStorage.getRefreshToken()).resolves.toBeNull();
  });

  describe('restore at launch', () => {
    it('is signed out without a stored token', async () => {
      await useSession.getState().restore();
      expect(useSession.getState().status).toBe('signedOut');
      expect(api.refresh).not.toHaveBeenCalled();
    });

    it('restores the session from the stored refresh token', async () => {
      await tokenStorage.setRefreshToken('refresh-stored');
      api.refresh.mockResolvedValue({ tokens: tokens('c') });
      api.me.mockResolvedValue(user);

      await useSession.getState().restore();
      expect(useSession.getState()).toMatchObject({
        status: 'signedIn',
        user,
        accessToken: 'access-c',
      });
      expect(api.me).toHaveBeenCalledWith('access-c');
    });

    it('keeps the stored session and offers a retry when offline', async () => {
      await tokenStorage.setRefreshToken('refresh-stored');
      api.refresh.mockRejectedValue(new ApiError('NETWORK_ERROR', 'offline', null));

      await useSession.getState().restore();
      expect(useSession.getState().status).toBe('unreachable');
      await expect(tokenStorage.getRefreshToken()).resolves.toBe('refresh-stored');
    });
  });

  it('signs out locally even if the logout call fails', async () => {
    await useSession.getState().signIn(session('a'));
    api.logout.mockRejectedValue(new ApiError('NETWORK_ERROR', 'offline', null));

    await useSession.getState().signOut();
    expect(api.logout).toHaveBeenCalledWith('refresh-a');
    expect(useSession.getState()).toMatchObject({
      status: 'signedOut',
      user: null,
      accessToken: null,
    });
    await expect(tokenStorage.getRefreshToken()).resolves.toBeNull();
  });
});
