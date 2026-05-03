import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { PregnancyVisit, UrineDip } from '../types';

interface PageView<T> {
  content: T[];
  totalElements: number;
  page: number;
  size: number;
}

/** Backend returns urineDipJson as a String — parse to typed UrineDip on read. */
interface PregnancyVisitWire extends Omit<PregnancyVisit, 'urineDip'> {
  urineDipJson?: string | null;
}

function parseVisit(wire: PregnancyVisitWire): PregnancyVisit {
  let urineDip: UrineDip | null = null;
  if (wire.urineDipJson) {
    try {
      urineDip = JSON.parse(wire.urineDipJson) as UrineDip;
    } catch {
      urineDip = null;
    }
  }
  const { urineDipJson: _drop, ...rest } = wire;
  return { ...rest, urineDip };
}

/**
 * GET /api/pregnancies/:pregnancyId/visits — paginated, desc by recordedAt.
 * For Étape 4 we only need the first page (default 20 visits).
 */
export function usePregnancyVisits(pregnancyId?: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pregnancies', 'visits', pregnancyId],
    queryFn: () =>
      api
        .get<PageView<PregnancyVisitWire> | PregnancyVisitWire[]>(
          `/pregnancies/${pregnancyId}/visits`,
        )
        .then((r) => r.data),
    enabled: !!pregnancyId,
    staleTime: 30_000,
  });

  // Backend may return either a PageView or a plain array — accept both.
  const wires = !data ? [] : Array.isArray(data) ? data : data.content;
  const visits = wires.map(parseVisit);

  return {
    visits,
    isLoading,
    error: error ? 'Impossible de charger les visites.' : null,
  };
}
