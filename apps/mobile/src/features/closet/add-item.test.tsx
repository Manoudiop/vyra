import {
  type AnalyzeClothingResponse,
  type ClosetSummary,
  type ClothingItemDetail,
  type UploadedImage,
} from '@vyra/shared';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { authApi } from '@/features/auth/auth-api';
import { useSession } from '@/features/auth/session-store';
import { tokenStorage } from '@/features/auth/token-storage';
import { ApiError } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { closetApi } from './closet-api';
import { pickPhoto, preparePhoto, toUploadForm } from './photo';

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
    create: jest.fn(),
    uploadImage: jest.fn(),
    analyze: jest.fn(),
    discardImage: jest.fn(async () => undefined),
  },
}));
jest.mock('./photo', () => ({
  pickPhoto: jest.fn(),
  preparePhoto: jest.fn(),
  toUploadForm: jest.fn(),
}));

jest.setTimeout(60_000);

const api = closetApi as jest.Mocked<typeof closetApi>;
const auth = authApi as jest.Mocked<typeof authApi>;

const PHOTO = { uri: 'file:///photo.jpg', width: 3000, height: 4000 };
const UPLOADED: UploadedImage = {
  imageKey: 'users/u1/clothing/k.webp',
  thumbnailKey: 'users/u1/clothing/k_thumb.webp',
  imageUrl: 'https://img.test/k.webp',
  thumbnailUrl: 'https://img.test/k_thumb.webp',
  width: 1200,
  height: 1500,
  dominantColorHex: '#B5573B',
};
const AI: AnalyzeClothingResponse = {
  provider: 'mock',
  analysis: {
    name: 'Caftan terracotta',
    category: 'TRADITIONAL',
    subcategory: 'caftan',
    color: 'terracotta',
    colorHex: '#B5573B',
    style: 'TRADITIONAL',
    season: 'ALL_SEASON',
    confidence: { category: 0.7, color: 0.9, style: 0.8, season: 0.45 },
  },
};

const DETAIL: ClothingItemDetail = {
  id: 'new-1',
  name: 'Caftan terracotta',
  category: 'TRADITIONAL',
  subcategory: 'caftan',
  color: 'terracotta',
  colorHex: '#B5573B',
  style: 'TRADITIONAL',
  season: 'ALL_SEASON',
  isFavorite: false,
  imageUrl: 'https://img.test/k.webp',
  thumbnailUrl: 'https://img.test/k_thumb.webp',
  createdAt: '2026-10-17T00:00:00.000Z',
  updatedAt: '2026-10-17T00:00:00.000Z',
  stats: { outfitCount: 0, wearCount: 0, lastWornAt: null },
};

const SUMMARY: ClosetSummary = {
  total: 3,
  favorites: 0,
  limit: 30,
  byCategory: {
    TOPS: 3,
    BOTTOMS: 0,
    SHOES: 0,
    OUTERWEAR: 0,
    ACCESSORIES: 0,
    TRADITIONAL: 0,
    OTHER: 0,
  },
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
  api.summary.mockResolvedValue(SUMMARY);
  api.list.mockResolvedValue({ items: [], nextCursor: null });
  (pickPhoto as jest.Mock).mockResolvedValue({ status: 'picked', photo: PHOTO });
  (preparePhoto as jest.Mock).mockResolvedValue({ ...PHOTO, width: 1200, height: 1600 });
  (toUploadForm as jest.Mock).mockResolvedValue(new FormData());
  api.analyze.mockResolvedValue(AI);
});

