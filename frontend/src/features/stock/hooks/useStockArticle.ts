import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';
import type { StockArticle } from '../types';

type ArticleDetail = StockArticle;

/**
 * useStockArticle — fetches a single article with its active lots.
 * GET /api/stock/articles/:id
 */
export function useStockArticle(id: string | undefined) {
  const { t } = useT();
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
    error: error ? t('stock.err.loadArticle') : null,
  };
}
