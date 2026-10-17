import { useSession } from '@/features/auth/session-store';
import { ApiError, apiRequest } from './api-client';
import { authorizedRequest } from './authorized-request';

jest.mock('./api-client', () => ({
  ...jest.requireActual('./api-client'),
  apiRequest: jest.fn(),
}));

const request = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe('authorizedRequest', () => {
  const getValidAccessToken = jest.fn();
  const refresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useSession.setState({ getValidAccessToken, refresh });
  });

  it('sends the bearer token', async () => {
    getValidAccessToken.mockResolvedValue('token-1');
    request.mockResolvedValue({ ok: true });

    await expect(authorizedRequest('/closet')).resolves.toEqual({ ok: true });
    expect(request).toHaveBeenCalledWith('/closet', {
      headers: { Authorization: 'Bearer token-1' },
    });
  });

  it('refreshes and retries once when the API rejects the token', async () => {
    getValidAccessToken.mockResolvedValue('revoked');
    refresh.mockResolvedValue('token-2');
    request
      .mockRejectedValueOnce(new ApiError('AUTH_REQUIRED', 'expired', 401))
      .mockResolvedValueOnce({ ok: true });

    await expect(authorizedRequest('/closet')).resolves.toEqual({ ok: true });
    expect(request).toHaveBeenLastCalledWith('/closet', {
      headers: { Authorization: 'Bearer token-2' },
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not retry other errors', async () => {
    getValidAccessToken.mockResolvedValue('token-1');
    request.mockRejectedValue(new ApiError('LIMIT_REACHED', 'limit', 402));

    await expect(authorizedRequest('/ai/generate-outfit')).rejects.toMatchObject({
      code: 'LIMIT_REACHED',
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('fails fast when signed out', async () => {
    getValidAccessToken.mockResolvedValue(null);
    await expect(authorizedRequest('/closet')).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(request).not.toHaveBeenCalled();
  });
});
