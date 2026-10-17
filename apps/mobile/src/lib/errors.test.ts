import i18n from '@/i18n';
import { ApiError } from './api-client';
import { errorMessage } from './errors';

const t = i18n.t.bind(i18n);

describe('errorMessage', () => {
  it('translates API error codes', () => {
    expect(errorMessage(new ApiError('RATE_LIMITED', 'x', 429), t)).toBe(
      'Trop de tentatives. Patiente un peu avant de réessayer.',
    );
    expect(errorMessage(new ApiError('NETWORK_ERROR', 'x', null), t)).toBe(
      'Impossible de joindre VYRA. Vérifie ta connexion.',
    );
    expect(errorMessage(new Error('boom'), t)).toBe(t('errors.generic'));
  });

  it('lets a screen reword a code (wrong credentials are not an expired session)', () => {
    const error = new ApiError('AUTH_REQUIRED', 'x', 401);
    expect(errorMessage(error, t, { AUTH_REQUIRED: 'Email ou mot de passe incorrect.' })).toBe(
      'Email ou mot de passe incorrect.',
    );
    expect(errorMessage(error, t)).toBe('Ta session a expiré. Reconnecte-toi.');
  });
});
