import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';
import type { CaisseSummaryApi } from '../types';

/**
 * Charge la caisse pour une date donnée (par défaut aujourd'hui en TZ
 * Africa/Casablanca côté backend). Auto-refetch toutes les 30s pour
 * refléter les nouveaux encaissements en quasi-temps-réel.
 */
export function useCaisseToday(date?: string) {
  const { t } = useT();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['caisse', date ?? 'today'],
    queryFn: () =>
      api
        .get<CaisseSummaryApi>('/caisse', date ? { params: { date } } : undefined)
        .then((r) => r.data),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  return {
    caisse: data ?? null,
    isLoading,
    error: error ? t('factu.error.loadCaisse') : null,
    refetch,
  };
}
