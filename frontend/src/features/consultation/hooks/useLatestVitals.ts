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

export function useLatestVitals(patientId?: string): {
  vitals: VitalsApi | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ['patient-vitals', patientId],
    queryFn: () => api.get<VitalsApi[]>(`/patients/${patientId}/vitals`).then((r) => r.data),
    enabled: !!patientId,
    staleTime: 30_000,
  });

  // Le backend renvoie l'historique complet (toutes consultations confondues),
  // déjà ordonné DESC par recordedAt. On retourne le dernier enregistrement
  // qui contient *au moins* une mesure : ainsi un patient avec des constantes
  // d'une consultation antérieure les verra dans la nouvelle, et d'éventuels
  // records pollués (tous champs null, créés avant le pré-remplissage) sont
  // ignorés sans casser l'audit trail.
  const vitals = data?.find(hasAnyMeasurement) ?? null;

  return { vitals, isLoading };
}
