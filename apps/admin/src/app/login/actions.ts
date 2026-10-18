'use server';

import { authSessionSchema, loginSchema } from '@vyra/shared';
import { redirect } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { clearSession, readRefreshToken, storeSession } from '@/lib/session';

export interface LoginState {
  error: string | null;
}

/** Signs in through the API; only ADMIN accounts get an admin session. */
export async function login(_previous: LoginState, form: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: form.get('email'),
    password: form.get('password'),
  });
  if (!parsed.success) return { error: 'Email ou mot de passe invalide.' };

  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed.data),
    cache: 'no-store',
  }).catch(() => null);
  if (!res) return { error: 'API injoignable.' };
  if (res.status === 401) return { error: 'Email ou mot de passe incorrect.' };
  if (res.status === 429) return { error: 'Trop de tentatives. Réessaie dans une minute.' };
  if (!res.ok) return { error: `Connexion impossible (erreur ${res.status}).` };

  const session = authSessionSchema.parse(await res.json());
  if (session.user.role !== 'ADMIN') {
    // Do not leave a live session behind for a non-admin account.
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.tokens.refreshToken }),
    }).catch(() => undefined);
    return { error: 'Accès réservé aux administrateurs.' };
  }
  await storeSession(session.tokens);
  redirect('/');
}

export async function logout(): Promise<void> {
  const refreshToken = await readRefreshToken();
  if (refreshToken) {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  await clearSession();
  redirect('/login');
}
