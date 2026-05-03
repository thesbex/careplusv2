import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ClosePregnancyRequest, Pregnancy } from '../types';

/**
 * POST /api/pregnancies/:id/close — close pregnancy with outcome.
 */
export function useClosePregnancy(pregnancyId: string, patientId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: ClosePregnancyRequest) =>
      api
        .post<Pregnancy>(`/pregnancies/${pregnancyId}/close`, body)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pregnancies'] });
      if (patientId) {
        void qc.invalidateQueries({ queryKey: ['pregnancies', 'current', patientId] });
        void qc.invalidateQueries({ queryKey: ['pregnancies', 'list', patientId] });
      }
    },
  });
}
