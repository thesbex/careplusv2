import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';

interface CheckInArgs {
  appointmentId: string;
  /** Optional room reassignment at arrival. When omitted, the room booked at
   *  scheduling stays. Pass `null` to clear the room. */
  roomId?: string | null;
}

export function useCheckIn() {
  const { t } = useT();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (args: CheckInArgs): Promise<void> => {
      const body = args.roomId !== undefined ? { roomId: args.roomId } : undefined;
      await api.post(`/appointments/${args.appointmentId}/check-in`, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['queue'] });
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  return {
    /**
     * Backward-compatible signature. Pass either an appointment id (legacy) or
     * an object `{ appointmentId, roomId? }` to reassign the salle on arrival.
     */
    checkIn: (input: string | CheckInArgs) => {
      const args: CheckInArgs =
        typeof input === 'string' ? { appointmentId: input } : input;
      return mutation.mutateAsync(args);
    },
    isPending: mutation.isPending,
    error: mutation.error ? t('salle.toast.checkInErr') : null,
  };
}
