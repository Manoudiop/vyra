import { type PlanOffer, type Subscription, type UsageResponse } from '@vyra/shared';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { authApi } from '@/features/auth/auth-api';
import { useSession } from '@/features/auth/session-store';
import { tokenStorage } from '@/features/auth/token-storage';
import { closetApi } from '@/features/closet/closet-api';
import { usageApi, usageKeys } from '@/features/usage/usage-api';
import { weatherApi } from '@/features/weather/weather-api';
import { queryClient } from '@/lib/query-client';
import { subscriptionsApi } from './subscriptions-api';

jest.mock('@/features/auth/auth-api', () => ({
  authApi: { refresh: jest.fn(), me: jest.fn(), logout: jest.fn(async () => undefined) },
}));
jest.mock('./subscriptions-api', () => ({
  ...jest.requireActual('./subscriptions-api'),
  subscriptionsApi: {
    plans: jest.fn(),
    me: jest.fn(),
    checkout: jest.fn(),
    cancel: jest.fn(),
    resume: jest.fn(),
  },
}));
jest.mock('@/features/usage/usage-api', () => ({
  ...jest.requireActual('@/features/usage/usage-api'),
  usageApi: { get: jest.fn() },
}));
jest.mock('@/features/closet/closet-api', () => ({
  ...jest.requireActual('@/features/closet/closet-api'),
  closetApi: { list: jest.fn(), summary: jest.fn(), get: jest.fn() },
}));
jest.mock('@/features/weather/weather-api', () => ({
  ...jest.requireActual('@/features/weather/weather-api'),
  weatherApi: { get: jest.fn() },
}));

jest.setTimeout(60_000);

const auth = authApi as jest.Mocked<typeof authApi>;
const api = subscriptionsApi as jest.Mocked<typeof subscriptionsApi>;
const usage = usageApi as jest.Mocked<typeof usageApi>;
const closet = closetApi as jest.Mocked<typeof closetApi>;
const weather = weatherApi as jest.Mocked<typeof weatherApi>;

const OFFERS: PlanOffer[] = [
  {
    plan: 'FREE',
    monthlyPriceXof: 0,
    maxClothingItems: 30,
    metered: [
      { metric: 'OUTFIT_GENERATION', limit: 3, period: 'WEEK' },
      { metric: 'CLOTHING_ANALYSIS', limit: 30, period: 'MONTH' },
    ],
    features: ['WEATHER'],
  },
  {
    plan: 'PRO',
    monthlyPriceXof: 2500,
    maxClothingItems: null,
    metered: [
      { metric: 'OUTFIT_GENERATION', limit: 5, period: 'DAY' },
      { metric: 'CLOTHING_ANALYSIS', limit: 100, period: 'DAY' },
    ],
    features: ['WEATHER', 'CALENDAR_FULL', 'WEAR_HISTORY_FULL'],
  },
  {
    plan: 'PREMIUM',
    monthlyPriceXof: 5000,
    maxClothingItems: null,
    metered: [
      { metric: 'OUTFIT_GENERATION', limit: 20, period: 'DAY' },
      { metric: 'CLOTHING_ANALYSIS', limit: 100, period: 'DAY' },
    ],
    features: [
      'WEATHER',
      'CALENDAR_FULL',
      'WEAR_HISTORY_FULL',
      'STYLE_ANALYSIS',
      'EVENT_STYLING',
      'SHOPPING_RECOMMENDATIONS',
    ],
  },
];

const FREE: Subscription = {
  plan: 'FREE',
  status: 'ACTIVE',
  provider: 'mock',
  currentPeriodStart: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  canceledAt: null,
};
const PRO: Subscription = {
  ...FREE,
  plan: 'PRO',
  currentPeriodStart: '2026-10-18T10:00:00.000Z',
  currentPeriodEnd: '2026-11-18T10:00:00.000Z',
};
const USAGE: UsageResponse = {
  plan: 'FREE',
  meters: [
    {
      metric: 'OUTFIT_GENERATION',
      used: 3,
      limit: 3,
      remaining: 0,
      period: 'WEEK',
      resetsAt: '2026-10-19T00:00:00.000Z',
    },
  ],
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
  api.plans.mockResolvedValue(OFFERS);
  api.me.mockResolvedValue(FREE);
  usage.get.mockResolvedValue(USAGE);
  closet.list.mockResolvedValue({ items: [], nextCursor: null });
  weather.get.mockResolvedValue({ weather: null, reason: 'NO_CITY' });
});

