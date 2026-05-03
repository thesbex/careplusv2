import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { CreateChildRequest } from '../types';

interface CreateChildResponse {
  childPatientId: string;
  pregnancyId: string;
}

/**
 * POST /api/pregnancies/:id/create-child — creates the child patient record
 * and triggers the PNI vaccination calendar generation (V022).
 */
export function useCreateChildFromPregnancy(pregnancyId: string, patientId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateChildRequest) =>
      api
        .post<CreateChildResponse>(`/pregnancies/${pregnancyId}/create-child`, body)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pregnancies'] });
      if (patientId) {
        void qc.invalidateQueries({ queryKey: ['pregnancies', 'list', patientId] });
      }
    },
  });
}
