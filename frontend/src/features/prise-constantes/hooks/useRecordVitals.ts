import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';
import type { UseRecordVitalsResult } from '../types';
import type { VitalsFormValues } from '../schema';

export function useRecordVitals(appointmentId?: string): UseRecordVitalsResult {
  const queryClient = useQueryClient();
  const { t } = useT();

  const mutation = useMutation({
    mutationFn: (values: VitalsFormValues) =>
      // B1 fix (2026-05-06) : envoyer aussi respiratoryRateBpm,
      // abdominalPerimeterCm et headCircumferenceCm. Avant le fix, ces 3
      // champs étaient présents dans le form mais silencieusement omis du
      // POST → données perdues à la persistance et invisibles au read.
      api.post(`/appointments/${appointmentId}/vitals`, {
        systolicMmhg: values.tensionSys ?? null,
        diastolicMmhg: values.tensionDia ?? null,
        heartRateBpm: values.pulse ?? null,
        respiratoryRateBpm: values.respRate ?? null,
        spo2Percent: values.spo2 ?? null,
        temperatureC: values.tempC ?? null,
        weightKg: values.weightKg ?? null,
        heightCm: values.heightCm ?? null,
        glycemiaGPerL: values.glycemia ?? null,
        abdominalPerimeterCm: values.abdominalCm ?? null,
        headCircumferenceCm: values.headCircumferenceCm ?? null,
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
    error: mutation.error ? t('vitals.recordError') : null,
  };
}
