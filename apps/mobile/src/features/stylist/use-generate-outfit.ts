import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type GenerateOutfitRequest } from '@vyra/shared';
import { haptics } from '@/ui';
import { outfitKeys, stylistApi } from './stylist-api';

/** The generation moment should be felt, not flashed: show the overlay at least this long. */
export const MIN_GENERATION_MS = 2200;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useGenerateOutfit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: GenerateOutfitRequest) => {
      const [response] = await Promise.all([stylistApi.generate(request), wait(MIN_GENERATION_MS)]);
      return response;
    },
    onSuccess: ({ outfit }) => {
      haptics.success();
      queryClient.setQueryData(outfitKeys.detail(outfit.id), outfit);
    },
    onError: () => haptics.error(),
  });
}
