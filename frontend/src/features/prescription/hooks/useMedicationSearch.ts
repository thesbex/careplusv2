import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { MedicationApi } from '../types';

/** Debounced medication autocomplete. */
export function useMedicationSearch(query: string) {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const enabled = debounced.trim().length >= 2;

  const { data, isFetching } = useQuery({
    queryKey: ['medications', debounced],
    queryFn: () =>
      api
        .get<MedicationApi[]>(`/catalog/medications`, { params: { q: debounced } })
        .then((r) => r.data),
    enabled,
    staleTime: 60_000,
  });

  return {
    results: data ?? [],
    isFetching: enabled && isFetching,
    hasQuery: enabled,
  };
}
