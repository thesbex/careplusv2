import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

interface MinimalPage {
  totalElements: number;
}

/**
 * Badge count for the Sidebar — total overdue vaccinations.
 * GET /api/vaccinations/queue?status=OVERDUE&size=1 (only totalElements matters).
 * Polling every 30 s, aligned with the worklist staleTime.
 *
 * Follows the same resilience pattern as useSalleBadgeCount: if called outside a
 * QueryClientProvider (e.g. in unit tests without a provider), falls back to a
 * disabled local client so the component doesn't crash.
 */
const FALLBACK_CLIENT = new QueryClient({
  defaultOptions: { queries: { retry: false, enabled: false } },
});

export function useVaccinationOverdueCount(enabled = true): number | undefined {
  let providerClient: QueryClient | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    providerClient = useQueryClient();
  } catch {
    providerClient = undefined;
  }
  const client = providerClient ?? FALLBACK_CLIENT;
  const isFallback = client === FALLBACK_CLIENT;

  const { data } = useQuery(
    {
      queryKey: ['vaccination', 'queue-badge'],
      queryFn: () =>
        api
          .get<MinimalPage>('/vaccinations/queue', {
            params: { status: 'OVERDUE', size: 1, page: 0 },
          })
          .then((r) => r.data),
      refetchInterval: 30_000,
      staleTime: 25_000,
      enabled: enabled && !isFallback,
    },
    client,
  );

  if (!enabled || isFallback) return undefined;
  return data?.totalElements;
}
