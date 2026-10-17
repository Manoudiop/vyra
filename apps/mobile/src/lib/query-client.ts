import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retry transient failures only; a 4xx will not fix itself.
      retry: (failureCount, error) =>
        failureCount < 2 &&
        !(error instanceof ApiError && error.status !== null && error.status < 500),
    },
  },
});
