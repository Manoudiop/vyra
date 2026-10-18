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
  stylistApi: {
    generate: jest.fn(),
    getOutfit: jest.fn(),
    listSaved: jest.fn(),
    setSaved: jest.fn(),
    wear: jest.fn(),
    unwear: jest.fn(),
    rate: jest.fn(),
    clearRating: jest.fn(),
  },
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
  feedback: null,
  wornToday: false,
  weather: null,
  lastWornAt: null,
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

/** A promise the test settles by hand, to observe the screen while a request is in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Outfit actions', () => {
  const open = async (outfit: Outfit = FIRST) => {
    stylist.getOutfit.mockResolvedValue(outfit);
    await renderRouter('./app', { initialUrl: `/outfit/${outfit.id}` });
    expect(await screen.findByText(outfit.name)).toBeTruthy();
  };

  it('saves a look before the API answers, and keeps it saved', async () => {
    const request = deferred<Outfit>();
    stylist.setSaved.mockReturnValue(request.promise);
    await open();
    expect(screen.getByTestId('outfit-save')).not.toBeSelected();
    await fireEvent.press(screen.getByTestId('outfit-save'));
    // Optimistic: selected while the request is still in flight.
    await waitFor(() => expect(screen.getByTestId('outfit-save')).toBeSelected());
    expect(screen.getByLabelText('Retirer des looks enregistrés')).toBeTruthy();
    expect(stylist.setSaved).toHaveBeenCalledWith(FIRST.id, true);

    request.resolve({ ...FIRST, isSaved: true });
    await waitFor(() => expect(stylist.setSaved).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('outfit-save')).toBeSelected();
  });

  it('rolls an optimistic save back when the API refuses', async () => {
    const request = deferred<Outfit>();
    stylist.setSaved.mockReturnValue(request.promise);
    await open();
    await fireEvent.press(screen.getByTestId('outfit-save'));
    await waitFor(() => expect(screen.getByTestId('outfit-save')).toBeSelected());

    request.reject(new ApiError('NETWORK_ERROR', 'offline', 0));
    await waitFor(() => expect(screen.getByTestId('outfit-save')).not.toBeSelected());
    expect(
      await screen.findByText('Impossible de joindre VYRA. Vérifie ta connexion.'),
    ).toBeTruthy();
  });

  it('wears the look today, then undoes it', async () => {
    stylist.wear.mockResolvedValue({
      ...FIRST,
      wornToday: true,
      lastWornAt: '2026-10-18T10:00:00.000Z',
    });
    stylist.unwear.mockResolvedValue(FIRST);
    await open();
    await fireEvent.press(screen.getByTestId('outfit-wear'));
    expect(await screen.findByTestId('outfit-worn')).toHaveTextContent(/Porté aujourd’hui/);
    expect(stylist.wear).toHaveBeenCalledWith(FIRST.id);

    await fireEvent.press(screen.getByTestId('outfit-unwear'));
    expect(await screen.findByTestId('outfit-wear')).toBeTruthy();
    expect(stylist.unwear).toHaveBeenCalledWith(FIRST.id);
  });

  it('shows when a look was last worn', async () => {
    await open({ ...FIRST, lastWornAt: '2026-10-12T10:00:00.000Z' });
    expect(screen.getByTestId('outfit-last-worn')).toHaveTextContent(/12 octobre/);
  });

  it('"love it" can be undone by tapping it again', async () => {
    stylist.rate.mockResolvedValue({ ...FIRST, feedback: { rating: 'LOVE', reason: null } });
    stylist.clearRating.mockResolvedValue(FIRST);
    await open();
    await fireEvent.press(screen.getByTestId('outfit-love'));
    await waitFor(() => expect(screen.getByTestId('outfit-love')).toBeSelected());
    expect(screen.getByTestId('outfit-loved-hint')).toBeTruthy();
    expect(stylist.rate).toHaveBeenCalledWith(FIRST.id, { rating: 'LOVE' });

    await fireEvent.press(screen.getByTestId('outfit-love'));
    await waitFor(() => expect(stylist.clearRating).toHaveBeenCalledWith(FIRST.id));
    await waitFor(() => expect(screen.getByTestId('outfit-love')).not.toBeSelected());
  });

  it('"not for me" offers an optional reason', async () => {
    stylist.rate
      .mockResolvedValueOnce({ ...FIRST, feedback: { rating: 'DISLIKE', reason: null } })
      .mockResolvedValueOnce({ ...FIRST, feedback: { rating: 'DISLIKE', reason: 'COLORS' } });
    await open();
    expect(screen.queryByTestId('reason-COLORS')).toBeNull();
    await fireEvent.press(screen.getByTestId('outfit-dislike'));
    await waitFor(() => expect(screen.getByTestId('outfit-dislike')).toBeSelected());
    expect(screen.getByTestId('outfit-disliked-hint')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('reason-COLORS'));
    await waitFor(() => expect(screen.getByTestId('reason-COLORS')).toBeSelected());
    await waitFor(() =>
      expect(stylist.rate).toHaveBeenLastCalledWith(FIRST.id, {
        rating: 'DISLIKE',
        reason: 'COLORS',
      }),
    );
    expect(stylist.rate).toHaveBeenCalledTimes(2);
  });
});

describe('Saved looks', () => {
  it('lists saved looks and opens one', async () => {
    stylist.listSaved.mockResolvedValue({
      items: [{ ...FIRST, isSaved: true }],
      nextCursor: null,
    });
    stylist.getOutfit.mockResolvedValue({ ...FIRST, isSaved: true });
    await renderRouter('./app', { initialUrl: '/saved-outfits' });
    await fireEvent.press(await screen.findByTestId(`saved-outfit-${FIRST.id}`));
    expect(await screen.findByText('Bureau impeccable')).toBeTruthy();
    expect(screen.getByTestId('outfit-save')).toBeSelected();
  });

  it('guides to the stylist when nothing is saved', async () => {
    stylist.listSaved.mockResolvedValue({ items: [], nextCursor: null });
    await renderRouter('./app', { initialUrl: '/saved-outfits' });
    expect(await screen.findByTestId('saved-empty')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Créer un look' })).toBeTruthy();
  });

  it('is reachable from the profile', async () => {
    stylist.listSaved.mockResolvedValue({ items: [], nextCursor: null });
    await renderRouter('./app', { initialUrl: '/profile' });
    await fireEvent.press(await screen.findByTestId('profile-saved-outfits'));
    expect(await screen.findByTestId('saved-outfits-screen')).toBeTruthy();
  });
});
