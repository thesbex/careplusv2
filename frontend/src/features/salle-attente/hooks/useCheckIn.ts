import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export function useCheckIn() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (appointmentId: string): Promise<void> => {
      await api.post(`/appointments/${appointmentId}/check-in`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['queue'] });
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  return {
    checkIn: (appointmentId: string) => mutation.mutateAsync(appointmentId),
    isPending: mutation.isPending,
    error: mutation.error ? 'Erreur lors de la déclaration d\'arrivée.' : null,
  };
}
