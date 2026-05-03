/**
 * usePatientVitalsHistory — historique complet des constantes du patient.
 * Source : GET /patients/{id}/vitals (déjà ordonné DESC par recordedAt côté
 * backend). On retourne les enregistrements ordonnés ASC par date pour faciliter
 * le tracé des courbes d'évolution dans le temps.
 *
 * Les constantes sont attachées à une consultation (champ consultationId) ou
 * à un rendez-vous (appointmentId) — mais l'historique reste indexé par
 * patient pour permettre la vue d'évolution longitudinale du dossier.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { VitalsApi } from '@/features/consultation/hooks/useLatestVitals';

export function usePatientVitalsHistory(patientId?: string): {
  history: VitalsApi[];
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ['patient-vitals', patientId],
    queryFn: () => api.get<VitalsApi[]>(`/patients/${patientId}/vitals`).then((r) => r.data),
    enabled: !!patientId,
    staleTime: 30_000,
  });

  // Backend ordre DESC ; on inverse pour tracé chronologique gauche→droite.
  const history = data ? [...data].reverse() : [];
  return { history, isLoading };
}
