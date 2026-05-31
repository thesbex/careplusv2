import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';

/**
 * Mirrors backend VaccineScheduleDoseDto.
 */
export interface VaccineScheduleDose {
  id: string;
  vaccineId: string;
  vaccineCode: string;
  vaccineNameFr: string;
  doseNumber: number;
  targetAgeDays: number;
  toleranceDays: number;
  labelFr: string;
}

/**
 * Fetches the vaccination schedule (planned doses calendar).
 * GET /api/vaccinations/schedule
 * Sorted by targetAgeDays ASC on the server; if not, we sort client-side.
 */
export function useVaccinationSchedule() {
  const { t } = useT();
  const { data, isLoading, error } = useQuery({
    queryKey: ['vaccination', 'schedule'],
    queryFn: () =>
      api.get<VaccineScheduleDose[]>('/vaccinations/schedule').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const sorted = (data ?? []).slice().sort((a, b) => a.targetAgeDays - b.targetAgeDays);

  return {
    schedule: sorted,
    isLoading,
    error: error ? t('vacc.param.schedule.loadError') : null,
  };
}