describe('add a closet item', () => {
  it('photo → upload → AI analysis pre-fills every field → saved with the analysis', async () => {
    api.uploadImage.mockResolvedValue(UPLOADED);
    api.create.mockResolvedValue({ ...DETAIL } as never);
    api.get.mockResolvedValue(DETAIL);

    await renderRouter('./app', { initialUrl: '/closet/add' });
    await fireEvent.press(await screen.findByTestId('add-library'));

    expect(pickPhoto).toHaveBeenCalledWith('library');
    expect(await screen.findByTestId('add-details')).toBeTruthy();
    expect(preparePhoto).toHaveBeenCalledWith(PHOTO);
    expect(api.analyze).toHaveBeenCalledWith(UPLOADED.imageKey);

    // Every field comes from the analysis; low-confidence ones are flagged.
    expect(screen.getByTestId('item-name').props.value).toBe('Caftan terracotta');
    expect(screen.getByTestId('item-subcategory').props.value).toBe('caftan');
    expect(screen.getByRole('radio', { name: 'Terracotta' })).toBeChecked();
    expect(screen.getByTestId('add-ai-note')).toBeTruthy();
    expect(screen.getByText('À vérifier : saison')).toBeTruthy();
    expect(screen.getByTestId('add-save')).not.toBeDisabled();

    await fireEvent.press(screen.getByTestId('add-save'));

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create.mock.calls[0]?.[0]).toMatchObject({
      name: 'Caftan terracotta',
      category: 'TRADITIONAL',
      subcategory: 'caftan',
      color: 'terracotta',
      colorHex: '#B5573B',
      style: 'TRADITIONAL',
      imageKey: UPLOADED.imageKey,
      thumbnailKey: UPLOADED.thumbnailKey,
      metadata: { source: 'upload', provider: 'mock', corrected: [], analysis: AI.analysis },
    });
    expect(await screen.findByTestId('item-screen')).toBeTruthy();
    // Saved photos are owned by the item: nothing to clean up.
    expect(api.discardImage).not.toHaveBeenCalled();
  });

  it('records which suggestions the user corrected', async () => {
    api.uploadImage.mockResolvedValue(UPLOADED);
    api.create.mockResolvedValue({ ...DETAIL } as never);
    api.get.mockResolvedValue(DETAIL);

    await renderRouter('./app', { initialUrl: '/closet/add' });
    await fireEvent.press(await screen.findByTestId('add-library'));
    await screen.findByTestId('add-details');

    await fireEvent.press(screen.getByTestId('item-category-OTHER'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Orange' }));
    await fireEvent.press(screen.getByTestId('add-save'));

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create.mock.calls[0]?.[0]).toMatchObject({
      category: 'OTHER',
      color: 'orange',
      colorHex: '#D9782D',
      metadata: { corrected: ['category', 'color'] },
    });
  });

  it('falls back to manual entry when the analysis is unavailable', async () => {
    api.uploadImage.mockResolvedValue(UPLOADED);
    api.analyze.mockRejectedValue(new ApiError('AI_ERROR', 'down', 502));

    await renderRouter('./app', { initialUrl: '/closet/add' });
    await fireEvent.press(await screen.findByTestId('add-library'));

    expect(await screen.findByTestId('add-ai-unavailable')).toBeTruthy();
    // The photo's dominant color (#B5573B) still pre-selects the color.
    expect(screen.getByRole('radio', { name: 'Terracotta' })).toBeChecked();
    expect(screen.getByTestId('item-name').props.value).toBe('');
    expect(screen.getByTestId('add-save')).toBeDisabled();
  });

  it('says when the plan’s analyses are used up, and when they come back', async () => {
    api.uploadImage.mockResolvedValue(UPLOADED);
    api.analyze.mockRejectedValue(
      new ApiError('LIMIT_REACHED', 'used up', 402, {
        metric: 'CLOTHING_ANALYSIS',
        limit: 30,
        used: 30,
        period: 'MONTH',
        resetsAt: '2026-11-01T00:00:00.000Z',
        currentPlan: 'FREE',
        suggestedPlan: 'PRO',
      }),
    );
    await renderRouter('./app', { initialUrl: '/closet/add' });
    await fireEvent.press(await screen.findByTestId('add-library'));
    expect(await screen.findByTestId('add-ai-limit')).toHaveTextContent(
      /Tes 30 analyses IA du mois sont utilisées \(renouvellement dimanche 1 novembre\)/,
    );
    expect(screen.queryByTestId('add-ai-unavailable')).toBeNull();
  });

  it('cleans up the uploaded photo when the user leaves without saving', async () => {
    api.uploadImage.mockResolvedValue(UPLOADED);
    await renderRouter('./app', { initialUrl: '/closet/add' });
    await fireEvent.press(await screen.findByTestId('add-camera'));
    await screen.findByTestId('add-details');

    await fireEvent.press(screen.getByTestId('add-close'));
    await waitFor(() =>
      expect(api.discardImage).toHaveBeenCalledWith({
        imageKey: UPLOADED.imageKey,
        thumbnailKey: UPLOADED.thumbnailKey,
      }),
    );
  });

  it('explains a refused permission and offers the settings', async () => {
    (pickPhoto as jest.Mock).mockResolvedValue({ status: 'denied', canAskAgain: false });
    await renderRouter('./app', { initialUrl: '/closet/add' });
    await fireEvent.press(await screen.findByTestId('add-camera'));

    expect(
      await screen.findByText(
        'VYRA a besoin de l’appareil photo pour photographier tes vêtements.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ouvrir les réglages' })).toBeTruthy();
    expect(api.uploadImage).not.toHaveBeenCalled();
  });

  it('shows the upload error and lets the user try again', async () => {
    api.uploadImage.mockRejectedValue(
      new ApiError('VALIDATION_ERROR', 'Unsupported image', 415, { reason: 'UNSUPPORTED_FORMAT' }),
    );
    await renderRouter('./app', { initialUrl: '/closet/add' });
    await fireEvent.press(await screen.findByTestId('add-library'));

    expect(await screen.findByText('Certaines informations ne sont pas valides.')).toBeTruthy();
    expect(screen.getByTestId('add-library')).not.toBeDisabled();
  });

  it('blocks adding when the free closet is full', async () => {
    api.summary.mockResolvedValue({ ...SUMMARY, total: 30 });
    await renderRouter('./app', { initialUrl: '/closet/add' });

    expect(
      await screen.findByText(
        'Ton dressing gratuit est plein (30 pièces). Passe à VYRA PRO pour un dressing illimité.',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('add-camera')).toBeDisabled();
    expect(screen.getByTestId('add-library')).toBeDisabled();
  });
});
