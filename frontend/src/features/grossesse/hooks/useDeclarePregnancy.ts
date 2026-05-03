import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { DeclarePregnancyRequest, Pregnancy } from '../types';

/**
 * POST /api/patients/:patientId/pregnancies — declare a new pregnancy.
 * On success, invalidates list + current pregnancy queries.
 */
export function useDeclarePregnancy(patientId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: DeclarePregnancyRequest) =>
      api
        .post<Pregnancy>(`/patients/${patientId}/pregnancies`, body)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pregnancies', 'list', patientId] });
      void qc.invalidateQueries({ queryKey: ['pregnancies', 'current', patientId] });
      // TODO Étape 5 : invalider la worklist + le badge alertes sidebar.
    },
  });
}
