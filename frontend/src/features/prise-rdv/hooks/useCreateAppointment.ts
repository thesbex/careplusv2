import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';

export interface CreateAppointmentPayload {
  patientId: string;
  date: string;
  time: string;
  durationMin: number;
  reasonId: string | null;
  notes?: string;
}

function toIso(date: string, time: string): string {
  const [dd, mm, yyyy] = date.split('/');
  return new Date(`${yyyy}-${mm}-${dd}T${time}:00`).toISOString();
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  const mutation = useMutation({
    mutationFn: (payload: CreateAppointmentPayload) =>
      api
        .post<{ id: string }>('/appointments', {
          patientId: payload.patientId,
          practitionerId: userId,
          reasonId: payload.reasonId ?? undefined,
          startAt: toIso(payload.date, payload.time),
          durationMinutes: payload.durationMin,
          notes: payload.notes || undefined,
        })
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  return {
    createAppointment: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error
      ? (mutation.error as { response?: { data?: { message?: string } } })
          .response?.data?.message ?? 'Erreur lors de la création du RDV.'
      : null,
  };
}
