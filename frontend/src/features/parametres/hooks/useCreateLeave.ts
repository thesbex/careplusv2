import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import type { Leave } from '../types';

export interface CreateLeavePayload {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason?: string;
}

/**
 * Crée un congé pour le praticien indiqué (ou le user connecté si omis).
 * Multi-praticien : un secrétaire peut planifier un congé pour un médecin
 * tiers via le selector du tab Congés.
 */
export function useCreateLeave(practitionerId?: string) {
  const queryClient = useQueryClient();
  const fallbackUserId = useAuthStore((s) => s.user?.id);
  const targetId = practitionerId ?? fallbackUserId;

  const mutation = useMutation({
    mutationFn: (payload: CreateLeavePayload) =>
      api
        .post<Leave>(`/practitioners/${targetId}/leaves`, payload)
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leaves', targetId] });
      void queryClient.invalidateQueries({ queryKey: ['availability-month'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
  });

  return {
    createLeave: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error
      ? (mutation.error as { response?: { data?: { message?: string } } })
          .response?.data?.message ?? 'Erreur lors de la création du congé.'
      : null,
  };
}
