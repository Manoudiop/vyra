import { type WeatherResponse } from '@vyra/shared';
import { authorizedRequest } from '@/lib/authorized-request';

export const weatherKeys = {
  all: ['weather'] as const,
  day: (date: string | null) => [...weatherKeys.all, date ?? 'today'] as const,
};

export const weatherApi = {
  get: (date: string | null) =>
    authorizedRequest<WeatherResponse>(`/weather${date ? `?date=${date}` : ''}`),
};