describe('Paywall', () => {
  it('can be closed at once, states prices plainly and confirms before paying', async () => {
    api.checkout.mockResolvedValue({ status: 'COMPLETED', paymentUrl: null, subscription: PRO });
    queryClient.setQueryData(usageKeys.all, USAGE);
    await renderRouter('./app', { initialUrl: '/paywall?reason=generations' });

    expect(await screen.findByTestId('paywall-close')).toBeTruthy();
    expect(screen.getByTestId('paywall-reason')).toHaveTextContent(/Tes looks de la période/);
    expect(await screen.findByTestId('paywall-plan-PRO')).toBeChecked();
    expect(screen.getByTestId('paywall-plan-PRO')).toHaveTextContent(/2 500 FCFA/);
    expect(screen.getByTestId('paywall-plan-PRO')).toHaveTextContent(/5 looks générés par jour/);
    expect(screen.getByTestId('paywall-plan-PREMIUM')).toHaveTextContent(/Analyse IA de ton style/);
    // Features that do not exist yet are not sold.
    expect(screen.queryByText(/shopping/i)).toBeNull();
    expect(await screen.findByTestId('paywall-demo-notice')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('paywall-continue'));
    expect(screen.getByTestId('paywall-confirm-summary')).toHaveTextContent(
      /VYRA Pro : 2 500 FCFA par mois, renouvelé automatiquement/,
    );
    expect(api.checkout).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('paywall-pay'));
    await waitFor(() => expect(api.checkout).toHaveBeenCalledWith('PRO'));
    expect(await screen.findByTestId('paywall-done')).toHaveTextContent(/Bienvenue dans VYRA Pro/);
    // Plan-gated data is marked stale and refetched where it is shown.
    expect(queryClient.getQueryState(usageKeys.all)?.isInvalidated).toBe(true);
  });

  it('suggests Premium to a Pro member and marks the current plan', async () => {
    api.me.mockResolvedValue(PRO);
    await renderRouter('./app', { initialUrl: '/paywall' });
    await waitFor(() => expect(screen.getByTestId('paywall-plan-PREMIUM')).toBeChecked());
    expect(screen.getByTestId('paywall-plan-PRO')).toHaveTextContent(/Ton offre actuelle/);
    await fireEvent.press(screen.getByTestId('paywall-plan-PRO'));
    expect(screen.getByTestId('paywall-continue')).toBeDisabled();
  });

  it('is reached from a used-up limit with its context', async () => {
    await renderRouter('./app', { initialUrl: '/stylist' });
    await fireEvent.press(await screen.findByTestId('see-offers-generations'));
    expect(await screen.findByTestId('paywall-reason')).toHaveTextContent(/Tes looks/);
  });
});

describe('Subscription management', () => {
  it('leads a free member to the plans', async () => {
    await renderRouter('./app', { initialUrl: '/profile' });
    await fireEvent.press(await screen.findByTestId('profile-subscription'));
    expect(await screen.findByTestId('subscription-plan')).toHaveTextContent('Gratuit');
    await fireEvent.press(screen.getByTestId('subscription-discover'));
    expect(await screen.findByTestId('paywall-screen')).toBeTruthy();
  });

  it('cancels with a clear confirmation, then can be undone', async () => {
    api.me.mockResolvedValue(PRO);
    api.cancel.mockResolvedValue({
      ...PRO,
      cancelAtPeriodEnd: true,
      canceledAt: '2026-10-20T10:00:00.000Z',
    });
    api.resume.mockResolvedValue(PRO);
    await renderRouter('./app', { initialUrl: '/subscription' });
    expect(await screen.findByTestId('subscription-status')).toHaveTextContent(
      'Renouvellement le 18 novembre 2026.',
    );

    await fireEvent.press(screen.getByTestId('subscription-cancel'));
    expect(screen.getByTestId('subscription-cancel-confirm')).toHaveTextContent(
      /Tu gardes VYRA Pro jusqu’au 18 novembre 2026/,
    );
    // Keeping is as easy as canceling.
    await fireEvent.press(screen.getByTestId('subscription-cancel-keep'));
    expect(screen.queryByTestId('subscription-cancel-confirm')).toBeNull();

    await fireEvent.press(screen.getByTestId('subscription-cancel'));
    await fireEvent.press(screen.getByTestId('subscription-cancel-confirm-button'));
    await waitFor(() => expect(api.cancel).toHaveBeenCalled());
    expect(await screen.findByTestId('subscription-status')).toHaveTextContent(
      /Résilié : VYRA Pro reste actif jusqu’au 18 novembre 2026/,
    );

    await fireEvent.press(screen.getByTestId('subscription-resume'));
    await waitFor(() => expect(api.resume).toHaveBeenCalled());
    expect(await screen.findByTestId('subscription-cancel')).toBeTruthy();
  });
});
