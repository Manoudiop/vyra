import { useQuery } from '@tanstack/react-query';
import { healthResponseSchema } from '@vyra/shared';
import { apiRequest } from '@/lib/api-client';

export function useApiHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => healthResponseSchema.parse(await apiRequest<unknown>('/health')),
  });
}
