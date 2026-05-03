import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { VaccineScheduleDose } from './useVaccinationSchedule';

export interface UpsertScheduleDoseBody {
  vaccineId: string;
  doseNumber: number;
  targetAgeDays: number;
  toleranceDays: number;
  labelFr: string;
}

/**
 * Create (POST) or update (PUT) a scheduled dose.
 * mode='create' → POST /api/vaccinations/schedule
 * mode='edit'   → PUT  /api/vaccinations/schedule/:id
 * Invalidates ['vaccination', 'schedule'] on success.
 */
export function useUpsertScheduleDose(mode: 'create' | 'edit') {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: UpsertScheduleDoseBody }) => {
      if (mode === 'edit' && id) {
        return api
          .put<VaccineScheduleDose>(`/vaccinations/schedule/${id}`, body)
          .then((r) => r.data);
      }
      return api
        .post<VaccineScheduleDose>('/vaccinations/schedule', body)
        .then((r) => r.data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vaccination', 'schedule'] });
    },
  });
}
