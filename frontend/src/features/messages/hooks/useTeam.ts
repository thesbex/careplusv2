import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ApiTeamMember } from '../api-types';
import type { TeamMember } from '../types';

/**
 * Tous les utilisateurs actifs du cabinet avec présence. v1 : tout user actif → 'on',
 * le caller → 'self'. Pas de heartbeat (à ajouter en v2 via `identity_user.last_seen_at`).
 */
export function useTeam() {
  return useQuery({
    queryKey: ['chat', 'team'],
    queryFn: () =>
      api.get<ApiTeamMember[]>('/chat/team').then((r) =>
        r.data.map<TeamMember>((m) => ({
          id: m.id,
          name: m.name,
          role: m.role,
          initials: m.initials,
          color: m.color,
          online: m.presence,
          hasPhoto: m.hasPhoto ?? false,
        })),
      ),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}
