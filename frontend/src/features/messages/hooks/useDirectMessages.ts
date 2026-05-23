import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ApiDirectMessage } from '../api-types';
import type { DirectMessage } from '../types';

export function useDirectMessages() {
  return useQuery({
    queryKey: ['chat', 'dms'],
    queryFn: () =>
      api.get<ApiDirectMessage[]>('/chat/direct-messages').then((r) =>
        r.data.map<DirectMessage>((d) => ({
          id: d.id,
          contact: {
            id: d.contact.id,
            name: d.contact.name,
            role: d.contact.role,
            initials: d.contact.initials,
            color: d.contact.color,
            online: d.contact.presence,
            hasPhoto: d.contact.hasPhoto ?? false,
          },
          last: d.last,
          time: d.time,
          unread: d.unread,
          mentions: d.mentions,
        })),
      ),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
