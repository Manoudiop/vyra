import { type ErrorCode, isApiErrorBody } from '@vyra/shared';
import { API_URL } from './env';

/** Error raised for any failed API call, carrying the server's stable error code. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly status: number | null,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...init } = options;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Unable to reach VYRA. Check your connection.', null);
  }

  const payload: unknown =
    response.status === 204 ? undefined : await response.json().catch(() => undefined);

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      const { code, message, details } = payload.error;
      throw new ApiError(code, message, response.status, details);
    }
    throw new ApiError('INTERNAL_ERROR', 'Unexpected server response', response.status);
  }

  return payload as T;
}
