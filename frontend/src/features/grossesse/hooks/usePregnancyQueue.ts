import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { PregnancyAlert, Trimester } from '../types';

/**
 * Worklist entry returned by GET /api/pregnancies/queue.
 * Mirrors backend PregnancyQueueEntry DTO. Trimester is computed server-side
 * from the current SA (T1: <14, T2: 14-27, T3: ≥28).
 */
export interface PregnancyQueueEntry {
  pregnancyId: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  patientPhotoDocumentId: string | null;
  saWeeks: number;
  saDays: number;
  trimester: Trimester;
  dueDate: string; // ISO date
  /** ISO datetime of the most recent recorded visit, or null if none. */
  lastVisitAt: string | null;
  alerts: PregnancyAlert[];
}

interface PregnancyQueuePage {
  content: PregnancyQueueEntry[];
  totalElements: number;
  totalPages: number;
  number: number; // current page (0-indexed)
  size: number;
}

export interface PregnancyQueueFilters {
  trimester?: Trimester;
  withAlerts?: boolean;
  q?: string;
}

/**
 * usePregnancyQueue — fetches the pregnancy worklist.
 * GET /api/pregnancies/queue
 * staleTime: 30 s (aligned with the badge polling).
 *
 * Default sort (server-side): SA descending — most advanced pregnancies first.
 */
export function usePregnancyQueue(
  filters: PregnancyQueueFilters,
  page: number,
  size: number,
) {
  const params: Record<string, string | number | boolean> = {
    page,
    size,
  };
  if (filters.trimester) params.trimester = filters.trimester;
  if (filters.withAlerts) params.withAlerts = true;
  if (filters.q && filters.q.trim().length > 0) params.q = filters.q.trim();

  const { data, isLoading, error } = useQuery({
    queryKey: ['pregnancies', 'queue', filters, page, size],
    queryFn: () =>
      api
        .get<PregnancyQueuePage>('/pregnancies/queue', { params })
        .then((r) => r.data),
    staleTime: 30_000,
  });

  return {
    page: data ?? null,
    entries: data?.content ?? [],
    totalElements: data?.totalElements ?? 0,
    totalPages: data?.totalPages ?? 0,
    currentPage: data?.number ?? 0,
    isLoading,
    error: error ? 'Impossible de charger la liste des grossesses.' : null,
  };
}
