import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import type { Leave } from '../types';

/**
 * Liste les congés d'un praticien. Sans argument, utilise le médecin connecté
 * (cas /parametres/conges = "mes congés"). Avec un id explicite, utilisé par
 * l'agenda en mode multi-praticien pour rendre l'overlay congé du médecin
 * actuellement filtré (les secrétaires en mode "Tous les médecins" ne voient
 * pas d'overlay — agréger n'aurait pas de sens visuel).
 */
export function useLeaves(practitionerId?: string): { leaves: Leave[]; isLoading: boolean; error: string | null } {
  const fallbackUserId = useAuthStore((s) => s.user?.id);
  const targetId = practitionerId ?? fallbackUserId;

  const { data, isLoading, error } = useQuery({
    queryKey: ['leaves', targetId],
    queryFn: () =>
      api
        .get<Leave[]>(`/practitioners/${targetId}/leaves`)
        .then((r) => r.data),
    enabled: !!targetId,
    staleTime: 60_000,
  });

  return {
    leaves: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger les congés.' : null,
  };
}
