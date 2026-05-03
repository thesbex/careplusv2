import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { StockArticle } from '../types';

export interface UpsertArticleBody {
  code: string;
  label: string;
  category: string;
  unit: string;
  minThreshold: number;
  supplierId?: string;
  location?: string;
  active: boolean;
}

/**
 * Create (POST) or update (PUT) a stock article.
 * mode='create' → POST /api/stock/articles
 * mode='edit'   → PUT  /api/stock/articles/:id
 * Invalidates ['stock', 'articles'] on success.
 */
export function useUpsertArticle(mode: 'create' | 'edit') {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: UpsertArticleBody }) => {
      if (mode === 'edit' && id) {
        return api.put<StockArticle>(`/stock/articles/${id}`, body).then((r) => r.data);
      }
      return api.post<StockArticle>('/stock/articles', body).then((r) => r.data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock', 'articles'] });
    },
  });
}
