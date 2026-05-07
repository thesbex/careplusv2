/**
 * useRooms — read-only fetch of active clinic rooms.
 * Backed by GET /api/rooms (Wave 1, commit e3a7a76).
 *
 * Endpoint contract (Wave 1):
 *  - GET /api/rooms              → active rooms only (default)
 *  - GET /api/rooms?includeInactive=true → admin-only (paramètres)
 *
 * The agenda + drawer always want the active subset; admin screens that
 * need inactive rooms call the endpoint directly (lane belongs to the
 * other agent on Paramètres).
 *
 * Caching:
 *  - 5 min staleTime (rooms move rarely; admin CRUD invalidates via the
 *    paramètres screen).
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface RoomView {
  id: string;
  name: string;
  capabilityTags: string[];
  active: boolean;
}

export function useRooms(): {
  data: RoomView[];
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get<RoomView[]>('/rooms').then((r) => r.data),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    data: data ?? [],
    isLoading,
    isError,
  };
}
