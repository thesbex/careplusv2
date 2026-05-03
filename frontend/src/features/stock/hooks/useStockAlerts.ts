import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { StockAlertsView } from '../types';

/**
 * useStockAlerts — fetches the detailed alerts list.
 * GET /api/stock/alerts
 */
export function useStockAlerts() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stock', 'alerts'],
    queryFn: () =>
      api.get<StockAlertsView>('/stock/alerts').then((r) => r.data),
    staleTime: 30_000,
  });

  return {
    alerts: data ?? null,
    lowStockArticles: data?.lowStockArticles ?? [],
    expiringSoonLots: data?.expiringSoonLots ?? [],
    isLoading,
    error: error ? 'Impossible de charger les alertes.' : null,
  };
}
