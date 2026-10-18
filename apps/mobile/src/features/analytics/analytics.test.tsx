import { type Profile } from '@vyra/shared';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { authApi } from '@/features/auth/auth-api';
import { useSession } from '@/features/auth/session-store';
import { tokenStorage } from '@/features/auth/token-storage';
import { profileApi } from '@/features/profile/profile-api';
import { subscriptionsApi } from '@/features/subscriptions/subscriptions-api';
import { usageApi } from '@/features/usage/usage-api';
import { ApiError } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { analyticsApi } from './analytics-api';

jest.mock('@/features/auth/auth-api', () => ({
  authApi: { refresh: jest.fn(), me: jest.fn(), logout: jest.fn(async () => undefined) },
}));
jest.mock('./analytics-api', () => ({ analyticsApi: { track: jest.fn(async () => undefined) } }));
jest.mock('@/features/profile/profile-api', () => ({
  ...jest.requireActual('@/features/profile/profile-api'),
  profileApi: { get: jest.fn(), update: jest.fn(), completeOnboarding: jest.fn() },
}));
jest.mock('@/features/subscriptions/subscriptions-api', () => ({
  ...jest.requireActual('@/features/subscriptions/subscriptions-api'),
  subscriptionsApi: {
    plans: jest.fn(async () => []),
    me: jest.fn(),
    checkout: jest.fn(),
    cancel: jest.fn(),
    resume: jest.fn(),
  },
}));
jest.mock('@/features/usage/usage-api', () => ({
  ...jest.requireActual('@/features/usage/usage-api'),
  usageApi: { get: jest.fn(async () => ({ plan: 'FREE', meters: [] })) },
}));

jest.setTimeout(60_000);

const auth = authApi as jest.Mocked<typeof authApi>;
const analytics = analyticsApi as jest.Mocked<typeof analyticsApi>;
const profile = profileApi as jest.Mocked<typeof profileApi>;
const subscriptions = subscriptionsApi as jest.Mocked<typeof subscriptionsApi>;
// Referenced so the mock stays in place for the profile screen's usage card.
void usageApi;

const PROFILE: Profile = {
  firstName: 'Amina',
  lastName: 'Diallo',
  genderPreference: 'WOMEN',
  city: 'Dakar',
  countryCode: 'SN',
  timezone: 'Africa/Dakar',
  locale: 'fr',
  notificationsEnabled: true,
  analyticsEnabled: true,
  onboardingCompleted: true,
  preferredStyles: ['ELEGANT'],
  preferredColors: ['gold'],
  preferredOccasions: ['WORK'],
};

beforeEach(async () => {
  jest.clearAllMocks();
  queryClient.clear();
  await tokenStorage.clear();
  useSession.setState({
    status: 'restoring',
    user: null,
    accessToken: null,
    accessTokenExpiresAt: null,
  });
  await tokenStorage.setRefreshToken('refresh-saved');
  auth.refresh.mockResolvedValue({
    tokens: {
      accessToken: 'access',
      accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      refreshToken: 'refresh-next',
      refreshTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    },
  });
  auth.me.mockResolvedValue({
    id: 'u1',
    email: 'amina@vyra.dev',
    firstName: 'Amina',
    lastName: null,
    avatarUrl: null,
    role: 'USER',
    onboardingCompleted: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  });
  profile.get.mockResolvedValue(PROFILE);
  subscriptions.me.mockResolvedValue({
    plan: 'FREE',
    status: 'ACTIVE',
    provider: 'mock',
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
  });
});

describe('Analytics', () => {
  it('reports the paywall being shown, with its context, once', async () => {
    await renderRouter('./app', { initialUrl: '/paywall?reason=calendar' });
    await screen.findByTestId('paywall-screen');
    await waitFor(() =>
      expect(analytics.track).toHaveBeenCalledWith({
        name: 'paywall_viewed',
        properties: { reason: 'calendar' },
      }),
    );
    expect(analytics.track).toHaveBeenCalledTimes(1);
  });

  it('lets the user turn usage statistics off from the profile', async () => {
    // A server that keeps what it was told.
    profile.update.mockImplementation(async (body) => {
      const next = { ...PROFILE, ...body } as Profile;
      profile.get.mockResolvedValue(next);
      return next;
    });
    await renderRouter('./app', { initialUrl: '/profile' });
    const toggle = await screen.findByTestId('privacy-analytics');
    await waitFor(() => expect(toggle.props.value).toBe(true));
    expect(screen.getByTestId('privacy-card')).toHaveTextContent(/Jamais ton nom, tes photos/);

    await fireEvent(toggle, 'valueChange', false);
    await waitFor(() => expect(profile.update).toHaveBeenCalledWith({ analyticsEnabled: false }));
    await waitFor(() => expect(screen.getByTestId('privacy-analytics').props.value).toBe(false));
  });

  it('puts the switch back if the change fails', async () => {
    profile.update.mockRejectedValue(new ApiError('NETWORK_ERROR', 'offline', 0));
    await renderRouter('./app', { initialUrl: '/profile' });
    const toggle = await screen.findByTestId('privacy-analytics');
    await waitFor(() => expect(toggle.props.value).toBe(true));
    await fireEvent(toggle, 'valueChange', false);
    await waitFor(() => expect(screen.getByTestId('privacy-analytics').props.value).toBe(true));
    expect(
      await screen.findByText('Impossible de joindre VYRA. Vérifie ta connexion.'),
    ).toBeTruthy();
  });
});
