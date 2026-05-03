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

  return {
    vitals: data && data.length > 0 ? (data[0] ?? null) : null,
    isLoading,
  };
}
