import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface AppointmentApi {
  id: string;
  patientId: string;
  practitionerId: string;
  startAt: string;
  endAt: string;
  status: string;
  type: string | null;
  reasonLabel: string | null;
  originConsultationId: string | null;
  arrivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useAppointment(id?: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => api.get<AppointmentApi>(`/appointments/${id}`).then((r) => r.data),
    enabled: !!id,
    staleTime: 30_000,
  });

  return {
    appointment: data ?? null,
    isLoading,
    error: error ? 'Impossible de charger le RDV.' : null,
  };
}
