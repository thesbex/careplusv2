import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { VaccineCatalogEntry } from '../types';

/**
 * Fetches the vaccine catalog.
 * GET /api/vaccinations/catalog
 * staleTime is long (5 min) — the catalog changes rarely.
 */
export function useVaccinationCatalog() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['vaccination', 'catalog'],
    queryFn: () =>
      api.get<VaccineCatalogEntry[]>('/vaccinations/catalog').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  return {
    catalog: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger le catalogue de vaccins.' : null,
  };
}
