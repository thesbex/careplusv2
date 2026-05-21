import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ApiConversation } from '../api-types';

/**
 * Démarre (ou récupère) une conversation DM 1-1 avec un autre user.
 * Backend : `POST /api/chat/direct-messages` idempotent.
 */
export function useStartDm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (otherUserId: string) =>
      api.post<ApiConversation>('/chat/direct-messages', { otherUserId }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'dms'] });
    },
  });
}
