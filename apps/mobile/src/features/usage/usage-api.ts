import { type UsageResponse } from '@vyra/shared';
import { authorizedRequest } from '@/lib/authorized-request';

export const usageKeys = { all: ['usage'] as const };

export const usageApi = {
  get: () => authorizedRequest<UsageResponse>('/usage'),
};
