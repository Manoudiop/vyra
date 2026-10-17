import { renderRouter, screen, waitFor, fireEvent } from 'expo-router/testing-library';
import { authApi } from '@/features/auth/auth-api';
import { useSession } from '@/features/auth/session-store';
import { tokenStorage } from '@/features/auth/token-storage';

jest.mock('@/features/auth/auth-api', () => ({
  authApi: {
    refresh: jest.fn(),
    me: jest.fn(),
    logout: jest.fn(async () => undefined),
    login: jest.fn(),
    register: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  },
}));

const api = authApi as jest.Mocked<typeof authApi>;
// Relative to the Jest rootDir (apps/mobile): the real route tree is rendered.
const APP_DIR = './app';

// Rendering the whole router is slow on a cold Jest cache.
jest.setTimeout(30_000);

const user = {
  id: 'u1',
  email: 'amina@vyra.dev',
  firstName: 'Amina',
  lastName: 'Diallo',
  avatarUrl: null,
  role: 'USER' as const,
  onboardingCompleted: true,
  createdAt: '2026-10-01T00:00:00.000Z',
};

function freshTokens() {
  return {
    accessToken: 'access',
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    refreshToken: 'refresh-next',
    refreshTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await tokenStorage.clear();
  useSession.setState({
    status: 'restoring',
    user: null,
    accessToken: null,
    accessTokenExpiresAt: null,
  });
});

describe('protected navigation', () => {
  it('sends signed-out visitors to the welcome screen', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByTestId('welcome-screen')).toBeTruthy();
    expect(screen.queryByTestId('home-screen')).toBeNull();
  });

  it('keeps protected tabs unreachable while signed out', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/profile' });
    expect(await screen.findByTestId('welcome-screen')).toBeTruthy();
    expect(screen.queryByTestId('profile-screen')).toBeNull();
  });

  it('restores a saved session and opens the tabs with the central stylist', async () => {
    await tokenStorage.setRefreshToken('refresh-saved');
    api.refresh.mockResolvedValue({ tokens: freshTokens() });
    api.me.mockResolvedValue(user);

    await renderRouter(APP_DIR, { initialUrl: '/' });

    expect(await screen.findByTestId('home-screen')).toBeTruthy();
    // Empty-state title and its call to action.
    expect(screen.getAllByText('Crée ton premier look')).toHaveLength(2);
    expect(screen.getByTestId('tab-stylist')).toBeTruthy();
    expect(api.refresh).toHaveBeenCalledWith('refresh-saved');
  });

  it('navigates between tabs and signs out back to welcome', async () => {
    await tokenStorage.setRefreshToken('refresh-saved');
    api.refresh.mockResolvedValue({ tokens: freshTokens() });
    api.me.mockResolvedValue(user);
    globalThis.confirm = () => true;

    await renderRouter(APP_DIR, { initialUrl: '/' });
    await screen.findByTestId('home-screen');

    await fireEvent.press(screen.getByTestId('tab-stylist'));
    expect(await screen.findByTestId('stylist-screen')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('tab-profile'));
    expect(await screen.findByText('amina@vyra.dev')).toBeTruthy();

    useSession.getState().signOut();
    await waitFor(() => expect(screen.getByTestId('welcome-screen')).toBeTruthy());
    expect(api.logout).toHaveBeenCalledWith('refresh-next');
  });

  it('shows a retry screen when the API is unreachable at launch', async () => {
    const { ApiError } = jest.requireActual('@/lib/api-client');
    await tokenStorage.setRefreshToken('refresh-saved');
    api.refresh.mockRejectedValue(new ApiError('NETWORK_ERROR', 'offline', null));

    await renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByTestId('unreachable-screen')).toBeTruthy();
  });
});
