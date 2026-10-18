import { type ClothingItem, type StyleProfile } from '@vyra/shared';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { authApi } from '@/features/auth/auth-api';
import { useSession } from '@/features/auth/session-store';
import { tokenStorage } from '@/features/auth/token-storage';
import { ApiError } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { styleApi } from './style-api';

jest.mock('@/features/auth/auth-api', () => ({
  authApi: { refresh: jest.fn(), me: jest.fn(), logout: jest.fn(async () => undefined) },
}));
jest.mock('./style-api', () => ({
  ...jest.requireActual('./style-api'),
  styleApi: { profile: jest.fn(), analyze: jest.fn() },
}));

jest.setTimeout(60_000);

const auth = authApi as jest.Mocked<typeof authApi>;
const style = styleApi as jest.Mocked<typeof styleApi>;

const piece = (id: string, name: string): ClothingItem => ({
  id,
  name,
  category: 'TOPS',
  subcategory: null,
  color: 'navy',
  colorHex: null,
  style: 'SMART_CASUAL',
  season: 'ALL_SEASON',
  isFavorite: false,
  imageUrl: `https://img.test/${id}.webp`,
  thumbnailUrl: `https://img.test/${id}_thumb.webp`,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
});

const EMPTY: StyleProfile = {
  declared: { styles: ['SMART_CASUAL'], colors: ['navy'], occasions: ['WORK'] },
  learned: {
    colors: [],
    avoidedColors: [],
    styles: [],
    avoidedStyles: [],
    occasionStyles: [],
    favoritePieces: [],
    avoidedPieces: [],
  },
  signals: { loves: 1, dislikes: 0, wears: 1, saves: 0 },
  ready: false,
  computedAt: '2026-10-18T09:00:00.000Z',
  analysis: null,
  canAnalyze: false,
};

const LEARNED: StyleProfile = {
  ...EMPTY,
  learned: {
    colors: [
      { value: 'navy', weight: 0.7 },
      { value: 'beige', weight: 0.4 },
    ],
    avoidedColors: [{ value: 'red', weight: -0.6 }],
    styles: [{ value: 'SMART_CASUAL', weight: 0.8 }],
    avoidedStyles: [],
    occasionStyles: [{ occasion: 'WEDDING', style: 'TRADITIONAL', weight: 0.6 }],
    favoritePieces: [piece('fav-1', 'Blazer marine')],
    avoidedPieces: [piece('nope-1', 'Chemise rouge')],
  },
  signals: { loves: 4, dislikes: 2, wears: 5, saves: 1 },
  ready: true,
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
});

describe('My style', () => {
  it('says it is still learning until there are enough signals', async () => {
    style.profile.mockResolvedValue(EMPTY);
    await renderRouter('./app', { initialUrl: '/style-profile' });
    expect(await screen.findByTestId('style-learning')).toBeTruthy();
    expect(screen.getByText('2 / 3 signaux')).toBeTruthy();
    // Declared choices are shown as they are.
    expect(screen.getByText('Smart casual · Marine')).toBeTruthy();
  });

  it('shows what was learned: colors, styles, occasion habits, pieces and aversions', async () => {
    style.profile.mockResolvedValue(LEARNED);
    await renderRouter('./app', { initialUrl: '/style-profile' });
    expect(await screen.findByTestId('style-colors')).toBeTruthy();
    expect(screen.getByTestId('style-signals')).toHaveTextContent(/4 coup\(s\) de cœur/);
    expect(screen.getByTestId('habit-WEDDING')).toHaveTextContent(/Mariage.*Traditionnel/);
    expect(screen.getByLabelText('Blazer marine')).toBeTruthy();
    expect(screen.getByTestId('style-avoided-colors')).toBeTruthy();
    expect(screen.getByLabelText('Chemise rouge')).toBeTruthy();
    expect(screen.getByTestId('style-analysis-locked')).toHaveTextContent(/VYRA Premium/);
  });

  it('runs the PREMIUM style analysis and shows it', async () => {
    style.profile.mockResolvedValue({ ...LEARNED, canAnalyze: true });
    style.analyze.mockResolvedValue({
      summary: 'Ton style penche vers le smart casual.',
      dominantStyles: ['SMART_CASUAL'],
      signatureColors: ['navy'],
      suggestions: ['Une deuxième paire de derbies élargirait tes combinaisons.'],
      createdAt: '2026-10-18T10:00:00.000Z',
    });
    await renderRouter('./app', { initialUrl: '/style-profile' });
    await fireEvent.press(await screen.findByTestId('style-analyze'));
    expect(await screen.findByTestId('style-analysis-summary')).toHaveTextContent(
      'Ton style penche vers le smart casual.',
    );
    expect(screen.getByText(/deuxième paire de derbies/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Actualiser l’analyse' })).toBeTruthy();
  });

  it('explains when there is not enough to analyze', async () => {
    style.profile.mockResolvedValue({ ...EMPTY, canAnalyze: true });
    style.analyze.mockRejectedValue(
      new ApiError('VALIDATION_ERROR', 'not enough', 422, { reason: 'NOT_ENOUGH_SIGNALS' }),
    );
    await renderRouter('./app', { initialUrl: '/style-profile' });
    await fireEvent.press(await screen.findByTestId('style-analyze'));
    expect(await screen.findByText(/Note ou porte encore quelques looks/)).toBeTruthy();
  });

  it('is reachable from the profile', async () => {
    style.profile.mockResolvedValue(EMPTY);
    await renderRouter('./app', { initialUrl: '/profile' });
    await fireEvent.press(await screen.findByTestId('profile-my-style'));
    await waitFor(() => expect(style.profile).toHaveBeenCalled());
    expect(await screen.findByTestId('style-profile-screen')).toBeTruthy();
  });
});
