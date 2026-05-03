import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Soft-delete a supplier (sets active=false).
 * DELETE /api/stock/suppliers/:id
 * Invalidates ['stock', 'suppliers'] on success.
 */
export function useDeactivateSupplier() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(`/stock/suppliers/${id}`).then(() => undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock', 'suppliers'] });
    },
  });

  return {
    deactivate: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
