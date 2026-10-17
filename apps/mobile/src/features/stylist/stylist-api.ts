import {
  type GenerateOutfitRequest,
  type GenerateOutfitResponse,
  type Outfit,
  type OutfitFeedbackInput,
  type OutfitPage,
} from '@vyra/shared';
import { authorizedRequest } from '@/lib/authorized-request';

export const outfitKeys = {
  all: ['outfits'] as const,
  saved: () => [...outfitKeys.all, 'saved'] as const,
  detail: (id: string) => [...outfitKeys.all, id] as const,
};

export const stylistApi = {
  generate: (body: GenerateOutfitRequest) =>
    authorizedRequest<GenerateOutfitResponse>('/ai/generate-outfit', { method: 'POST', body }),
  getOutfit: (id: string) => authorizedRequest<Outfit>(`/outfits/${id}`),
  listSaved: (cursor: string | null) =>
    authorizedRequest<OutfitPage>(`/outfits?saved=true${cursor ? `&cursor=${cursor}` : ''}`),
  setSaved: (id: string, isSaved: boolean) =>
    authorizedRequest<Outfit>(`/outfits/${id}`, { method: 'PATCH', body: { isSaved } }),
  wear: (id: string) => authorizedRequest<Outfit>(`/outfits/${id}/wear`, { method: 'POST' }),
  unwear: (id: string) => authorizedRequest<Outfit>(`/outfits/${id}/wear`, { method: 'DELETE' }),
  rate: (id: string, body: OutfitFeedbackInput) =>
    authorizedRequest<Outfit>(`/outfits/${id}/feedback`, { method: 'PUT', body }),
  clearRating: (id: string) =>
    authorizedRequest<Outfit>(`/outfits/${id}/feedback`, { method: 'DELETE' }),
};
