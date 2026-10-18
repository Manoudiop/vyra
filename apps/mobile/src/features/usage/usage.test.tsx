import { type Outfit, type UsageResponse } from '@vyra/shared';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { authApi } from '@/features/auth/auth-api';
import { useSession } from '@/features/auth/session-store';
import { tokenStorage } from '@/features/auth/token-storage';
import { calendarApi } from '@/features/calendar/calendar-api';
import { closetApi } from '@/features/closet/closet-api';
import { stylistApi } from '@/features/stylist/stylist-api';
import { weatherApi } from '@/features/weather/weather-api';
import { ApiError } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { usageApi } from './usage-api';

jest.mock('@/features/auth/auth-api', () => ({
  authApi: { refresh: jest.fn(), me: jest.fn(), logout: jest.fn(async () => undefined) },
}));
jest.mock('./usage-api', () => ({
  ...jest.requireActual('./usage-api'),
  usageApi: { get: jest.fn() },
}));
jest.mock('@/features/stylist/stylist-api', () => ({
  ...jest.requireActual('@/features/stylist/stylist-api'),
  stylistApi: { generate: jest.fn(), getOutfit: jest.fn() },
}));
jest.mock('@/features/closet/closet-api', () => ({
  ...jest.requireActual('@/features/closet/closet-api'),
  closetApi: { list: jest.fn(), summary: jest.fn(), get: jest.fn() },
}));
jest.mock('@/features/weather/weather-api', () => ({
  ...jest.requireActual('@/features/weather/weather-api'),
  weatherApi: { get: jest.fn() },
}));
jest.mock('@/features/calendar/calendar-api', () => ({
  ...jest.requireActual('@/features/calendar/calendar-api'),
  calendarApi: { month: jest.fn(), plan: jest.fn(), unplan: jest.fn(), wearHistory: jest.fn() },
}));

jest.setTimeout(60_000);

const auth = authApi as jest.Mocked<typeof authApi>;
const usage = usageApi as jest.Mocked<typeof usageApi>;
const stylist = stylistApi as jest.Mocked<typeof stylistApi>;
const closet = closetApi as jest.Mocked<typeof closetApi>;
const weather = weatherApi as jest.Mocked<typeof weatherApi>;
const calendar = calendarApi as jest.Mocked<typeof calendarApi>;

const MONDAY = '2026-10-19T00:00:00.000Z';
const free = (used: number, analyses = 6): UsageResponse => ({
  plan: 'FREE',
  meters: [
    {
      metric: 'OUTFIT_GENERATION',
      used,
      limit: 3,
      remaining: Math.max(0, 3 - used),
      period: 'WEEK',
      resetsAt: MONDAY,
    },
    {
      metric: 'CLOTHING_ANALYSIS',
      used: analyses,
      limit: 30,
      remaining: 30 - analyses,
      period: 'MONTH',
      resetsAt: '2026-11-01T00:00:00.000Z',
    },
  ],
});
const LIMIT = new ApiError('LIMIT_REACHED', 'used up', 402, {
  metric: 'OUTFIT_GENERATION',
  limit: 3,
  used: 3,
  period: 'WEEK',
  resetsAt: MONDAY,
  currentPlan: 'FREE',
  suggestedPlan: 'PRO',
});

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
  closet.list.mockResolvedValue({ items: [], nextCursor: null });
  weather.get.mockResolvedValue({ weather: null, reason: 'NO_CITY' });
  calendar.month.mockImplementation(async (month) => ({
    month,
    today: `${month}-18`,
    days: [],
    access: null,
  }));
});

describe('Usage limits', () => {
  it('shows how many looks are left', async () => {
    usage.get.mockResolvedValue(free(1));
    await renderRouter('./app', { initialUrl: '/stylist' });
    expect(await screen.findByTestId('generations-left')).toHaveTextContent(
      '2 looks restants cette semaine',
    );
  });

  it('blocks generation cleanly once the week is used up', async () => {
    usage.get.mockResolvedValue(free(3));
    await renderRouter('./app', { initialUrl: '/stylist' });
    const card = await screen.findByTestId('generations-used-up');
    expect(card).toHaveTextContent(/Tes 3 looks de la semaine sont utilisés/);
    expect(card).toHaveTextContent(/De nouveaux looks arrivent lundi 19 octobre/);
    expect(screen.getByTestId('usage-upgrade-hint')).toHaveTextContent(
      'Avec VYRA Pro : 5 looks par jour.',
    );
    await fireEvent.press(screen.getByTestId('occasion-WORK'));
    expect(screen.getByTestId('stylist-generate')).toBeDisabled();
    expect(stylist.generate).not.toHaveBeenCalled();
  });

  it('explains a refusal from the API and refreshes the counters', async () => {
    usage.get.mockResolvedValueOnce(free(2)).mockResolvedValue(free(3));
    stylist.generate.mockRejectedValue(LIMIT);
    await renderRouter('./app', { initialUrl: '/stylist' });
    await screen.findByTestId('generations-left');
    await fireEvent.press(screen.getByTestId('occasion-WORK'));
    await fireEvent.press(screen.getByTestId('stylist-generate'));
    expect(await screen.findByTestId('generations-used-up', {}, { timeout: 5000 })).toBeTruthy();
    await waitFor(() => expect(usage.get).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('explains it on "another look" too', async () => {
    usage.get.mockResolvedValue(free(3));
    const outfit: Outfit = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Bureau impeccable',
      occasion: 'WORK',
      style: 'SMART_CASUAL',
      reason: 'Test',
      score: 0.8,
      isSaved: false,
      constraints: null,
      items: [],
      feedback: null,
      wornToday: false,
      weather: null,
      lastWornAt: null,
      createdAt: '2026-10-18T09:00:00.000Z',
    };
    stylist.getOutfit.mockResolvedValue(outfit);
    stylist.generate.mockRejectedValue(LIMIT);
    await renderRouter('./app', { initialUrl: `/outfit/${outfit.id}` });
    await fireEvent.press(await screen.findByTestId('outfit-another'));
    expect(
      await screen.findByTestId('generations-used-up', {}, { timeout: 5000 }),
    ).toHaveTextContent(/lundi 19 octobre/);
  });

  it('shows the plan and its meters on the profile', async () => {
    usage.get.mockResolvedValue(free(2, 6));
    await renderRouter('./app', { initialUrl: '/profile' });
    expect(await screen.findByTestId('plan-name')).toHaveTextContent('Gratuit');
    expect(screen.getByTestId('meter-OUTFIT_GENERATION')).toHaveTextContent(/2 \/ 3 par semaine/);
    expect(screen.getByTestId('meter-OUTFIT_GENERATION')).toHaveTextContent(
      /Renouvellement lundi 19 octobre/,
    );
    expect(screen.getByTestId('meter-CLOTHING_ANALYSIS')).toHaveTextContent(/6 \/ 30 par mois/);
  });

  it('shows unlimited meters as such', async () => {
    usage.get.mockResolvedValue({
      plan: 'PREMIUM',
      meters: [
        {
          metric: 'CLOTHING_ANALYSIS',
          used: 12,
          limit: null,
          remaining: null,
          period: 'DAY',
          resetsAt: '2026-10-19T00:00:00.000Z',
        },
      ],
    });
    await renderRouter('./app', { initialUrl: '/profile' });
    expect(await screen.findByTestId('plan-name')).toHaveTextContent('VYRA Premium');
    expect(screen.getByTestId('meter-CLOTHING_ANALYSIS')).toHaveTextContent(/12 · illimité/);
  });
});
