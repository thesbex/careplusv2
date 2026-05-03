import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { PregnancyVisit, RecordVisitRequest } from '../types';

/**
 * POST /api/pregnancies/:pregnancyId/visits — saisie biométrie obstétricale.
 */
export function useRecordVisit(pregnancyId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: RecordVisitRequest) =>
      api
        .post<PregnancyVisit>(`/pregnancies/${pregnancyId}/visits`, body)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pregnancies', 'visits', pregnancyId] });
      void qc.invalidateQueries({ queryKey: ['pregnancies', 'alerts', pregnancyId] });
      void qc.invalidateQueries({ queryKey: ['pregnancies', 'plan', pregnancyId] });
    },
  });
}
