import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Queue entry returned by GET /api/vaccinations/queue.
 * Mirrors backend VaccinationQueueEntry DTO.
 */
export interface VaccinationQueueEntry {
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  patientPhotoDocumentId: string | null;
  patientBirthDate: string; // ISO date
  vaccineId: string;
  vaccineCode: string;
  vaccineName: string;
  doseNumber: number;
  doseLabel: string;
  scheduleDoseId: string | null;
  targetDate: string; // ISO date
  daysOverdue: number; // positive = overdue, negative = upcoming, 0 = due today
  status: 'OVERDUE' | 'DUE_SOON' | 'UPCOMING';
}

export interface VaccinationsQueuePage {
  content: VaccinationQueueEntry[];
  totalElements: number;
  totalPages: number;
  number: number; // current page (0-indexed)
  size: number;
}

export interface VaccinationsQueueFilters {
  status: 'OVERDUE' | 'DUE_SOON' | 'UPCOMING';
  vaccineCode?: string;
  ageGroupMinMonths?: number;
  ageGroupMaxMonths?: number;
  page?: number;
  size?: number;
  /** upcomingHorizonDays — only relevant for UPCOMING status */
  upcomingHorizonDays?: number;
}

/**
 * useVaccinationsQueue — fetches the vaccination worklist.
 * GET /api/vaccinations/queue
 * staleTime: 30 s (aligned with sidebar polling interval).
 */
export function useVaccinationsQueue(filters: VaccinationsQueueFilters) {
  const params: Record<string, string | number> = {
    status: filters.status,
    page: filters.page ?? 0,
    size: filters.size ?? 50,
  };
  if (filters.vaccineCode) params.vaccineCode = filters.vaccineCode;
  if (filters.ageGroupMinMonths !== undefined) params.ageGroupMinMonths = filters.ageGroupMinMonths;
  if (filters.ageGroupMaxMonths !== undefined) params.ageGroupMaxMonths = filters.ageGroupMaxMonths;
  if (filters.upcomingHorizonDays !== undefined) params.upcomingHorizonDays = filters.upcomingHorizonDays;

  const { data, isLoading, error } = useQuery({
    queryKey: ['vaccination', 'queue', filters],
    queryFn: () =>
      api
        .get<VaccinationsQueuePage>('/vaccinations/queue', { params })
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
    error: error ? 'Impossible de charger la liste des vaccinations.' : null,
  };
}
