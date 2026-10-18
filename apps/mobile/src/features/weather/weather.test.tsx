import { type Outfit, type WeatherSnapshot } from '@vyra/shared';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { authApi } from '@/features/auth/auth-api';
import { useSession } from '@/features/auth/session-store';
import { tokenStorage } from '@/features/auth/token-storage';
import { calendarApi } from '@/features/calendar/calendar-api';
import { closetApi } from '@/features/closet/closet-api';
import { stylistApi } from '@/features/stylist/stylist-api';
import { queryClient } from '@/lib/query-client';
import { weatherApi } from './weather-api';

jest.mock('@/features/auth/auth-api', () => ({
  authApi: { refresh: jest.fn(), me: jest.fn(), logout: jest.fn(async () => undefined) },
}));
jest.mock('./weather-api', () => ({
  ...jest.requireActual('./weather-api'),
  weatherApi: { get: jest.fn() },
}));
jest.mock('@/features/calendar/calendar-api', () => ({
  ...jest.requireActual('@/features/calendar/calendar-api'),
  calendarApi: { month: jest.fn(), plan: jest.fn(), unplan: jest.fn(), wearHistory: jest.fn() },
}));
jest.mock('@/features/closet/closet-api', () => ({
  ...jest.requireActual('@/features/closet/closet-api'),
  closetApi: { list: jest.fn(), summary: jest.fn(), get: jest.fn() },
}));
jest.mock('@/features/stylist/stylist-api', () => ({
  ...jest.requireActual('@/features/stylist/stylist-api'),
  stylistApi: { generate: jest.fn(), getOutfit: jest.fn() },
}));

jest.setTimeout(60_000);

const auth = authApi as jest.Mocked<typeof authApi>;
const weather = weatherApi as jest.Mocked<typeof weatherApi>;
const calendar = calendarApi as jest.Mocked<typeof calendarApi>;
const closet = closetApi as jest.Mocked<typeof closetApi>;
const stylist = stylistApi as jest.Mocked<typeof stylistApi>;

const snapshot = (overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot => ({
  city: 'Dakar',
  date: '2026-10-18',
  kind: 'CURRENT',
  temperatureC: 29.4,
  minC: 24,
  maxC: 31,
  feelsLikeC: 33,
  condition: 'SUNNY',
  humidity: 74,
  rainProbability: 0.1,
  windKph: 12,
  provider: 'mock',
  fetchedAt: '2026-10-18T09:00:00.000Z',
  ...overrides,
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
  calendar.month.mockImplementation(async (month) => ({
    month,
    today: `${month}-18`,
    days: [],
    access: null,
  }));
  closet.list.mockResolvedValue({ items: [], nextCursor: null });
});

describe('Weather', () => {
  it('shows today’s weather on the home screen with what it means for the look', async () => {
    weather.get.mockResolvedValue({ weather: snapshot(), reason: null });
    await renderRouter('./app', { initialUrl: '/' });
    expect(await screen.findByTestId('weather-card')).toBeTruthy();
    expect(screen.getByTestId('weather-city')).toHaveTextContent('Dakar');
    expect(screen.getByTestId('weather-temperature')).toHaveTextContent('29°');
    expect(screen.getByText('Ensoleillé')).toBeTruthy();
    expect(screen.getByTestId('weather-tip')).toHaveTextContent(/Il fait chaud/);
    expect(weather.get).toHaveBeenCalledWith(null);
  });

  it('warns about rain', async () => {
    weather.get.mockResolvedValue({
      weather: snapshot({ condition: 'RAIN', rainProbability: 0.8, maxC: 27 }),
      reason: null,
    });
    await renderRouter('./app', { initialUrl: '/' });
    expect(await screen.findByTestId('weather-tip')).toHaveTextContent(/chaussures ouvertes/);
    expect(screen.getByTestId('weather-rain')).toHaveTextContent('Pluie 80 %');
  });

  it('asks for a city when the profile has none', async () => {
    weather.get.mockResolvedValue({ weather: null, reason: 'NO_CITY' });
    await renderRouter('./app', { initialUrl: '/' });
    expect(await screen.findByTestId('weather-missing')).toHaveTextContent(/Ajoute ta ville/);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter ma ville' }));
    expect(await screen.findByTestId('edit-profile-screen')).toBeTruthy();
  });

  it('shows the look planned for today on the home screen', async () => {
    weather.get.mockResolvedValue({ weather: null, reason: 'UNAVAILABLE' });
    calendar.month.mockImplementation(async (month) => ({
      month,
      today: `${month}-18`,
      days: [
        {
          date: `${month}-18`,
          planned: {
            id: 'e1',
            date: `${month}-18`,
            occasion: null,
            notes: 'Réunion équipe',
            outfit: {
              id: 'o1',
              name: 'Lin et beige',
              occasion: 'WORK',
              style: 'SMART_CASUAL',
              thumbnails: [],
            },
          },
          worn: [],
        },
      ],
      access: null,
    }));
    await renderRouter('./app', { initialUrl: '/' });
    expect(await screen.findByTestId('home-planned')).toHaveTextContent(/Lin et beige/);
    expect(screen.getByText('Réunion équipe')).toBeTruthy();
    expect(screen.getByTestId('weather-missing')).toHaveTextContent(/Météo indisponible/);
  });

  it('shows the forecast of the planned day on the stylist', async () => {
    weather.get.mockResolvedValue({
      weather: snapshot({ kind: 'FORECAST', maxC: 26, condition: 'STORM', rainProbability: 0.9 }),
      reason: null,
    });
    await renderRouter('./app', { initialUrl: '/stylist?date=2026-10-22' });
    expect(await screen.findByTestId('stylist-weather')).toHaveTextContent(
      '26 °C · Orage · Pluie 90 %',
    );
    await waitFor(() => expect(weather.get).toHaveBeenCalledWith('2026-10-22'));
  });

  it('shows the weather a look was composed for', async () => {
    weather.get.mockResolvedValue({ weather: snapshot(), reason: null });
    const outfit: Outfit = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Dîner sous la pluie',
      occasion: 'DINNER',
      style: 'ELEGANT',
      reason: 'Test',
      score: 0.8,
      isSaved: false,
      constraints: null,
      items: [],
      feedback: null,
      wornToday: false,
      weather: { temperatureC: 27, condition: 'RAIN', rainProbability: 0.85 },
      lastWornAt: null,
      createdAt: '2026-10-18T09:00:00.000Z',
    };
    stylist.getOutfit.mockResolvedValue(outfit);
    await renderRouter('./app', { initialUrl: `/outfit/${outfit.id}` });
    expect(await screen.findByTestId('outfit-weather')).toHaveTextContent(
      'Pensé pour 27 °C · Pluie · Pluie 85 %',
    );
  });
});
