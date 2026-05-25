import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Marque une conversation comme lue (POST /chat/conversations/{id}/mark-read,
 * upsert dans chat_read_state.last_read_at = now()).
 *
 * Bug R0xx : le badge "Messages" ne se décrémentait pas car ce endpoint
 * n'était jamais appelé à l'ouverture d'une conversation. On invalide ici le
 * compteur non-lu + les listes (DM/canaux/threads) qui portent un compteur
 * par conversation, pour que la décrémentation soit immédiate.
 */
export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      api.post(`/chat/conversations/${conversationId}/mark-read`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chat', 'unread-count'] });
      void qc.invalidateQueries({ queryKey: ['chat', 'dms'] });
      void qc.invalidateQueries({ queryKey: ['chat', 'channels'] });
      void qc.invalidateQueries({ queryKey: ['chat', 'patient-threads'] });
    },
  });
}
