import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ApiChannel } from '../api-types';
import type { Channel } from '../types';

/**
 * GET /api/chat/channels — canaux thématiques du cabinet (auto-join à la 1re lecture).
 * Mapping iso à `Channel` côté UI : noms identiques, pas de transformation.
 */
export function useChannels() {
  return useQuery({
    queryKey: ['chat', 'channels'],
    queryFn: () =>
      api.get<ApiChannel[]>('/chat/channels').then((r) =>
        r.data.map<Channel>((c) => ({
          id: c.id,
          name: c.name,
          sub: c.sub,
          unread: c.unread,
          mentions: c.mentions,
          members: c.members,
        })),
      ),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
