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

export interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...init } = options;
  let response: Response;
  try {
    // Multipart bodies are sent as-is: fetch sets the boundary in Content-Type itself.
    const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !multipart ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: multipart ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
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
