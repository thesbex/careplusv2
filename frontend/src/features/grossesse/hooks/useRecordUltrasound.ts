import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { PregnancyUltrasound, RecordUltrasoundRequest } from '../types';

/**
 * POST /api/pregnancies/:pregnancyId/ultrasounds — saisie d'une échographie.
 * Si correctsDueDate=true et kind=T1_DATATION, la DPA est ajustée backend-side.
 *
 * Backend attend `biometryJson` (JSONB sérialisé en String) ; on stringify ici
 * avant envoi pour aligner le contrat (cf. ADR-029).
 */
export function useRecordUltrasound(pregnancyId: string, patientId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: RecordUltrasoundRequest) => {
      const { biometry, ...rest } = body;
      const payload = {
        ...rest,
        ...(biometry ? { biometryJson: JSON.stringify(biometry) } : {}),
      };
      return api
        .post<PregnancyUltrasound>(`/pregnancies/${pregnancyId}/ultrasounds`, payload)
        .then((r) => r.data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pregnancies', 'ultrasounds', pregnancyId] });
      void qc.invalidateQueries({ queryKey: ['pregnancies', 'plan', pregnancyId] });
      // DPA may have shifted → refresh la grossesse en cours.
      if (patientId) {
        void qc.invalidateQueries({ queryKey: ['pregnancies', 'current', patientId] });
      }
    },
  });
}
