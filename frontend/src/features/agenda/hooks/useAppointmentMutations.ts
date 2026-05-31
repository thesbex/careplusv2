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
  /** Optional new practitioner id (multi-doctor support, Wave 1). */
  practitionerId?: string;
  /** Optional room reassignment. `null` clears the room; undefined leaves it untouched. */
  roomId?: string | null;
}

interface MoveResponse {
  id: string;
  practitionerId?: string;
  roomId?: string | null;
}

export function useMoveAppointment() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({
      id,
      startAt,
      durationMinutes,
      practitionerId,
      roomId,
    }: MovePayload): Promise<MoveResponse> => {
      const body: Record<string, unknown> = {
        startAt,
        durationMinutes,
        ...(practitionerId !== undefined ? { practitionerId } : {}),
        // null is meaningful (clear the room); undefined leaves it untouched.
        ...(roomId !== undefined ? { roomId } : {}),
      };
      const res = await api.put<MoveResponse>(`/appointments/${id}`, body);
      return res.data;
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

/**
 * Surface a backend-provided 409 conflict message (server text, not
 * translated here). Returns `null` when there is no conflict OR the 409 body
 * carries no message — callers then fall back to their own translated toast
 * (e.g. `t('agenda.toast.moveErr')`), so no French is hardcoded here.
 */
export function extractConflictMessage(err: unknown): string | null {
  if (err instanceof AxiosError && err.response?.status === 409) {
    const data = err.response.data as { detail?: string; title?: string; message?: string };
    return data.detail ?? data.message ?? data.title ?? null;
  }
  return null;
}
