import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Soft-deletes an administered dose (MEDECIN/ADMIN only).
 * DELETE /api/patients/:patientId/vaccinations/:doseId
 */
export function useDeleteDose(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (doseId: string) =>
      api
        .delete<void>(`/patients/${patientId}/vaccinations/${doseId}`)
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['vaccination', 'calendar', patientId],
        refetchType: 'all',
      });
      void queryClient.invalidateQueries({
        queryKey: ['vaccination', 'queue'],
        refetchType: 'all',
      });
    },
  });
}
