import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import type { FinancialDashboardView } from '../types';

const ALLOWED_ROLES = ['MEDECIN', 'ADMIN'] as const;

/**
 * useDashboardFinancial — KPIs financiers (CA jour/mois/YTD, CA par acte,
 * impayés, taux d'encaissement). Réservé MEDECIN / ADMIN — la secrétaire et
 * l'assistant ne voient pas la section.
 *
 * GET /api/dashboard/financial
 *
 * Le hook désactive la requête pour les rôles non autorisés afin d'éviter
 * un 403 inutile et une fuite d'info dans le DevTools network.
 */
export function useDashboardFinancial(enabled = true) {
  const user = useAuthStore((s) => s.user);
  const hasRole = !!user && ALLOWED_ROLES.some((r) => user.roles.includes(r));

  const { data, isLoading, error, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard', 'financial'],
    queryFn: () =>
      api.get<FinancialDashboardView>('/dashboard/financial').then((r) => r.data),
    enabled: enabled && hasRole,
    staleTime: 60_000,
  });

  return {
    data: data ?? null,
    isLoading,
    isFetching,
    dataUpdatedAt,
    error: error ? 'Impossible de charger les indicateurs financiers.' : null,
    isEnabled: enabled && hasRole,
  };
}
