import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface VitalsApi {
  id: string;
  patientId: string;
  appointmentId: string | null;
  consultationId: string | null;
  systolicMmhg: number | null;
  diastolicMmhg: number | null;
  temperatureC: number | null;
  weightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  heartRateBpm: number | null;
  spo2Percent: number | null;
  glycemiaGPerL: number | null;
  recordedAt: string;
  recordedBy: string | null;
  notes: string | null;
}

/** True dès qu'une mesure clinique au moins est renseignée. */
function hasAnyMeasurement(v: VitalsApi): boolean {
  return (
    v.systolicMmhg != null ||
    v.diastolicMmhg != null ||
    v.heartRateBpm != null ||
    v.spo2Percent != null ||
    v.temperatureC != null ||
    v.weightKg != null ||
    v.heightCm != null ||
    v.glycemiaGPerL != null
  );
}

/**
 * Constantes de LA consultation en cours uniquement (pas l'historique du
 * patient). Comportement médicalement correct : chaque visite a ses propres
 * constantes — celles d'il y a deux semaines ne sont pas "actuelles". Si
 * aucune mesure n'a encore été prise pour cette consultation, retourne null
 * (le médecin saisit alors un bilan neuf, dialog vide).
 *
 * L'historique longitudinal reste consultable dans le dossier patient
 * (onglet "Constantes") — il agrège toutes les visites pour les courbes.
 */
export function useLatestVitals(
  patientId?: string,
  consultationId?: string,
): {
  vitals: VitalsApi | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ['patient-vitals', patientId],
    queryFn: () => api.get<VitalsApi[]>(`/patients/${patientId}/vitals`).then((r) => r.data),
    enabled: !!patientId,
    staleTime: 30_000,
  });

  // Filtre par consultation courante quand l'ID est connu — sinon on retombe
  // sur "dernière mesure non vide du patient" (utilisé hors contexte de
  // consultation, ex. salle d'attente ou badge dossier).
  const scoped = consultationId
    ? data?.filter((v) => v.consultationId === consultationId)
    : data;
  const vitals = scoped?.find(hasAnyMeasurement) ?? null;

  return { vitals, isLoading };
}
