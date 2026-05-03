import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Soft-delete a stock article (sets active=false).
 * DELETE /api/stock/articles/:id
 * Invalidates ['stock', 'articles'] on success.
 */
export function useDeactivateArticle() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(`/stock/articles/${id}`).then(() => undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock', 'articles'] });
    },
  });

  return {
    deactivate: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
