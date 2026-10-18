import { type StyleAnalysisResult, type StyleProfile } from '@vyra/shared';
import { authorizedRequest } from '@/lib/authorized-request';

export const styleKeys = {
  profile: ['style-profile'] as const,
};

export const styleApi = {
  profile: () => authorizedRequest<StyleProfile>('/style-profile'),
  analyze: () => authorizedRequest<StyleAnalysisResult>('/ai/analyze-style', { method: 'POST' }),
};
