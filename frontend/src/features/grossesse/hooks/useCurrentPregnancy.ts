import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '@/lib/api/client';
import type { Pregnancy } from '../types';

/**
 * GET /api/patients/:patientId/pregnancies/current — returns the active pregnancy
 * or null when none. Backend answers 404 in that case ; we map it to null.
 */
export function useCurrentPregnancy(patientId?: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pregnancies', 'current', patientId],
    queryFn: async (): Promise<Pregnancy | null> => {
      try {
        const res = await api.get<Pregnancy>(
          `/patients/${patientId}/pregnancies/current`,
        );
        return res.data;
      } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: !!patientId,
    staleTime: 30_000,
  });

  return {
    pregnancy: data ?? null,
    isLoading,
    error: error ? 'Impossible de charger la grossesse en cours.' : null,
  };
}
