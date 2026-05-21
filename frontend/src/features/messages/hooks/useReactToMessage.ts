import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export function useReactToMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { messageId: string; emoji: string; toggleOff?: boolean }) => {
      if (args.toggleOff) {
        await api.delete(`/chat/messages/${args.messageId}/reactions/${encodeURIComponent(args.emoji)}`);
      } else {
        await api.post(`/chat/messages/${args.messageId}/reactions`, { emoji: args.emoji });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat'] }),
  });
}
