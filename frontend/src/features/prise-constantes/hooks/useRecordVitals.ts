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
    onSuccess: () => {
      // Invalidate every cache that surfaces vitals so the new measurement is
      // visible without a manual refresh: salle d'attente queue, agenda
      // appointments (status flips to CONSTANTES_PRISES), the dossier patient
      // header that shows "Dernières constantes", and the consultation page
      // that pulls them via useLatestVitals.
      void queryClient.invalidateQueries({ queryKey: ['queue'] });
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['patient-vitals'] });
      void queryClient.invalidateQueries({ queryKey: ['patient'] });
      void queryClient.invalidateQueries({ queryKey: ['appointment'] });
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
