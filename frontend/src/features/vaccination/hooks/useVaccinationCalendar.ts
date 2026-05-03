import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { VaccinationCalendarEntry } from '../types';

/**
 * Fetches the vaccination calendar for a patient.
 * GET /api/patients/:patientId/vaccinations
 * Returns both materialised (ADMINISTERED/DEFERRED/SKIPPED) and on-the-fly UPCOMING/DUE_SOON/OVERDUE doses.
 */
export function useVaccinationCalendar(patientId?: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['vaccination', 'calendar', patientId],
    queryFn: () =>
      api
        .get<VaccinationCalendarEntry[]>(`/patients/${patientId}/vaccinations`)
        .then((r) => r.data),
    enabled: !!patientId,
    staleTime: 60_000,
  });

  return {
    calendar: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger le calendrier vaccinal.' : null,
  };
}
