import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';
import type { PregnancyAlert } from '../types';

/**
 * GET /api/pregnancies/:id/alerts — active alerts (HTA, BU+, terme dépassé, etc.).
 */
export function usePregnancyAlerts(pregnancyId?: string) {
  const { t } = useT();
  const { data, isLoading, error } = useQuery({
    queryKey: ['pregnancies', 'alerts', pregnancyId],
    queryFn: () =>
      api
        .get<PregnancyAlert[]>(`/pregnancies/${pregnancyId}/alerts`)
        .then((r) => r.data),
    enabled: !!pregnancyId,
    staleTime: 30_000,
  });

  return {
    alerts: data ?? [],
    isLoading,
    error: error ? t('gross.err.loadAlerts') : null,
  };
}
