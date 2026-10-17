import { type CompleteOnboardingInput, type Profile, type UpdateProfileInput } from '@vyra/shared';
import { authorizedRequest } from '@/lib/authorized-request';

export const profileQueryKey = ['profile'] as const;

export const profileApi = {
  get: () => authorizedRequest<Profile>('/profile'),
  completeOnboarding: (body: CompleteOnboardingInput) =>
    authorizedRequest<Profile>('/profile/onboarding', { method: 'PUT', body }),
  update: (body: UpdateProfileInput) =>
    authorizedRequest<Profile>('/profile', { method: 'PATCH', body }),
};
