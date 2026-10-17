import { type HealthResponse, healthResponseSchema } from '@vyra/shared';

const API_URL = (process.env.VYRA_API_URL ?? 'http://localhost:4100/api').replace(/\/+$/, '');

/** Server-side only: the admin talks to the API from Next.js, never from the browser. */
export async function fetchHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: 'no-store' });
    if (!res.ok) return null;
    return healthResponseSchema.parse(await res.json());
  } catch {
    return null;
  }
}
