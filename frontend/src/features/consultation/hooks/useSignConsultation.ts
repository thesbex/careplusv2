import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';
import type { ConsultationApi } from './useConsultation';

export function useSignConsultation(id?: string) {
  const queryClient = useQueryClient();
  const { t } = useT();

  const mutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('consultation id required');
      return api.post<ConsultationApi>(`/consultations/${id}/sign`).then((r) => r.data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['consultation', id], data);
      void queryClient.invalidateQueries({ queryKey: ['queue'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  async function sign(): Promise<boolean> {
    if (!id) return false;
    try {
      await mutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  }

  return {
    sign,
    isSigning: mutation.isPending,
    signed: mutation.isSuccess,
    error: mutation.error ? t('consult.signRefused') : null,
  };
}
