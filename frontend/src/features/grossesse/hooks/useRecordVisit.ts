import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { PregnancyVisit, RecordVisitRequest } from '../types';

/**
 * POST /api/pregnancies/:pregnancyId/visits — saisie biométrie obstétricale.
 *
 * Backend stocke la BU comme `urineDipJson` (JSONB sérialisé en String) ; on
 * stringify ici avant envoi pour aligner le contrat (cf. ADR-029).
 */
export function useRecordVisit(pregnancyId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: RecordVisitRequest) => {
      const { urineDip, ...rest } = body;
      const payload = {
        ...rest,
        ...(urineDip ? { urineDipJson: JSON.stringify(urineDip) } : {}),
      };
      return api
        .post<PregnancyVisit>(`/pregnancies/${pregnancyId}/visits`, payload)
        .then((r) => r.data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pregnancies', 'visits', pregnancyId] });
      void qc.invalidateQueries({ queryKey: ['pregnancies', 'alerts', pregnancyId] });
      void qc.invalidateQueries({ queryKey: ['pregnancies', 'plan', pregnancyId] });
    },
  });
}
