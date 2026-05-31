/**
 * Listing en lecture seule des médecins (V032).
 *
 * Utilisé par :
 *   - le formulaire user (multi-select "Médecins gérés" pour SECRETAIRE/ASSISTANT),
 *   - le toggle "Cloisonnement des agendas" (auto-hide si <2 médecins).
 *
 * Endpoint : GET /api/practitioners → MEDECIN actifs uniquement, ordonnés par nom.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';

export interface PractitionerView {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  active: boolean;
}

const STABLE_EMPTY: PractitionerView[] = [];

export function usePractitioners() {
  const { t } = useT();
  const { data, isLoading, error } = useQuery({
    queryKey: ['practitioners'],
    queryFn: () =>
      api.get<PractitionerView[]>('/practitioners').then((r) => r.data),
    staleTime: 30_000,
  });
  return {
    practitioners: data ?? STABLE_EMPTY,
    isLoading,
    error: error ? t('settings.errors.loadPractitioners') : null,
  };
}
