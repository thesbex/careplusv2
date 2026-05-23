/**
 * useSendAttachment — V053.
 *
 * Envoie un message avec une pièce jointe via le endpoint multipart
 * `POST /api/chat/conversations/{id}/attachments`. Invalide le cache de la
 * conversation à l'envoi.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export function useSendAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      file,
      body,
    }: {
      conversationId: string;
      file: File;
      body?: string;
    }) => {
      const fd = new FormData();
      fd.append('file', file);
      if (body && body.trim()) fd.append('body', body.trim());
      const res = await api.post(
        `/chat/conversations/${conversationId}/attachments`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return res.data;
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['chat', 'conversation', vars.conversationId] });
      void qc.invalidateQueries({ queryKey: ['chat', 'dms'] });
      void qc.invalidateQueries({ queryKey: ['chat', 'unread-count'] });
    },
  });
}
