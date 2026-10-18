import 'server-only';
import { type HealthResponse, healthResponseSchema } from '@vyra/shared';
import { redirect } from 'next/navigation';
import { type z } from 'zod';
import { readAccessToken } from './session';

/** Server-side only: the admin talks to the API from Next.js, never from the browser. */
export const API_URL = (process.env.VYRA_API_URL ?? 'http://localhost:4100/api').replace(
  /\/+$/,
  '',
);

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * GET an admin endpoint with the session's token and validate the answer.
 * No session (or an expired one the proxy could not refresh) → login page.
 */
export async function adminGet<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
  const token = await readAccessToken();
  if (!token) redirect('/login');
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login?expired=1');
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new AdminApiError(
      res.status,
      body?.error?.code ?? 'INTERNAL_ERROR',
      body?.error?.message ?? `API error ${res.status}`,
    );
  }
  return schema.parse(await res.json());
}

export async function fetchHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: 'no-store' });
    if (!res.ok) return null;
    return healthResponseSchema.parse(await res.json());
  } catch {
    return null;
  }
}
