import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { PregnancyVisitPlanEntry } from '../types';

/**
 * GET /api/pregnancies/:id/plan — 8-entry visit plan (SA 12, 20, 26, 30, 34, 36, 38, 40).
 */
export function usePregnancyPlan(pregnancyId?: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pregnancies', 'plan', pregnancyId],
    queryFn: () =>
      api
        .get<PregnancyVisitPlanEntry[]>(`/pregnancies/${pregnancyId}/plan`)
        .then((r) => r.data),
    enabled: !!pregnancyId,
    staleTime: 60_000,
  });

  return {
    plan: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger le plan de visites.' : null,
  };
}
