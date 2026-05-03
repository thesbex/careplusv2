import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';
import type { UpdateDoseRequest, VaccinationCalendarEntry } from '../types';

/**
 * Updates an existing administered dose.
 * PUT /api/patients/:patientId/vaccinations/:doseId
 * version field is required for optimistic locking (409 = concurrent edit).
 */
export function useUpdateDose(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ doseId, body }: { doseId: string; body: UpdateDoseRequest }) =>
      api
        .put<VaccinationCalendarEntry>(`/patients/${patientId}/vaccinations/${doseId}`, body)
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['vaccination', 'calendar', patientId],
        refetchType: 'all',
      });
    },
    onError: (err) => {
      if (isAxiosError(err) && err.response?.status === 409) {
        toast.error('Une autre personne a modifié cette dose. Rechargez.');
      }
    },
  });
}
