import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { StockArticle } from '../types';

type ArticleDetail = StockArticle;

/**
 * useStockArticle — fetches a single article with its active lots.
 * GET /api/stock/articles/:id
 */
export function useStockArticle(id: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stock', 'article', id],
    queryFn: () =>
      api.get<ArticleDetail>(`/stock/articles/${id}`).then((r) => r.data),
    enabled: Boolean(id),
    staleTime: 30_000,
  });

  return {
    article: data ?? null,
    isLoading,
    error: error ? "Impossible de charger l'article." : null,
  };
}
