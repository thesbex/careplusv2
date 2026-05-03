import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Cancel an appointment via DELETE /api/appointments/{id}.
 * Used by the salle d'attente when a patient who has been checked in
 * cancels their visit (empêchement) — the staff retires them from the list.
 */
export function useCancelAppointment() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (args: { appointmentId: string; reason?: string }): Promise<void> => {
      await api.delete(`/appointments/${args.appointmentId}`, {
        data: args.reason ? { reason: args.reason } : undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['queue'] });
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['day-appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['upcoming-today'] });
    },
  });

  return {
    cancel: (appointmentId: string, reason?: string) =>
      mutation.mutateAsync(
        reason === undefined ? { appointmentId } : { appointmentId, reason },
      ),
    isPending: mutation.isPending,
    error: mutation.error ? "Erreur lors de l'annulation du RDV." : null,
  };
}
