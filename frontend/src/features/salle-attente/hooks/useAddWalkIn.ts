import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * useAddWalkIn (QA9-12) — add a patient who showed up without an appointment
 * directly to the waiting room.
 *
 * Two-step backend dance:
 *   1. POST /appointments with `walkIn:true` + `urgency:true` so the slot-conflict
 *      guard is bypassed (a walk-in lands on "now" regardless of the agenda).
 *   2. POST /appointments/{id}/check-in to flip it to ARRIVE and surface it in
 *      the /queue.
 * Then invalidate the queue so the new patient appears in the right column.
 *
 * `startAt` is a full timestamp (now), so `toISOString()` is correct here — the
 * date-only ISO pitfall (timezone shift) only applies to `<input type=date>`.
 */
export interface AddWalkInArgs {
  patientId: string;
  practitionerId: string;
  reasonId?: string;
  roomId?: string;
}

export function useAddWalkIn() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (args: AddWalkInArgs): Promise<{ id: string }> => {
      const body: Record<string, unknown> = {
        walkIn: true,
        urgency: true,
        patientId: args.patientId,
        practitionerId: args.practitionerId,
        startAt: new Date().toISOString(),
        durationMinutes: 30,
        ...(args.reasonId ? { reasonId: args.reasonId } : {}),
        ...(args.roomId ? { roomId: args.roomId } : {}),
      };
      const created = await api
        .post<{ id: string }>('/appointments', body)
        .then((r) => r.data);

      const checkInBody = args.roomId ? { roomId: args.roomId } : undefined;
      await api.post(`/appointments/${created.id}/check-in`, checkInBody);
      return created;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['queue'] });
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  return {
    addWalkIn: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error
      ? (mutation.error as { response?: { data?: { detail?: string; message?: string } } })
          .response?.data?.detail ??
        (mutation.error as { response?: { data?: { message?: string } } })
          .response?.data?.message ??
        "Impossible d'ajouter le patient à la salle."
      : null,
  };
}
