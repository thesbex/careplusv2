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
    // Fire-and-forget invalidation. We *do not* await — the previous attempt
    // to await Promise.all([...]) made the mutation hang whenever any of the
    // 5 invalidated queries took >1s to refetch (slow network, large queue).
    // The button stayed on "Enregistrement…" and the navigate('/salle') that
    // follows the await never fired. With refetchType: 'all' the next page
    // gets fresh data on mount even for queries that weren't active here.
    onSuccess: () => {
      const keys = [
        ['queue'],         // salle d'attente — status pill flips to CONSTANTES_PRISES
        ['appointments'],  // agenda timeline pill
        ['patient-vitals'],// consultation TA banner (useLatestVitals)
        ['patient'],       // dossier patient header "Dernières constantes"
        ['appointment'],   // PriseConstantes own appointment query
      ] as const;
      for (const queryKey of keys) {
        void queryClient.invalidateQueries({
          queryKey,
          refetchType: 'all',
        });
      }
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
