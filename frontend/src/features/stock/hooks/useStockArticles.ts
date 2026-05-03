import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { StockArticle, PageView } from '../types';

export interface StockArticlesFilters {
  category?: string;
  supplierId?: string;
  q?: string;
  belowThreshold?: boolean;
  page?: number;
  size?: number;
}

/**
 * useStockArticles — fetches the paginated article list.
 * GET /api/stock/articles
 * staleTime: 30 s.
 */
export function useStockArticles(filters: StockArticlesFilters = {}) {
  const params: Record<string, string | number | boolean> = {
    page: filters.page ?? 0,
    size: filters.size ?? 20,
  };
  if (filters.category) params.category = filters.category;
  if (filters.supplierId) params.supplierId = filters.supplierId;
  if (filters.q) params.q = filters.q;
  if (filters.belowThreshold) params.belowThreshold = true;

  const { data, isLoading, error } = useQuery({
    queryKey: ['stock', 'articles', filters],
    queryFn: () =>
      api.get<PageView<StockArticle>>('/stock/articles', { params }).then((r) => r.data),
    staleTime: 30_000,
  });

  return {
    page: data ?? null,
    articles: data?.content ?? [],
    totalElements: data?.totalElements ?? 0,
    totalPages: data?.totalPages ?? 0,
    currentPage: data?.number ?? 0,
    isLoading,
    error: error ? 'Impossible de charger les articles.' : null,
  };
}
