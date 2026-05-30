import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';

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
  const { t } = useT();
  const { data, isLoading, error } = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => api.get<AppointmentApi>(`/appointments/${id}`).then((r) => r.data),
    enabled: !!id,
    staleTime: 30_000,
  });

  return {
    appointment: data ?? null,
    isLoading,
    error: error ? t('vitals.loadAppointmentError') : null,
  };
}
