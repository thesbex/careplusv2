import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Pregnancy, UpdatePregnancyRequest } from '../types';

/**
 * PUT /api/pregnancies/:id — patch lmpDate / dueDate / dueDateSource / notes.
 */
export function useUpdatePregnancy(pregnancyId: string, patientId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdatePregnancyRequest) =>
      api.put<Pregnancy>(`/pregnancies/${pregnancyId}`, body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pregnancies'] });
      if (patientId) {
        void qc.invalidateQueries({ queryKey: ['pregnancies', 'current', patientId] });
      }
    },
  });
}
