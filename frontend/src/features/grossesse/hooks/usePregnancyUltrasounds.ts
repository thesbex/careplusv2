import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { PregnancyUltrasound } from '../types';

/**
 * GET /api/pregnancies/:pregnancyId/ultrasounds — list of obstetrical ultrasounds.
 */
export function usePregnancyUltrasounds(pregnancyId?: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pregnancies', 'ultrasounds', pregnancyId],
    queryFn: () =>
      api
        .get<PregnancyUltrasound[]>(`/pregnancies/${pregnancyId}/ultrasounds`)
        .then((r) => r.data),
    enabled: !!pregnancyId,
    staleTime: 30_000,
  });

  return {
    ultrasounds: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger les échographies.' : null,
  };
}
