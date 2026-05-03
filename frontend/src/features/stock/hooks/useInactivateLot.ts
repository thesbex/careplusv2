import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { StockLot } from '../types';

/**
 * Marks a lot INACTIVE (supplier recall).
 * PUT /api/stock/lots/:lotId/inactivate
 * Invalidates lots + article on success.
 */
export function useInactivateLot(articleId: string) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (lotId: string) =>
      api.put<StockLot>(`/stock/lots/${lotId}/inactivate`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock', 'lots', articleId] });
      void qc.invalidateQueries({ queryKey: ['stock', 'article', articleId] });
      void qc.invalidateQueries({ queryKey: ['stock', 'articles'] });
    },
  });

  return {
    inactivate: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
