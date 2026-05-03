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
      void queryClient.invalidateQueries({ queryKey: ['queue'] });
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
