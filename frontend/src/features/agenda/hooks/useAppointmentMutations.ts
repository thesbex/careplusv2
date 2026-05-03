import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '@/lib/api/client';

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['appointments'] });
  void qc.invalidateQueries({ queryKey: ['queue'] });
}

interface MovePayload {
  id: string;
  startAt: string; // ISO
  durationMinutes: number;
}

export function useMoveAppointment() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({ id, startAt, durationMinutes }: MovePayload): Promise<void> => {
      await api.put(`/appointments/${id}`, { startAt, durationMinutes });
    },
    onSuccess: () => invalidate(qc),
  });

  return {
    moveAppointment: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

interface CancelPayload {
  id: string;
  reason: string;
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({ id, reason }: CancelPayload): Promise<void> => {
      await api.delete(`/appointments/${id}`, { data: { reason } });
    },
    onSuccess: () => invalidate(qc),
  });

  return {
    cancelAppointment: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

export function extractConflictMessage(err: unknown): string | null {
  if (err instanceof AxiosError && err.response?.status === 409) {
    const data = err.response.data as { detail?: string; title?: string; message?: string };
    return data.detail ?? data.message ?? data.title ?? 'Conflit horaire détecté.';
  }
  return null;
}
