import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { RecordDoseRequest, VaccinationCalendarEntry } from '../types';

/**
 * Records a new administered dose.
 * POST /api/patients/:patientId/vaccinations
 * On success, invalidates the patient's calendar + the global vaccination queue.
 */
export function useRecordDose(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: RecordDoseRequest) =>
      api
        .post<VaccinationCalendarEntry>(`/patients/${patientId}/vaccinations`, body)
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
