/**
 * R052 + R053 — chargement des motifs (cf. /api/reasons) avec leur couleur
 * pour piloter le filtre et la teinte des blocs RDV de l'agenda.
 *
 * Hook séparé de `features/prise-rdv/hooks/useReasons` parce que le picker
 * RDV n'a besoin que de (id, label) ; on évite d'élargir son schéma zod
 * (et les tests qui en dépendent). Même endpoint, même cache.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface ReasonForAgenda {
  id: string;
  code: string;
  label: string;
  durationMinutes: number;
  colorHex: string;
}

export function useReasonsForAgenda(): {
  reasons: ReasonForAgenda[];
  byId: Record<string, ReasonForAgenda>;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ['reasons'],
    queryFn: () => api.get<ReasonForAgenda[]>('/reasons').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  const reasons = data ?? [];
  const byId: Record<string, ReasonForAgenda> = {};
  for (const r of reasons) byId[r.id] = r;
  return { reasons, byId, isLoading };
}
