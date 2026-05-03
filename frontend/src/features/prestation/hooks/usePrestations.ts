/**
 * Hooks prestations — catalogue + lien consultation (V016).
 *
 * Endpoints :
 *   GET  /api/catalog/prestations
 *   GET  /api/consultations/{id}/prestations
 *   POST /api/consultations/{id}/prestations
 *   DELETE /api/consultations/{id}/prestations/{linkId}
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { AddPrestationPayload, ConsultationPrestationApi, PrestationApi } from '../types';

export function usePrestationCatalog(includeInactive = false) {
  const query = useQuery({
    queryKey: ['catalog', 'prestations', { includeInactive }],
    queryFn: async () => {
      const res = await api.get<PrestationApi[]>('/catalog/prestations', {
        params: { includeInactive },
      });
      return res.data;
    },
    staleTime: 60_000,
  });
  return {
    prestations: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useConsultationPrestations(consultationId: string | undefined) {
  const query = useQuery({
    queryKey: ['consultation-prestations', consultationId],
    queryFn: async () => {
      const res = await api.get<ConsultationPrestationApi[]>(
        `/consultations/${consultationId}/prestations`,
      );
      return res.data;
    },
    enabled: !!consultationId,
  });
  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useAddPrestation(consultationId: string | undefined) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (payload: AddPrestationPayload): Promise<ConsultationPrestationApi> => {
      const res = await api.post<ConsultationPrestationApi>(
        `/consultations/${consultationId}/prestations`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['consultation-prestations', consultationId] });
    },
  });
  return { add: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useRemovePrestation(consultationId: string | undefined) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (linkId: string): Promise<void> => {
      await api.delete(`/consultations/${consultationId}/prestations/${linkId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['consultation-prestations', consultationId] });
    },
  });
  return { remove: mutation.mutateAsync, isPending: mutation.isPending };
}
