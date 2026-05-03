import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { StockAlertCount } from '../types';

/**
 * Badge count for the Sidebar — total low-stock + expiring-soon articles.
 * GET /api/stock/alerts/count
 * Polling every 30 s.
 *
 * Follows the same resilience pattern as useVaccinationOverdueCount:
 * falls back to a disabled local client outside a QueryClientProvider.
 */
const FALLBACK_CLIENT = new QueryClient({
  defaultOptions: { queries: { retry: false, enabled: false } },
});

export function useStockAlertsCount(enabled = true): number | undefined {
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
      queryKey: ['stock', 'alerts', 'count'],
      queryFn: () =>
        api.get<StockAlertCount>('/stock/alerts/count').then((r) => r.data),
      refetchInterval: 30_000,
      staleTime: 25_000,
      enabled: enabled && !isFallback,
    },
    client,
  );

  if (!enabled || isFallback) return undefined;
  if (!data) return undefined;
  return data.lowStock + data.expiringSoon;
}
