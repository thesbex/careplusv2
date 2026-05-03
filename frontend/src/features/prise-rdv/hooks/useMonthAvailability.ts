import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';

interface SlotApi { startAt: string; }

export function useMonthAvailability(year: number, month: number, durationMinutes: number): {
  availableDates: Set<string>;
  isLoading: boolean;
} {
  const userId = useAuthStore((s) => s.user?.id);
  const from = new Date(year, month, 1, 0, 0, 0).toISOString();
  const to   = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['availability-month', userId, year, month, durationMinutes],
    queryFn: () =>
      api
        .get<SlotApi[]>(
          `/availability?practitionerId=${userId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&durationMinutes=${durationMinutes}`,
        )
        .then((r) => r.data),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });

  const availableDates = new Set<string>((data ?? []).map((s) => s.startAt.slice(0, 10)));
  return { availableDates, isLoading };
}
