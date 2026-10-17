import {
  type AnalyzeClothingResponse,
  type ClosetPage,
  type ClosetSummary,
  type ClothingCategory,
  type ClothingItem,
  type ClothingItemDetail,
  type CreateClothingItemInput,
  type DeleteUploadedImageInput,
  type UpdateClothingItemInput,
  type UploadedImage,
} from '@vyra/shared';
import { authorizedRequest } from '@/lib/authorized-request';

export interface ClosetFilters {
  search: string;
  category: ClothingCategory | null;
  favorite: boolean;
}

export const closetKeys = {
  all: ['closet'] as const,
  lists: () => [...closetKeys.all, 'list'] as const,
  list: (filters: ClosetFilters) => [...closetKeys.lists(), filters] as const,
  summary: () => [...closetKeys.all, 'summary'] as const,
  item: (id: string) => [...closetKeys.all, 'item', id] as const,
};

function toQueryString(filters: ClosetFilters, cursor: string | null): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.category) params.set('category', filters.category);
  if (filters.favorite) params.set('favorite', 'true');
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const closetApi = {
  list: (filters: ClosetFilters, cursor: string | null) =>
    authorizedRequest<ClosetPage>(`/closet${toQueryString(filters, cursor)}`),
  summary: () => authorizedRequest<ClosetSummary>('/closet/summary'),
  get: (id: string) => authorizedRequest<ClothingItemDetail>(`/closet/${id}`),
  update: (id: string, body: UpdateClothingItemInput) =>
    authorizedRequest<ClothingItem>(`/closet/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => authorizedRequest<void>(`/closet/${id}`, { method: 'DELETE' }),
  create: (body: CreateClothingItemInput) =>
    authorizedRequest<ClothingItem>('/closet', { method: 'POST', body }),
  uploadImage: (form: FormData) =>
    authorizedRequest<UploadedImage>('/storage/images', { method: 'POST', body: form }),
  analyze: (imageKey: string) =>
    authorizedRequest<AnalyzeClothingResponse>('/ai/analyze-clothing', {
      method: 'POST',
      body: { imageKey },
    }),
  /** Best-effort cleanup of a photo the user uploaded but did not save. */
  discardImage: (body: DeleteUploadedImageInput) =>
    authorizedRequest<void>('/storage/images', { method: 'DELETE', body }),
};
