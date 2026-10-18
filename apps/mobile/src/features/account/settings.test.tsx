import { type Profile } from '@vyra/shared';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { authApi } from '@/features/auth/auth-api';
import { useSession } from '@/features/auth/session-store';
import { tokenStorage } from '@/features/auth/token-storage';
import { profileApi } from '@/features/profile/profile-api';
import i18n from '@/i18n';
import { ApiError } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { accountApi } from './account-api';

jest.mock('@/features/auth/auth-api', () => ({
  authApi: { refresh: jest.fn(), me: jest.fn(), logout: jest.fn(async () => undefined) },
}));
jest.mock('./account-api', () => ({ accountApi: { delete: jest.fn() } }));
jest.mock('@/features/profile/profile-api', () => ({
  ...jest.requireActual('@/features/profile/profile-api'),
  profileApi: { get: jest.fn(), update: jest.fn(), completeOnboarding: jest.fn() },
}));

jest.setTimeout(60_000);

const auth = authApi as jest.Mocked<typeof authApi>;
const account = accountApi as jest.Mocked<typeof accountApi>;
const profile = profileApi as jest.Mocked<typeof profileApi>;

const PROFILE: Profile = {
  firstName: 'Amina',
  lastName: null,
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
  await i18n.changeLanguage('fr');
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
});

afterAll(() => i18n.changeLanguage('fr'));

describe('Settings', () => {
  it('is reached from the profile', async () => {
    await renderRouter('./app', { initialUrl: '/profile' });
    await fireEvent.press(await screen.findByTestId('profile-settings'));
    expect(await screen.findByTestId('settings-screen')).toBeTruthy();
    // The notifications row is gone: there are no notifications in the MVP.
    expect(screen.queryByText('Notifications')).toBeNull();
  });

  it('switches the language at once and saves it on the account', async () => {
    profile.update.mockImplementation(async (body) => ({ ...PROFILE, ...body }) as Profile);
    await renderRouter('./app', { initialUrl: '/settings' });
    expect(await screen.findByText('Réglages')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('language-en'));
    expect(await screen.findByText('Settings')).toBeTruthy();
    await waitFor(() => expect(profile.update).toHaveBeenCalledWith({ locale: 'en' }));
    expect(screen.getByTestId('language-en')).toBeSelected();
  });

  it('goes back to the previous language if saving fails', async () => {
    profile.update.mockRejectedValue(new ApiError('NETWORK_ERROR', 'offline', 0));
    await renderRouter('./app', { initialUrl: '/settings' });
    await fireEvent.press(await screen.findByTestId('language-en'));
    await waitFor(() => expect(screen.getByTestId('language-fr')).toBeSelected());
    expect(
      await screen.findByText('Impossible de joindre VYRA. Vérifie ta connexion.'),
    ).toBeTruthy();
  });

  it('applies the account’s language when the app opens', async () => {
    profile.get.mockResolvedValue({ ...PROFILE, locale: 'en' });
    await renderRouter('./app', { initialUrl: '/settings' });
    expect(await screen.findByText('Settings', {}, { timeout: 5000 })).toBeTruthy();
  });
});

describe('Account deletion', () => {
  it('explains what goes and asks for the password', async () => {
    account.delete.mockRejectedValue(
      new ApiError('FORBIDDEN', 'Wrong password.', 403, { reason: 'WRONG_PASSWORD' }),
    );
    await renderRouter('./app', { initialUrl: '/settings' });
    await fireEvent.press(await screen.findByTestId('settings-delete-open'));
    expect(screen.getByTestId('settings-delete-explain')).toHaveTextContent(/irréversible/);
    expect(screen.getByTestId('settings-delete-confirm')).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('settings-delete-password'), 'nope');
    await fireEvent.press(screen.getByTestId('settings-delete-confirm'));
    expect(await screen.findByText('Mot de passe incorrect.')).toBeTruthy();
    expect(await tokenStorage.getRefreshToken()).not.toBeNull();

    await fireEvent.press(screen.getByTestId('settings-delete-cancel'));
    expect(screen.queryByTestId('settings-delete-explain')).toBeNull();
  });

  it('deletes the account and leaves the device signed out', async () => {
    account.delete.mockResolvedValue(undefined);
    await renderRouter('./app', { initialUrl: '/settings' });
    await fireEvent.press(await screen.findByTestId('settings-delete-open'));
    await fireEvent.changeText(screen.getByTestId('settings-delete-password'), 'letters123');
    await fireEvent.press(screen.getByTestId('settings-delete-confirm'));

    await waitFor(() => expect(account.delete).toHaveBeenCalledWith({ password: 'letters123' }));
    expect(await screen.findByTestId('welcome-screen', {}, { timeout: 5000 })).toBeTruthy();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
    expect(useSession.getState().user).toBeNull();
  });
});
