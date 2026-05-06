import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import type { ClinicalDashboardView } from '../types';

const ALLOWED_ROLES = ['MEDECIN', 'ADMIN'] as const;

/**
 * useDashboardClinical — KPIs cliniques (patientèle, activité, top pathologies).
 *
 * GET /api/dashboard/clinical
 * Visibilité backend : MEDECIN, ADMIN. Le hook désactive automatiquement la
 * requête côté front pour les autres rôles (économie réseau + évite un 403
 * bruyant). L'écran cache la section côté layout également.
 *
 * staleTime 60 s, pas de refetch automatique : le dashboard est consulté
 * ponctuellement, pas comme une worklist live.
 */
export function useDashboardClinical(enabled = true) {
  const user = useAuthStore((s) => s.user);
  const hasRole = !!user && ALLOWED_ROLES.some((r) => user.roles.includes(r));

  const { data, isLoading, error, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard', 'clinical'],
    queryFn: () =>
      api.get<ClinicalDashboardView>('/dashboard/clinical').then((r) => r.data),
    enabled: enabled && hasRole,
    staleTime: 60_000,
  });

  return {
    data: data ?? null,
    isLoading,
    isFetching,
    dataUpdatedAt,
    error: error ? 'Impossible de charger les indicateurs cliniques.' : null,
    isEnabled: enabled && hasRole,
  };
}
