import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Pregnancy } from '../types';

/**
 * GET /api/patients/:patientId/pregnancies — full history (en cours + clôturées).
 */
export function usePregnancies(patientId?: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pregnancies', 'list', patientId],
    queryFn: () =>
      api
        .get<Pregnancy[]>(`/patients/${patientId}/pregnancies`)
        .then((r) => r.data),
    enabled: !!patientId,
    staleTime: 60_000,
  });

  return {
    pregnancies: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger les grossesses.' : null,
  };
}
