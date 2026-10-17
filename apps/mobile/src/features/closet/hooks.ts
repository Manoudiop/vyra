import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  type ClosetPage,
  type ClothingItem,
  type ClothingItemDetail,
  type UpdateClothingItemInput,
} from '@vyra/shared';
import { haptics } from '@/ui';
import { closetApi, type ClosetFilters, closetKeys } from './closet-api';

export function useClosetList(filters: ClosetFilters) {
  return useInfiniteQuery({
    queryKey: closetKeys.list(filters),
    queryFn: ({ pageParam }) => closetApi.list(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Keep showing the previous results while a new filter loads: no flash of skeletons.
    placeholderData: (previous) => previous,
  });
}

export function useClosetSummary() {
  return useQuery({ queryKey: closetKeys.summary(), queryFn: closetApi.summary });
}

export function useClothingItem(id: string) {
  return useQuery({ queryKey: closetKeys.item(id), queryFn: () => closetApi.get(id) });
}

type ListData = InfiniteData<ClosetPage, string | null>;

/** Applies `update` to the item wherever it is cached (every list page + detail). */
function patchCachedItem(
  queryClient: QueryClient,
  id: string,
  update: (item: ClothingItem) => ClothingItem | null,
) {
  queryClient.setQueriesData<ListData>({ queryKey: closetKeys.lists() }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.flatMap((item) => {
              if (item.id !== id) return [item];
              const next = update(item);
              return next ? [next] : [];
            }),
          })),
        }
      : data,
  );
  queryClient.setQueryData<ClothingItemDetail>(closetKeys.item(id), (detail) => {
    if (!detail) return detail;
    const next = update(detail);
    return next ? { ...detail, ...next } : detail;
  });
}

/** Snapshot every closet query so an optimistic change can be rolled back. */
async function snapshot(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: closetKeys.all });
  return queryClient.getQueriesData({ queryKey: closetKeys.all });
}

function restore(queryClient: QueryClient, saved: Awaited<ReturnType<typeof snapshot>>) {
  for (const [key, data] of saved) queryClient.setQueryData(key, data);
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      closetApi.update(id, { isFavorite }),
    onMutate: async ({ id, isFavorite }) => {
      haptics.selection();
      const saved = await snapshot(queryClient);
      patchCachedItem(queryClient, id, (item) => ({ ...item, isFavorite }));
      return { saved };
    },
    onError: (_error, _variables, context) => {
      haptics.error();
      if (context) restore(queryClient, context.saved);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: closetKeys.all }),
  });
}

export function useUpdateItem(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateClothingItemInput) => closetApi.update(id, body),
    onSuccess: (updated) => {
      haptics.success();
      patchCachedItem(queryClient, id, () => updated);
      void queryClient.invalidateQueries({ queryKey: closetKeys.all });
    },
    onError: () => haptics.error(),
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => closetApi.remove(id),
    onMutate: async (id) => {
      const saved = await snapshot(queryClient);
      patchCachedItem(queryClient, id, () => null);
      return { saved };
    },
    onSuccess: () => haptics.success(),
    onError: (_error, _id, context) => {
      haptics.error();
      if (context) restore(queryClient, context.saved);
    },
    onSettled: (_data, _error, id) => {
      queryClient.removeQueries({ queryKey: closetKeys.item(id) });
      void queryClient.invalidateQueries({ queryKey: closetKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: closetKeys.summary() });
    },
  });
}
