import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { StockLot, StockLotStatus } from '../types';

/**
 * useStockLots — fetches the lots for an article.
 * GET /api/stock/articles/:id/lots
 */
export function useStockLots(articleId: string | undefined, status?: StockLotStatus) {
  const params: Record<string, string> = {};
  if (status) params.status = status;

  const { data, isLoading, error } = useQuery({
    queryKey: ['stock', 'lots', articleId, status],
    queryFn: () =>
      api
        .get<StockLot[]>(`/stock/articles/${articleId}/lots`, { params })
        .then((r) => r.data),
    enabled: Boolean(articleId),
    staleTime: 30_000,
  });

  return {
    lots: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger les lots.' : null,
  };
}
