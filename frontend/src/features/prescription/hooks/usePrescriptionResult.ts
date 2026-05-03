/**
 * Attache / détache un résultat (PDF, image) à une ligne de prescription
 * LAB ou IMAGING (V015).
 *
 * Endpoints :
 *   PUT    /api/prescriptions/lines/{lineId}/result   (multipart : file)
 *   DELETE /api/prescriptions/lines/{lineId}/result
 *
 * Invalidation cache : on invalide les listes de prescription par
 * patient ET par consultation pour que la ligne se re-render avec
 * son `resultDocumentId` mis à jour sans avoir besoin de rafraîchir
 * la page.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { AxiosError } from 'axios';

interface AttachPayload {
  lineId: string;
  file: File;
}

export function useAttachPrescriptionResult() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ lineId, file }: AttachPayload): Promise<{ id: string }> => {
      const form = new FormData();
      form.append('file', file);
      const res = await api.put<{ id: string }>(
        `/prescriptions/lines/${lineId}/result`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
  });

  return {
    attach: (payload: AttachPayload) => mutation.mutateAsync(payload),
    isPending: mutation.isPending,
    error: mutation.error as AxiosError | null,
  };
}

export function useDetachPrescriptionResult() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (lineId: string): Promise<void> => {
      await api.delete(`/prescriptions/lines/${lineId}/result`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    },
  });

  return {
    detach: (lineId: string) => mutation.mutateAsync(lineId),
    isPending: mutation.isPending,
    error: mutation.error as AxiosError | null,
  };
}
