import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Deletes a scheduled dose from the vaccination calendar.
 * DELETE /api/vaccinations/schedule/:id
 * Invalidates ['vaccination', 'schedule'] on success.
 */
export function useDeleteScheduleDose() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (doseId: string) =>
      api.delete(`/vaccinations/schedule/${doseId}`).then(() => undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vaccination', 'schedule'] });
    },
  });

  return {
    deleteDose: (doseId: string) => mutation.mutateAsync(doseId),
    isPending: mutation.isPending,
    deletingId: mutation.variables,
  };
}
