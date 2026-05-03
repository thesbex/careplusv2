import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { VaccineCatalogEntry } from '../types';

export interface UpsertVaccineBody {
  code: string;
  nameFr: string;
  manufacturerDefault?: string | null;
  routeDefault?: string | null;
  active: boolean;
  isPni?: boolean;
}

/**
 * Create (POST) or update (PUT) a vaccine in the catalog.
 * mode='create' → POST /api/vaccinations/catalog
 * mode='edit'   → PUT  /api/vaccinations/catalog/:id
 * Invalidates ['vaccination', 'catalog'] on success.
 */
export function useUpsertVaccine(mode: 'create' | 'edit') {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: UpsertVaccineBody }) => {
      if (mode === 'edit' && id) {
        return api.put<VaccineCatalogEntry>(`/vaccinations/catalog/${id}`, body).then((r) => r.data);
      }
      return api.post<VaccineCatalogEntry>('/vaccinations/catalog', body).then((r) => r.data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vaccination', 'catalog'] });
    },
  });
}
