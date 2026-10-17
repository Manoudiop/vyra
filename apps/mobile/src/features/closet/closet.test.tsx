import { type ClosetSummary, type ClothingItem, type ClothingItemDetail } from '@vyra/shared';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import { authApi } from '@/features/auth/auth-api';
import { useSession } from '@/features/auth/session-store';
import { tokenStorage } from '@/features/auth/token-storage';
import { ApiError } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { closetApi } from './closet-api';

jest.mock('@/features/auth/auth-api', () => ({
  authApi: { refresh: jest.fn(), me: jest.fn(), logout: jest.fn(async () => undefined) },
}));
jest.mock('./closet-api', () => ({
  ...jest.requireActual('./closet-api'),
  closetApi: {
    list: jest.fn(),
    summary: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.setTimeout(60_000);

const api = closetApi as jest.Mocked<typeof closetApi>;
const auth = authApi as jest.Mocked<typeof authApi>;

const item = (id: string, name: string, overrides: Partial<ClothingItem> = {}): ClothingItem => ({
  id,
  name,
  category: 'TOPS',
  subcategory: null,
  color: 'white',
  colorHex: '#F7F6F2',
  style: 'CASUAL',
  season: 'ALL_SEASON',
  isFavorite: false,
  imageUrl: `https://img.test/${id}.webp`,
  thumbnailUrl: `https://img.test/${id}_thumb.webp`,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

const ITEMS = [
  item('a1', 'Chemise en lin'),
  item('a2', 'Jean brut', { category: 'BOTTOMS', color: 'blue' }),
  item('a3', 'Boubou brodé', { category: 'TRADITIONAL', color: 'cream', isFavorite: true }),
];

const SUMMARY: ClosetSummary = {
  total: 3,
  favorites: 1,
  limit: 30,
  byCategory: {
    TOPS: 1,
    BOTTOMS: 1,
    TRADITIONAL: 1,
    SHOES: 0,
    OUTERWEAR: 0,
    ACCESSORIES: 0,
    OTHER: 0,
  },
};

const detail = (base: ClothingItem): ClothingItemDetail => ({
  ...base,
  stats: { outfitCount: 2, wearCount: 1, lastWornAt: '2026-10-10T08:00:00.000Z' },
});

async function signIn() {
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
}

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
  await signIn();
  api.summary.mockResolvedValue(SUMMARY);
  api.list.mockImplementation(async (filters) => ({
    items: ITEMS.filter(
      (candidate) =>
        (!filters.category || candidate.category === filters.category) &&
        (!filters.favorite || candidate.isFavorite) &&
        (!filters.search || candidate.name.toLowerCase().includes(filters.search.toLowerCase())),
    ),
    nextCursor: null,
  }));
});

describe('closet', () => {
  it('shows the grid with counts and filters by category and favorites', async () => {
    await renderRouter('./app', { initialUrl: '/closet' });

    expect(await screen.findByText('Chemise en lin')).toBeTruthy();
    expect(screen.getByText('Boubou brodé')).toBeTruthy();
    expect(screen.getByText('3 / 30 pièces')).toBeTruthy();
    expect(screen.getByText('Bas · 1')).toBeTruthy();
    // Empty categories are not offered as filters.
    expect(screen.queryByTestId('filter-SHOES')).toBeNull();

    await fireEvent.press(screen.getByTestId('filter-BOTTOMS'));
    await waitFor(() => expect(screen.queryByText('Chemise en lin')).toBeNull());
    expect(screen.getByText('Jean brut')).toBeTruthy();
    expect(api.list).toHaveBeenLastCalledWith(
      { search: '', category: 'BOTTOMS', favorite: false },
      null,
    );

    await fireEvent.press(screen.getByTestId('filter-favorites'));
    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith(
        { search: '', category: 'BOTTOMS', favorite: true },
        null,
      ),
    );
  });

  it('searches as you type (debounced) and offers to reset when nothing matches', async () => {
    await renderRouter('./app', { initialUrl: '/closet' });
    await screen.findByText('Chemise en lin');

    await fireEvent.changeText(screen.getByTestId('closet-search'), 'zzz');
    expect(await screen.findByTestId('closet-no-results', {}, { timeout: 3000 })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(await screen.findByText('Chemise en lin')).toBeTruthy();
  });

  it('shows an inviting empty state for a new closet', async () => {
    api.summary.mockResolvedValue({ ...SUMMARY, total: 0, favorites: 0 });
    api.list.mockResolvedValue({ items: [], nextCursor: null });
    await renderRouter('./app', { initialUrl: '/closet' });
    expect(await screen.findByTestId('closet-empty')).toBeTruthy();
    expect(screen.queryByTestId('closet-search')).toBeNull();
  });

  it('toggles favorites optimistically and rolls back on failure', async () => {
    let reject!: (error: unknown) => void;
    api.update.mockReturnValue(new Promise((_resolve, rej) => (reject = rej)));

    await renderRouter('./app', { initialUrl: '/closet' });
    await screen.findByText('Chemise en lin');
    const heart = () => screen.getByTestId('favorite-a1');

    expect(heart()).not.toBeSelected();
    await fireEvent.press(heart());
    // Updated before the API answers…
    await waitFor(() => expect(heart()).toBeSelected());
    expect(api.update).toHaveBeenCalledWith('a1', { isFavorite: true });

    // …and restored when it fails.
    await act(async () => reject(new ApiError('NETWORK_ERROR', 'offline', null)));
    await waitFor(() => expect(heart()).not.toBeSelected());
  });

  it('opens the detail, then removes the item after confirmation', async () => {
    api.get.mockResolvedValue(detail(ITEMS[0]!));
    api.remove.mockResolvedValue(undefined);
    // Native confirmation: press the destructive button.
    jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => buttons?.[1]?.onPress?.());

    await renderRouter('./app', { initialUrl: '/closet' });
    await fireEvent.press(await screen.findByTestId('closet-item-a1'));

    expect(await screen.findByTestId('item-screen')).toBeTruthy();
    expect(await screen.findByText('Dans 2 looks')).toBeTruthy();
    expect(screen.getByText('Porté 1 fois')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('item-delete'));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('a1'));
    expect(await screen.findByTestId('closet-screen')).toBeTruthy();
  });

  it('edits an item from its detail screen', async () => {
    api.get.mockResolvedValue(detail(ITEMS[1]!));
    api.update.mockResolvedValue({ ...ITEMS[1]!, name: 'Jean droit', color: 'navy' });

    await renderRouter('./app', { initialUrl: '/closet/a2/edit' });
    const name = await screen.findByTestId('item-name');
    expect(name.props.value).toBe('Jean brut');

    await fireEvent.changeText(name, 'Jean droit');
    await fireEvent.press(screen.getByRole('radio', { name: 'Marine' }));
    await fireEvent.press(screen.getByTestId('edit-item-save'));

    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    expect(api.update.mock.calls[0]).toEqual([
      'a2',
      expect.objectContaining({
        name: 'Jean droit',
        category: 'BOTTOMS',
        color: 'navy',
        colorHex: '#1F2A44',
        season: 'ALL_SEASON',
      }),
    ]);
    // Opened from a deep link: saving falls back to the item detail.
    expect(await screen.findByTestId('item-screen')).toBeTruthy();
  });
});
