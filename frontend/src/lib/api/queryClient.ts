import { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

/**
 * Shared TanStack Query client.
 *
 * Retry policy: don't retry 4xx (bad request / auth / validation) — the
 * axios interceptor already handled the refresh flow on 401, and the user
 * won't magically have different permissions the second time around. Retry
 * transient 5xx and network errors twice.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (isAxiosError(error)) {
          const status = error.response?.status;
          if (status && status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
