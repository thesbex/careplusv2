import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ReasonOption } from '../types';

interface ReasonApi {
  id: string;
  code: string;
  label: string;
  durationMinutes: number;
  colorHex: string;
}

export function useReasons(): {
  reasons: ReasonOption[];
  isLoading: boolean;
  error: string | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reasons'],
    queryFn: () => api.get<ReasonApi[]>('/reasons').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  return {
    reasons: (data ?? []).map((r) => ({ id: r.id, label: r.label })),
    isLoading,
    error: error ? 'Impossible de charger les motifs.' : null,
  };
}
