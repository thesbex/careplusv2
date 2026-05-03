import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';
import { toProblemDetail } from '@/lib/api/problemJson';

/**
 * Deactivates (DELETE) a vaccine from the catalog.
 * DELETE /api/vaccinations/catalog/:id
 * - 422 PNI_PROTECTED → toast "Vaccin PNI : désactivation interdite".
 * Invalidates ['vaccination', 'catalog'] on success.
 */
export function useDeactivateVaccine() {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (vaccineId: string) =>
      api.delete(`/vaccinations/catalog/${vaccineId}`).then(() => undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vaccination', 'catalog'] });
    },
    onError: (err) => {
      const problem = toProblemDetail(err);
      if (problem.status === 422 || problem.type?.includes('PNI_PROTECTED')) {
        toast.error('Vaccin PNI : désactivation interdite');
      } else {
        toast.error(problem.title, problem.detail ? { description: problem.detail } : undefined);
      }
    },
  });

  return {
    deactivate: (vaccineId: string) => mutation.mutateAsync(vaccineId),
    isPending: mutation.isPending,
  };
}
