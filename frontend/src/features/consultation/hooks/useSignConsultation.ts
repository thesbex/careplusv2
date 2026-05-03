import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export function useSignConsultation() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/consultations/${id}/sign`).then((r) => r.data),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ['consultation', id] });
      void queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });

  function sign(id?: string) {
    if (!id) return;
    mutation.mutate(id);
  }

  return {
    sign,
    isSigning: mutation.isPending,
    signed: mutation.isSuccess,
  };
}
