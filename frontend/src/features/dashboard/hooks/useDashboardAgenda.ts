import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import type { AgendaDashboardView } from '../types';

/**
 * useDashboardAgenda — KPIs agenda (RDV jour/semaine, taux remplissage, charge
 * horaire). Visible par tous les rôles authentifiés (la secrétaire en a besoin
 * pour piloter la prise de rendez-vous).
 *
 * GET /api/dashboard/agenda
 *
 * staleTime 30 s : l'agenda bouge plus vite que les KPIs cliniques/financiers.
 */
export function useDashboardAgenda(enabled = true) {
  const user = useAuthStore((s) => s.user);
  const isAuthed = !!user;

  const { data, isLoading, error, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard', 'agenda'],
    queryFn: () =>
      api.get<AgendaDashboardView>('/dashboard/agenda').then((r) => r.data),
    enabled: enabled && isAuthed,
    staleTime: 30_000,
  });

  return {
    data: data ?? null,
    isLoading,
    isFetching,
    dataUpdatedAt,
    error: error ? "Impossible de charger les indicateurs d'agenda." : null,
    isEnabled: enabled && isAuthed,
  };
}
