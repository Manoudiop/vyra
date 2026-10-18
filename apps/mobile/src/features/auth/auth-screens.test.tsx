import { type AuthSession } from '@vyra/shared';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { ApiError } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { authApi } from './auth-api';
import { useSession } from './session-store';
import { tokenStorage } from './token-storage';

jest.mock('./auth-api', () => ({
  authApi: {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(async () => undefined),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    me: jest.fn(),
  },
}));

jest.setTimeout(60_000);

const auth = authApi as jest.Mocked<typeof authApi>;

const session = (onboardingCompleted: boolean): AuthSession => ({
  user: {
    id: 'u1',
    email: 'amina@vyra.dev',
    firstName: 'Amina',
    lastName: null,
    avatarUrl: null,
    role: 'USER',
    onboardingCompleted,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  tokens: {
    accessToken: 'access',
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    refreshToken: 'refresh-new',
    refreshTokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  },
});

/** First argument of a mocked call (TanStack also passes its own context). */
const firstArg = (mock: { mock: { calls: unknown[][] } }) => mock.mock.calls[0]?.[0];

beforeEach(async () => {
  jest.clearAllMocks();
  queryClient.clear();
  await tokenStorage.clear();
  // Signed out: no stored refresh token.
  useSession.setState({
    status: 'restoring',
    user: null,
    accessToken: null,
    accessTokenExpiresAt: null,
  });
});

describe('Login', () => {
  it('checks the form before calling the API', async () => {
    await renderRouter('./app', { initialUrl: '/login' });
    await fireEvent.changeText(await screen.findByTestId('login-email'), 'not-an-email');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Adresse email invalide')).toBeTruthy();
    expect(screen.getByText('Champ requis')).toBeTruthy();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('explains wrong credentials without saying which one', async () => {
    auth.login.mockRejectedValue(new ApiError('AUTH_REQUIRED', 'Invalid credentials', 401));
    await renderRouter('./app', { initialUrl: '/login' });
    await fireEvent.changeText(await screen.findByTestId('login-email'), 'amina@vyra.dev');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'wrong-pass1');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Email ou mot de passe incorrect.')).toBeTruthy();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
  });

  it('signs in, keeps the session and opens the app', async () => {
    auth.login.mockResolvedValue(session(true));
    await renderRouter('./app', { initialUrl: '/login' });
    await fireEvent.changeText(await screen.findByTestId('login-email'), '  Amina@vyra.dev ');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'letters123');
    await fireEvent.press(screen.getByTestId('login-submit'));

    expect(await screen.findByTestId('home-screen', {}, { timeout: 5000 })).toBeTruthy();
    expect(firstArg(auth.login)).toEqual({ email: 'Amina@vyra.dev', password: 'letters123' });
    expect(await tokenStorage.getRefreshToken()).toBe('refresh-new');
  });
});

describe('Register', () => {
  it('requires a strong enough password', async () => {
    await renderRouter('./app', { initialUrl: '/register' });
    await fireEvent.changeText(await screen.findByTestId('register-first-name'), 'Amina');
    await fireEvent.changeText(screen.getByTestId('register-email'), 'amina@vyra.dev');
    await fireEvent.changeText(screen.getByTestId('register-password'), 'short');
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(await screen.findByText('Au moins 8 caractères')).toBeTruthy();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('says clearly when the email already has an account', async () => {
    auth.register.mockRejectedValue(new ApiError('CONFLICT', 'exists', 409));
    await renderRouter('./app', { initialUrl: '/register' });
    await fireEvent.changeText(await screen.findByTestId('register-first-name'), 'Amina');
    await fireEvent.changeText(screen.getByTestId('register-email'), 'amina@vyra.dev');
    await fireEvent.changeText(screen.getByTestId('register-password'), 'letters123');
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(await screen.findByText(/Un compte existe déjà avec cet email/)).toBeTruthy();
  });

  it('creates the account and starts the onboarding', async () => {
    auth.register.mockResolvedValue(session(false));
    await renderRouter('./app', { initialUrl: '/register' });
    await fireEvent.changeText(await screen.findByTestId('register-first-name'), 'Amina');
    await fireEvent.changeText(screen.getByTestId('register-email'), 'amina@vyra.dev');
    await fireEvent.changeText(screen.getByTestId('register-password'), 'letters123');
    await fireEvent.press(screen.getByTestId('register-submit'));
    expect(await screen.findByTestId('onboarding-screen', {}, { timeout: 5000 })).toBeTruthy();
    expect(firstArg(auth.register)).toEqual({
      firstName: 'Amina',
      email: 'amina@vyra.dev',
      password: 'letters123',
    });
  });
});

describe('Password reset', () => {
  it('sends a code, resets with it and returns to sign-in', async () => {
    auth.forgotPassword.mockResolvedValue({ message: 'ok' });
    auth.resetPassword.mockResolvedValue(undefined);
    await renderRouter('./app', { initialUrl: '/forgot-password' });
    await fireEvent.changeText(await screen.findByTestId('forgot-email'), 'amina@vyra.dev');
    await fireEvent.press(screen.getByTestId('forgot-submit'));

    expect(await screen.findByTestId('reset-screen')).toBeTruthy();
    expect(screen.getByText(/amina@vyra\.dev/)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('reset-code'), '12345');
    await fireEvent.changeText(screen.getByTestId('reset-password'), 'newpass123');
    await fireEvent.press(screen.getByTestId('reset-submit'));
    expect(await screen.findByText('Le code contient 6 chiffres')).toBeTruthy();
    expect(auth.resetPassword).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('reset-code'), '123456');
    await fireEvent.press(screen.getByTestId('reset-submit'));
    await waitFor(() =>
      expect(firstArg(auth.resetPassword)).toEqual({
        email: 'amina@vyra.dev',
        code: '123456',
        newPassword: 'newpass123',
      }),
    );
    expect(await screen.findByTestId('login-screen', {}, { timeout: 5000 })).toBeTruthy();
    expect(
      screen.getByText('Mot de passe modifié. Connecte-toi avec ton nouveau mot de passe.'),
    ).toBeTruthy();
  });

  it('explains an invalid or expired code', async () => {
    auth.resetPassword.mockRejectedValue(new ApiError('VALIDATION_ERROR', 'invalid', 400));
    await renderRouter('./app', { initialUrl: '/reset-password?email=amina%40vyra.dev' });
    await fireEvent.changeText(await screen.findByTestId('reset-code'), '654321');
    await fireEvent.changeText(screen.getByTestId('reset-password'), 'newpass123');
    await fireEvent.press(screen.getByTestId('reset-submit'));
    expect(await screen.findByText(/Ce code est invalide ou a expiré/)).toBeTruthy();
  });
});
