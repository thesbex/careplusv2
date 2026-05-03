import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { VaccinationCalendarEntry } from '../types';

/**
 * Marks a dose as skipped (MEDECIN/ADMIN only).
 * POST /api/patients/:patientId/vaccinations/:doseId/skip
 */
export function useSkipDose(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (doseId: string) =>
      api
        .post<VaccinationCalendarEntry>(`/patients/${patientId}/vaccinations/${doseId}/skip`)
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
