import { type Profile } from '@vyra/shared';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { authApi } from '@/features/auth/auth-api';
import { tokenStorage } from '@/features/auth/token-storage';
import { useSession } from '@/features/auth/session-store';
import { profileApi } from '@/features/profile/profile-api';
import { useOnboarding } from './onboarding-store';

jest.mock('@/features/auth/auth-api', () => ({
  authApi: { refresh: jest.fn(), me: jest.fn(), logout: jest.fn(async () => undefined) },
}));
jest.mock('@/features/profile/profile-api', () => ({
  profileQueryKey: ['profile'],
  profileApi: { get: jest.fn(), completeOnboarding: jest.fn(), update: jest.fn() },
}));

jest.setTimeout(60_000);

const auth = authApi as jest.Mocked<typeof authApi>;
const profiles = profileApi as jest.Mocked<typeof profileApi>;

const baseUser = {
  id: 'u1',
  email: 'awa@vyra.dev',
  firstName: 'Awa',
  lastName: null,
  avatarUrl: null,
  role: 'USER' as const,
  createdAt: '2026-10-01T00:00:00.000Z',
};

const profile: Profile = {
  firstName: 'Awa',
  lastName: null,
  genderPreference: 'WOMEN',
  city: 'Dakar',
  countryCode: 'SN',
  timezone: 'Africa/Dakar',
  locale: 'fr',
  notificationsEnabled: true,
  onboardingCompleted: true,
  preferredStyles: ['ELEGANT', 'TRADITIONAL'],
  preferredColors: ['gold', 'terracotta'],
  preferredOccasions: ['WEDDING'],
};

async function signInAs(onboardingCompleted: boolean) {
  await tokenStorage.setRefreshToken('refresh-saved');
  auth.refresh.mockResolvedValue({
    tokens: {
      accessToken: 'access',
      accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      refreshToken: 'refresh-next',
      refreshTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    },
  });
  auth.me.mockResolvedValue({ ...baseUser, onboardingCompleted });
}

const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));

beforeEach(async () => {
  jest.clearAllMocks();
  await tokenStorage.clear();
  useOnboarding.getState().reset();
  useSession.setState({
    status: 'restoring',
    user: null,
    accessToken: null,
    accessTokenExpiresAt: null,
  });
});

describe('onboarding', () => {
  it('is mandatory before the tabs, then submits every answer and opens Home', async () => {
    await signInAs(false);
    profiles.completeOnboarding.mockResolvedValue(profile);

    await renderRouter('./app', { initialUrl: '/' });
    expect(await screen.findByTestId('onboarding-screen')).toBeTruthy();
    expect(screen.queryByTestId('home-screen')).toBeNull();

    // 1. Welcome
    await press('onboarding-primary');
    // 2. First name, pre-filled from the account
    expect(await screen.findByDisplayValue('Awa')).toBeTruthy();
    expect(screen.getByText('Étape 1 sur 6')).toBeTruthy();
    await press('onboarding-primary');
    // 3. Wardrobe — cannot continue without an answer
    await screen.findByTestId('gender-WOMEN');
    expect(screen.getByTestId('onboarding-primary')).toBeDisabled();
    await press('gender-WOMEN');
    await press('onboarding-primary');
    // 4. Styles
    await press(await screen.findByTestId('style-ELEGANT').then(() => 'style-ELEGANT'));
    await press('style-TRADITIONAL');
    await press('onboarding-primary');
    // 5. Colors
    await press(await screen.findByTestId('color-gold').then(() => 'color-gold'));
    await press('color-terracotta');
    await press('onboarding-primary');
    // 6. Occasions
    await press(await screen.findByTestId('occasion-WEDDING').then(() => 'occasion-WEDDING'));
    await press('onboarding-primary');
    // 7. City via a suggestion (sets country and time zone)
    await press(await screen.findByTestId('city-Dakar').then(() => 'city-Dakar'));
    await press('onboarding-primary');
    // 8. Finish
    expect(await screen.findByText('Ton profil style est prêt, Awa.')).toBeTruthy();
    await press('onboarding-primary');

    await waitFor(() => expect(profiles.completeOnboarding).toHaveBeenCalledTimes(1));
    // TanStack Query passes a mutation context as a second argument.
    expect(profiles.completeOnboarding.mock.calls[0]?.[0]).toEqual({
      firstName: 'Awa',
      genderPreference: 'WOMEN',
      preferredStyles: ['ELEGANT', 'TRADITIONAL'],
      preferredColors: ['gold', 'terracotta'],
      preferredOccasions: ['WEDDING'],
      city: 'Dakar',
      countryCode: 'SN',
      timezone: 'Africa/Dakar',
    });
    expect(await screen.findByTestId('home-screen')).toBeTruthy();
    expect(useOnboarding.getState().step).toBe(0);
  });

  it('keeps answers when going back', async () => {
    await signInAs(false);
    await renderRouter('./app', { initialUrl: '/' });
    await screen.findByTestId('onboarding-screen');

    await press('onboarding-primary');
    await press(await screen.findByTestId('onboarding-primary').then(() => 'onboarding-primary'));
    await press(await screen.findByTestId('gender-MEN').then(() => 'gender-MEN'));
    await press('onboarding-primary');
    await screen.findByTestId('style-CASUAL');
    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));

    expect(await screen.findByTestId('gender-MEN')).toBeChecked();
  });

  it('cannot be reopened once completed', async () => {
    await signInAs(true);
    await renderRouter('./app', { initialUrl: '/onboarding' });
    expect(await screen.findByTestId('home-screen')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-screen')).toBeNull();
  });

  it('lets the profile be edited later from the Profile tab', async () => {
    await signInAs(true);
    profiles.get.mockResolvedValue(profile);
    profiles.update.mockResolvedValue({ ...profile, city: 'Abidjan', countryCode: 'CI' });

    await renderRouter('./app', { initialUrl: '/profile' });
    await press(
      await screen
        .findByTestId('profile-style-preferences')
        .then(() => 'profile-style-preferences'),
    );

    const city = await screen.findByTestId('edit-city');
    expect(city.props.value).toBe('Dakar');
    expect(screen.getByTestId('style-ELEGANT')).toBeChecked();

    await fireEvent.changeText(city, 'Abidjan');
    await press('edit-profile-save');

    await waitFor(() => expect(profiles.update).toHaveBeenCalledTimes(1));
    expect(profiles.update.mock.calls[0]?.[0]).toMatchObject({
      city: 'Abidjan',
      countryCode: 'CI',
      timezone: 'Africa/Abidjan',
      preferredStyles: ['ELEGANT', 'TRADITIONAL'],
    });
    expect(await screen.findByText('Profil mis à jour.')).toBeTruthy();
  });
});
