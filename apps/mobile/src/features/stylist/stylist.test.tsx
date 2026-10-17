import { type ClothingItem, type Outfit } from '@vyra/shared';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { authApi } from '@/features/auth/auth-api';
import { useSession } from '@/features/auth/session-store';
import { tokenStorage } from '@/features/auth/token-storage';
import { closetApi } from '@/features/closet/closet-api';
import { ApiError } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { stylistApi } from './stylist-api';

jest.mock('@/features/auth/auth-api', () => ({
  authApi: { refresh: jest.fn(), me: jest.fn(), logout: jest.fn(async () => undefined) },
}));
jest.mock('@/features/closet/closet-api', () => ({
  ...jest.requireActual('@/features/closet/closet-api'),
  closetApi: { list: jest.fn(), summary: jest.fn(), get: jest.fn() },
}));
jest.mock('./stylist-api', () => ({
  ...jest.requireActual('./stylist-api'),
  stylistApi: { generate: jest.fn(), getOutfit: jest.fn() },
}));

jest.setTimeout(60_000);

const auth = authApi as jest.Mocked<typeof authApi>;
const closet = closetApi as jest.Mocked<typeof closetApi>;
const stylist = stylistApi as jest.Mocked<typeof stylistApi>;

const piece = (id: string, name: string, category: ClothingItem['category']): ClothingItem => ({
  id,
  name,
  category,
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

const BLAZER = piece('11111111-1111-4111-8111-111111111111', 'Blazer marine', 'OUTERWEAR');
const SHIRT = piece('22222222-2222-4222-8222-222222222222', 'Chemise oxford', 'TOPS');
const CHINOS = piece('33333333-3333-4333-8333-333333333333', 'Chino beige', 'BOTTOMS');
const DERBIES = piece('44444444-4444-4444-8444-444444444444', 'Derbies', 'SHOES');

const outfit = (id: string, name: string, items: ClothingItem[]): Outfit => ({
  id,
  name,
  occasion: 'WORK',
  style: 'SMART_CASUAL',
  reason: 'Pour le bureau, « Chemise oxford » et « Chino beige » posent une base smart casual.',
  score: 0.82,
  isSaved: false,
  constraints: { avoidColors: [], avoidKinds: ['jeans'], requiredItemId: BLAZER.id },
  items,
  createdAt: '2026-10-18T09:00:00.000Z',
});

const FIRST = outfit('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Bureau impeccable', [
  BLAZER,
  SHIRT,
  CHINOS,
  DERBIES,
]);
const SECOND = outfit('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Réunion en bleu', [
  BLAZER,
  CHINOS,
  DERBIES,
]);

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
    email: 'karim@vyra.dev',
    firstName: 'Karim',
    lastName: null,
    avatarUrl: null,
    role: 'USER',
    onboardingCompleted: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  });
  closet.list.mockResolvedValue({ items: [BLAZER, SHIRT, CHINOS, DERBIES], nextCursor: null });
});

describe('AI stylist', () => {
  it('builds the request from occasion, suggested style and constraints, then shows the look', async () => {
    stylist.generate.mockResolvedValue({ outfit: FIRST, provider: 'mock', candidateCount: 4 });

    await renderRouter('./app', { initialUrl: '/stylist' });
    expect(await screen.findByTestId('stylist-generate')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('occasion-WORK'));
    // The natural style for work is pre-selected.
    expect(screen.getByTestId('style-SMART_CASUAL')).toBeSelected();
    await fireEvent.press(screen.getByTestId('constraint-jeans'));
    await fireEvent.press(await screen.findByTestId(`use-item-${BLAZER.id}`));
    await fireEvent.press(screen.getByTestId('stylist-generate'));

    expect(await screen.findByTestId('generating-overlay')).toBeTruthy();
    expect(stylist.generate).toHaveBeenCalledWith({
      occasion: 'WORK',
      style: 'SMART_CASUAL',
      constraints: { avoidColors: [], avoidKinds: ['jeans'], requiredItemId: BLAZER.id },
    });

    expect(await screen.findByTestId('outfit-screen', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText('Bureau impeccable')).toBeTruthy();
    expect(screen.getByTestId('outfit-reason')).toHaveTextContent(/Chemise oxford/);
    expect(screen.getByTestId(`outfit-piece-${DERBIES.id}`)).toBeTruthy();
  });

  it('keeps a style the user chose even when the occasion changes', async () => {
    await renderRouter('./app', { initialUrl: '/stylist' });
    await fireEvent.press(await screen.findByTestId('style-STREETWEAR'));
    await fireEvent.press(screen.getByTestId('occasion-WEDDING'));
    expect(screen.getByTestId('style-STREETWEAR')).toBeSelected();
    expect(screen.getByTestId('style-TRADITIONAL')).not.toBeSelected();
  });

  it('turns an incomplete closet into a clear next step', async () => {
    stylist.generate.mockRejectedValue(
      new ApiError('VALIDATION_ERROR', 'incomplete', 422, {
        reason: 'INCOMPLETE_CLOSET',
        missing: ['SHOES'],
      }),
    );
    await renderRouter('./app', { initialUrl: '/stylist' });
    await fireEvent.press(await screen.findByTestId('occasion-CASUAL'));
    await fireEvent.press(screen.getByTestId('stylist-generate'));

    expect(await screen.findByTestId('stylist-incomplete', {}, { timeout: 5000 })).toBeTruthy();
    expect(
      screen.getByText('Il manque des chaussures pour composer un look complet.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ajouter une pièce' })).toBeTruthy();
  });

  it('explains impossible constraints', async () => {
    stylist.generate.mockRejectedValue(
      new ApiError('VALIDATION_ERROR', 'no match', 422, { reason: 'NO_MATCH' }),
    );
    await renderRouter('./app', { initialUrl: '/stylist' });
    await fireEvent.press(await screen.findByTestId('occasion-PARTY'));
    await fireEvent.press(screen.getByTestId('stylist-generate'));
    expect(
      await screen.findByText(
        'Aucun look ne respecte toutes ces contraintes. Retires-en une et réessaie.',
        {},
        { timeout: 5000 },
      ),
    ).toBeTruthy();
  });

  it('"another look" regenerates with the same request and excludes looks already seen', async () => {
    stylist.getOutfit.mockResolvedValue(FIRST);
    stylist.generate.mockResolvedValue({ outfit: SECOND, provider: 'mock', candidateCount: 3 });

    await renderRouter('./app', { initialUrl: `/outfit/${FIRST.id}` });
    expect(await screen.findByText('Bureau impeccable')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('outfit-another'));

    await waitFor(() => expect(stylist.generate).toHaveBeenCalledTimes(1));
    expect(stylist.generate).toHaveBeenCalledWith({
      occasion: 'WORK',
      style: 'SMART_CASUAL',
      constraints: FIRST.constraints,
      excludeOutfitIds: [FIRST.id],
    });
    expect(await screen.findByText('Réunion en bleu', {}, { timeout: 5000 })).toBeTruthy();
  });
});
