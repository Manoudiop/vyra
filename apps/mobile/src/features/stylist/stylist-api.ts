import { type GenerateOutfitRequest, type GenerateOutfitResponse, type Outfit } from '@vyra/shared';
import { authorizedRequest } from '@/lib/authorized-request';

export const outfitKeys = {
  all: ['outfits'] as const,
  detail: (id: string) => [...outfitKeys.all, id] as const,
};

export const stylistApi = {
  generate: (body: GenerateOutfitRequest) =>
    authorizedRequest<GenerateOutfitResponse>('/ai/generate-outfit', { method: 'POST', body }),
  getOutfit: (id: string) => authorizedRequest<Outfit>(`/outfits/${id}`),
};
