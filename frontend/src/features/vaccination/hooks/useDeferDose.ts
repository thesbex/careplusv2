import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { DeferDoseRequest, VaccinationCalendarEntry } from '../types';

/**
 * Defers a dose (PLANNED/UPCOMING -> DEFERRED).
 * POST /api/patients/:patientId/vaccinations/:doseId/defer
 */
export function useDeferDose(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ doseId, body }: { doseId: string; body: DeferDoseRequest }) =>
      api
        .post<VaccinationCalendarEntry>(`/patients/${patientId}/vaccinations/${doseId}/defer`, body)
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
