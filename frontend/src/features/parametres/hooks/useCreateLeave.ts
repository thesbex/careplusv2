import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import type { Leave } from '../types';

export interface CreateLeavePayload {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason?: string;
}

export function useCreateLeave() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  const mutation = useMutation({
    mutationFn: (payload: CreateLeavePayload) =>
      api
        .post<Leave>(`/practitioners/${userId}/leaves`, payload)
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leaves', userId] });
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
