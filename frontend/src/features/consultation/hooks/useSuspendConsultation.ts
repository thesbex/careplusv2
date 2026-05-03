import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ConsultationApi } from './useConsultation';

export function useSuspendConsultation(id?: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('consultation id required');
      return api.post<ConsultationApi>(`/consultations/${id}/suspend`).then((r) => r.data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['consultation', id], data);
      void queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });

  async function suspend(): Promise<boolean> {
    if (!id) return false;
    try {
      await mutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  }

  return {
    suspend,
    isSuspending: mutation.isPending,
  };
}
