import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

interface AlertsCountResponse {
  withActiveAlerts: number;
}

/**
 * Badge count for the Sidebar — total pregnancies with at least one active
 * alert (HTA gravidique, BU+, terme dépassé, etc.).
 * GET /api/pregnancies/alerts/count
 * Polling every 30 s.
 *
 * Same resilience pattern as useVaccinationOverdueCount / useStockAlertsCount:
 * if used outside a QueryClientProvider, falls back to a disabled local client
 * so a Sidebar render in isolated tests doesn't crash.
 */
const FALLBACK_CLIENT = new QueryClient({
  defaultOptions: { queries: { retry: false, enabled: false } },
});

export function useGrossesseAlertsCount(enabled = true): number | undefined {
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
      queryKey: ['pregnancies', 'alerts', 'count'],
      queryFn: () =>
        api
          .get<AlertsCountResponse>('/pregnancies/alerts/count')
          .then((r) => r.data),
      refetchInterval: 30_000,
      staleTime: 25_000,
      enabled: enabled && !isFallback,
    },
    client,
  );

  if (!enabled || isFallback) return undefined;
  if (!data) return undefined;
  return data.withActiveAlerts;
}
