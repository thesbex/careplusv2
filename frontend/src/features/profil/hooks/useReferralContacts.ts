/**
 * V046 — CRUD du carnet personnel de confrères du médecin connecté.
 *
 * Endpoints :
 *   GET    /api/me/referrals
 *   POST   /api/me/referrals
 *   PUT    /api/me/referrals/{id}
 *   DELETE /api/me/referrals/{id}
 *
 * Backend scope chaque requête à l'`Authentication` — pas besoin de passer
 * un ownerId côté client.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { AxiosError } from 'axios';

export interface ReferralContact {
  id: string;
  fullName: string;
  specialty: string;
  phone: string | null;
  city: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralContactInput {
  fullName: string;
  specialty: string;
  phone?: string;
  city?: string;
  notes?: string;
}

const QUERY_KEY = ['me-referrals'] as const;
const EMPTY: ReferralContact[] = [];

export function useReferralContacts() {
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.get<ReferralContact[]>('/me/referrals').then((r) => r.data),
    staleTime: 60_000,
  });
  return {
    contacts: data ?? EMPTY,
    isLoading,
    error: error ? 'Impossible de charger le carnet de confrères.' : null,
  };
}

export function useCreateReferralContact() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: ReferralContactInput) =>
      api.post<ReferralContact>('/me/referrals', input).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
  return {
    create: (input: ReferralContactInput) => mutation.mutateAsync(input),
    isPending: mutation.isPending,
    error: mutation.error as AxiosError | null,
  };
}

export function useUpdateReferralContact() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReferralContactInput }) =>
      api.put<ReferralContact>(`/me/referrals/${id}`, input).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
  return {
    update: (id: string, input: ReferralContactInput) =>
      mutation.mutateAsync({ id, input }),
    isPending: mutation.isPending,
    error: mutation.error as AxiosError | null,
  };
}

export function useDeleteReferralContact() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => api.delete(`/me/referrals/${id}`).then(() => undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
  return {
    remove: (id: string) => mutation.mutateAsync(id),
    isPending: mutation.isPending,
    error: mutation.error as AxiosError | null,
  };
}
