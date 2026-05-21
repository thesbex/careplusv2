import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ApiMessage } from '../api-types';

interface SendArgs {
  conversationId: string;
  body: string;
  mentionedUserIds?: string[];
  patientId?: string | null;
  parentMessageId?: string | null;
  urgent?: boolean;
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, body, mentionedUserIds, patientId, parentMessageId, urgent }: SendArgs) =>
      api
        .post<ApiMessage>(`/chat/conversations/${conversationId}/messages`, {
          body,
          mentionedUserIds: mentionedUserIds ?? [],
          patientId: patientId ?? null,
          parentMessageId: parentMessageId ?? null,
          urgent: urgent ?? false,
        })
        .then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['chat', 'conversation', vars.conversationId] });
      qc.invalidateQueries({ queryKey: ['chat', 'channels'] });
      qc.invalidateQueries({ queryKey: ['chat', 'dms'] });
      qc.invalidateQueries({ queryKey: ['chat', 'patient-threads'] });
      qc.invalidateQueries({ queryKey: ['chat', 'unread-count'] });
    },
  });
}
