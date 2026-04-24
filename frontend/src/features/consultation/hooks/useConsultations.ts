import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ConsultationApi } from './useConsultation';

interface ListParams {
  practitionerId?: string;
  patientId?: string;
  from?: string;
  to?: string;
}

export function useConsultations(params: ListParams = {}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['consultations', params],
    queryFn: () =>
      api.get<ConsultationApi[]>('/consultations', { params }).then((r) => r.data),
    staleTime: 10_000,
  });

  return {
    consultations: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger les consultations.' : null,
    refetch,
  };
}
