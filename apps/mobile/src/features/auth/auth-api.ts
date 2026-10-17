import {
  type AuthSession,
  type AuthTokens,
  type AuthUser,
  type ForgotPasswordInput,
  type LoginInput,
  type MessageResponse,
  type RegisterInput,
  type ResetPasswordInput,
} from '@vyra/shared';
import { apiRequest } from '@/lib/api-client';

/** Raw auth endpoints. They never go through the authorized client (no refresh loop). */
export const authApi = {
  register: (body: RegisterInput) =>
    apiRequest<AuthSession>('/auth/register', { method: 'POST', body }),
  login: (body: LoginInput) => apiRequest<AuthSession>('/auth/login', { method: 'POST', body }),
  refresh: (refreshToken: string) =>
    apiRequest<{ tokens: AuthTokens }>('/auth/refresh', { method: 'POST', body: { refreshToken } }),
  logout: (refreshToken: string) =>
    apiRequest<void>('/auth/logout', { method: 'POST', body: { refreshToken } }),
  forgotPassword: (body: ForgotPasswordInput) =>
    apiRequest<MessageResponse>('/auth/forgot-password', { method: 'POST', body }),
  resetPassword: (body: ResetPasswordInput) =>
    apiRequest<void>('/auth/reset-password', { method: 'POST', body }),
  me: (accessToken: string) =>
    apiRequest<AuthUser>('/users/me', { headers: { Authorization: `Bearer ${accessToken}` } }),
};
