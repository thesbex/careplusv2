import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { UseRecordVitalsResult } from '../types';
import type { VitalsFormValues } from '../schema';

export function useRecordVitals(appointmentId?: string): UseRecordVitalsResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (values: VitalsFormValues) =>
      api.post(`/appointments/${appointmentId}/vitals`, {
        systolicMmhg: values.tensionSys,
        diastolicMmhg: values.tensionDia,
        heartRateBpm: values.pulse,
        spo2Percent: values.spo2,
        temperatureC: values.tempC,
        weightKg: values.weightKg,
        heightCm: values.heightCm,
        glycemiaGPerL: values.glycemia ?? null,
        notes: values.notes ?? null,
      }),
    // Awaiting the invalidation chain inside onSuccess defers the mutation's
    // mutateAsync resolution until the refetches are in-flight, so the page
    // we navigate to after submit (typically /salle) lands with fresh data
    // instead of a "stale flash + late refetch" cycle.
    onSuccess: async () => {
      await Promise.all([
        // Salle d'attente queue (status pill flips to CONSTANTES_PRISES).
        queryClient.invalidateQueries({ queryKey: ['queue'] }),
        // Agenda — status pill on the timeline.
        queryClient.invalidateQueries({ queryKey: ['appointments'] }),
        // Consultation page TA banner (useLatestVitals).
        queryClient.invalidateQueries({ queryKey: ['patient-vitals'] }),
        // Dossier patient header "Dernières constantes".
        queryClient.invalidateQueries({ queryKey: ['patient'] }),
        // PriseConstantes page itself (useAppointment).
        queryClient.invalidateQueries({ queryKey: ['appointment'] }),
      ]);
    },
  });

  async function submit(values: VitalsFormValues): Promise<void> {
    await mutation.mutateAsync(values);
  }

  return {
    submit,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error ? 'Erreur lors de l\'enregistrement. Réessayez.' : null,
  };
}
