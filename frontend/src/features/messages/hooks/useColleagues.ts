import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface Colleague {
  id: string;
  fullName: string;
  role: string | null;
}

/**
 * Collègues actifs hors caller — picker "Nouveau DM".
 * Endpoint dédié `GET /api/chat/colleagues` (pas /admin/users qui est ADMIN-only).
 */
export function useColleagues(enabled = true) {
  return useQuery({
    queryKey: ['chat', 'colleagues'],
    queryFn: () => api.get<Colleague[]>('/chat/colleagues').then((r) => r.data),
    enabled,
    staleTime: 60_000,
  });
}
