import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { CatalogItem, LabTestApi, ImagingExamApi, MedicationApi } from '../types';
import type { PrescriptionType } from '../types';

function toItem(
  type: PrescriptionType,
  raw: MedicationApi | LabTestApi | ImagingExamApi,
): CatalogItem {
  if (type === 'DRUG') {
    const m = raw as MedicationApi;
    return {
      id: m.id,
      name: m.name,
      sub: [m.molecule, m.form, m.strength].filter(Boolean).join(' · ') || null,
    };
  }
  if (type === 'LAB') {
    const t = raw as LabTestApi;
    return { id: t.id, name: t.name, sub: [t.code, t.category].filter(Boolean).join(' · ') || null };
  }
  const e = raw as ImagingExamApi;
  return { id: e.id, name: e.name, sub: [e.code, e.modality].filter(Boolean).join(' · ') || null };
}

const PATH: Record<PrescriptionType, string | null> = {
  DRUG: '/catalog/medications',
  LAB: '/catalog/lab-tests',
  IMAGING: '/catalog/imaging-exams',
  CERT: null,
  SICK_LEAVE: null,
};

/**
 * Unified catalog autocomplete — picks the right endpoint based on the
 * prescription type and normalizes results into CatalogItem.
 */
export function useCatalogSearch(type: PrescriptionType, query: string) {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const path = PATH[type];
  // Allow empty query for LAB/IMAGING (returns top 20). DRUG requires >= 2 chars
  // because the medication search is wider and would otherwise dump the table.
  const minChars = type === 'DRUG' ? 2 : 0;
  const enabled = path !== null && debounced.trim().length >= minChars;

  const { data, isFetching } = useQuery({
    queryKey: ['catalog-search', type, debounced],
    queryFn: () =>
      api
        .get<(MedicationApi | LabTestApi | ImagingExamApi)[]>(path ?? '/_disabled', {
          params: { q: debounced },
        })
        .then((r) => r.data),
    enabled,
    staleTime: 60_000,
  });

  return {
    results: (data ?? []).map((raw) => toItem(type, raw)),
    isFetching: enabled && isFetching,
    hasQuery: enabled,
  };
}
