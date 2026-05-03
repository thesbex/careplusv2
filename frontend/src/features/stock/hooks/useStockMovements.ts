import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { StockMovement, PageView } from '../types';

export interface StockMovementsFilters {
  from?: string; // ISO date
  to?: string;   // ISO date
  type?: string;
  page?: number;
  size?: number;
}

/**
 * useStockMovements — fetches the paginated movement history for an article.
 * GET /api/stock/articles/:id/movements
 */
export function useStockMovements(articleId: string | undefined, filters: StockMovementsFilters = {}) {
  const params: Record<string, string | number> = {
    page: filters.page ?? 0,
    size: filters.size ?? 50,
  };
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.type) params.type = filters.type;

  const { data, isLoading, error } = useQuery({
    queryKey: ['stock', 'movements', articleId, filters],
    queryFn: () =>
      api
        .get<PageView<StockMovement>>(`/stock/articles/${articleId}/movements`, { params })
        .then((r) => r.data),
    enabled: Boolean(articleId),
    staleTime: 30_000,
  });

  return {
    page: data ?? null,
    movements: data?.content ?? [],
    totalElements: data?.totalElements ?? 0,
    totalPages: data?.totalPages ?? 0,
    currentPage: data?.number ?? 0,
    isLoading,
    error: error ? 'Impossible de charger les mouvements.' : null,
  };
}
