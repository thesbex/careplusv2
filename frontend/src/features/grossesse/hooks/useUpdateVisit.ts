import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { PregnancyVisit, RecordVisitRequest } from '../types';

interface UpdateVisitArgs {
  visitId: string;
  body: RecordVisitRequest & { version: number };
}

/**
 * PUT /api/pregnancies/visits/:visitId — modify a visit before consultation
 * signature. Version is required for optimistic locking.
 */
export function useUpdateVisit(pregnancyId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ visitId, body }: UpdateVisitArgs) =>
      api
        .put<PregnancyVisit>(`/pregnancies/visits/${visitId}`, body)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pregnancies', 'visits', pregnancyId] });
      void qc.invalidateQueries({ queryKey: ['pregnancies', 'alerts', pregnancyId] });
    },
  });
}
