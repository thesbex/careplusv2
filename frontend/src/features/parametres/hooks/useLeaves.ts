import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import type { Leave } from '../types';

export function useLeaves(): { leaves: Leave[]; isLoading: boolean; error: string | null } {
  const userId = useAuthStore((s) => s.user?.id);

  const { data, isLoading, error } = useQuery({
    queryKey: ['leaves', userId],
    queryFn: () =>
      api
        .get<Leave[]>(`/practitioners/${userId}/leaves`)
        .then((r) => r.data),
    enabled: !!userId,
    staleTime: 60_000,
  });

  return {
    leaves: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger les congés.' : null,
  };
}
