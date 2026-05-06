import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ConsultationApi } from '@/features/consultation/hooks/useConsultation';

interface StartConsultationPayload {
  patientId: string;
  appointmentId?: string;
  motif?: string;
}

export function useStartConsultation() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: StartConsultationPayload) =>
      api.post<ConsultationApi>('/consultations', payload).then((r) => r.data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['queue'] });
      // B6 — refresh dossier patient tab badges (Consultations count++)
      void queryClient.invalidateQueries({
        queryKey: ['patient-tab-counts', variables.patientId],
      });
    },
  });

  return {
    startConsultation: (payload: StartConsultationPayload) => mutation.mutateAsync(payload),
    isPending: mutation.isPending,
    error: mutation.error ? 'Impossible de démarrer la consultation.' : null,
  };
}
