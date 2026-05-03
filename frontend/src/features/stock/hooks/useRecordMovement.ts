import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { StockMovement } from '../types';

export interface RecordMovementBody {
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason?: string;
  lotNumber?: string;
  expiresOn?: string;
}

/**
 * Records a stock movement (IN / OUT / ADJUSTMENT).
 * POST /api/stock/articles/:articleId/movements
 * Invalidates article, movements, lots, and alerts on success.
 */
export function useRecordMovement(articleId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: RecordMovementBody) =>
      api
        .post<StockMovement>(`/stock/articles/${articleId}/movements`, body)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock', 'article', articleId] });
      void qc.invalidateQueries({ queryKey: ['stock', 'articles'] });
      void qc.invalidateQueries({ queryKey: ['stock', 'movements', articleId] });
      void qc.invalidateQueries({ queryKey: ['stock', 'lots', articleId] });
      void qc.invalidateQueries({ queryKey: ['stock', 'alerts'] });
    },
  });
}
