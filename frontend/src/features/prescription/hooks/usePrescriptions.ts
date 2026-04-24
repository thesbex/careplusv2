import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { PrescriptionApi } from '../types';

export function usePrescriptions(consultationId?: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['prescriptions', consultationId],
    queryFn: () =>
      api
        .get<PrescriptionApi[]>(`/consultations/${consultationId}/prescriptions`)
        .then((r) => r.data),
    enabled: !!consultationId,
    staleTime: 10_000,
  });

  return {
    prescriptions: data ?? [],
    isLoading,
  };
}

export function usePrescription(id?: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['prescription', id],
    queryFn: () =>
      api.get<PrescriptionApi>(`/prescriptions/${id}`).then((r) => r.data),
    enabled: !!id,
    staleTime: 10_000,
  });

  return {
    prescription: data ?? null,
    isLoading,
    error: error ? 'Impossible de charger la prescription.' : null,
  };
}
