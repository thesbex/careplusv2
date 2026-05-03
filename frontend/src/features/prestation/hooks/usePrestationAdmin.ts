/**
 * Hooks admin du catalogue prestations (V016).
 *
 * RBAC backend : POST/PUT/DELETE limités à MEDECIN/ADMIN. Le composant
 * UI peut aussi cacher la page selon la permission PRESTATION_ADMIN
 * (ligne automatique dans la matrice RBAC).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { PrestationApi } from '../types';

export interface PrestationFormPayload {
  code: string;
  label: string;
  defaultPrice: number;
  active?: boolean;
  sortOrder?: number;
}

export function useCreatePrestation() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (payload: PrestationFormPayload): Promise<PrestationApi> => {
      const res = await api.post<PrestationApi>('/catalog/prestations', payload);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['catalog', 'prestations'] });
    },
  });
  return { create: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useUpdatePrestation() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: PrestationFormPayload }): Promise<PrestationApi> => {
      const res = await api.put<PrestationApi>(`/catalog/prestations/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['catalog', 'prestations'] });
    },
  });
  return { update: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useDeactivatePrestation() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/catalog/prestations/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['catalog', 'prestations'] });
    },
  });
  return { deactivate: mutation.mutateAsync, isPending: mutation.isPending };
}
