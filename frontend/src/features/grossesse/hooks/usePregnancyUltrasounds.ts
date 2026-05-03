import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Biometry, PregnancyUltrasound } from '../types';

/** Backend returns biometryJson as a String — parse to typed Biometry on read. */
interface UltrasoundWire extends Omit<PregnancyUltrasound, 'biometry'> {
  biometryJson?: string | null;
}

function parseUltrasound(wire: UltrasoundWire): PregnancyUltrasound {
  let biometry: Biometry | null = null;
  if (wire.biometryJson) {
    try {
      biometry = JSON.parse(wire.biometryJson) as Biometry;
    } catch {
      biometry = null;
    }
  }
  const { biometryJson: _drop, ...rest } = wire;
  return { ...rest, biometry };
}

/**
 * GET /api/pregnancies/:pregnancyId/ultrasounds — list of obstetrical ultrasounds.
 */
export function usePregnancyUltrasounds(pregnancyId?: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pregnancies', 'ultrasounds', pregnancyId],
    queryFn: () =>
      api
        .get<UltrasoundWire[]>(`/pregnancies/${pregnancyId}/ultrasounds`)
        .then((r) => r.data),
    enabled: !!pregnancyId,
    staleTime: 30_000,
  });

  return {
    ultrasounds: (data ?? []).map(parseUltrasound),
    isLoading,
    error: error ? 'Impossible de charger les échographies.' : null,
  };
}
