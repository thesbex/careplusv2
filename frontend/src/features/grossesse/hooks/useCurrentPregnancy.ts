import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '@/lib/api/client';
import type { Pregnancy } from '../types';

/** Backend returns fetusesJson as a String — parse to typed array on read. */
interface PregnancyWire extends Omit<Pregnancy, 'fetuses'> {
  fetusesJson?: string | null;
}

export function parsePregnancy(wire: PregnancyWire): Pregnancy {
  let fetuses: { label: string }[] = [{ label: 'Fœtus unique' }];
  if (wire.fetusesJson) {
    try {
      const parsed = JSON.parse(wire.fetusesJson) as unknown;
      if (Array.isArray(parsed)) {
        fetuses = parsed as { label: string }[];
      }
    } catch {
      // fallback to default singleton
    }
  }
  const { fetusesJson: _drop, ...rest } = wire;
  return { ...rest, fetuses };
}

/**
 * GET /api/patients/:patientId/pregnancies/current — returns the active pregnancy
 * or null when none. Backend answers 404 in that case ; we map it to null.
 */
export function useCurrentPregnancy(patientId?: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pregnancies', 'current', patientId],
    queryFn: async (): Promise<Pregnancy | null> => {
      try {
        const res = await api.get<PregnancyWire>(
          `/patients/${patientId}/pregnancies/current`,
        );
        return parsePregnancy(res.data);
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
