import { ApiError, apiRequest } from './api-client';

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('apiRequest', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns the parsed body on success', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { status: 'ok' }));
    await expect(apiRequest('/health')).resolves.toEqual({ status: 'ok' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4100/api/health',
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json' }) }),
    );
  });

  it('surfaces the server error code and details', async () => {
    const details = { metric: 'OUTFIT_GENERATION', limit: 3 };
    mockFetch.mockResolvedValue(
      jsonResponse(402, { error: { code: 'LIMIT_REACHED', message: 'Limit', details } }),
    );
    const error = await apiRequest('/ai/generate-outfit').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'LIMIT_REACHED', status: 402, details });
  });

  it('maps network failures to NETWORK_ERROR', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));
    await expect(apiRequest('/health')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
