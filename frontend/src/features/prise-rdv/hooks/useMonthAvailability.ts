import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';

interface SlotApi { startAt: string; }

export function useMonthAvailability(
  year: number,
  month: number,
  durationMinutes: number,
  practitionerId?: string | null,
): {
  availableDates: Set<string>;
  isLoading: boolean;
} {
  // Fall back to the logged-in user for backward-compatibility when no explicit
  // practitioner is passed (medecin self-booking). When a secrétaire opens the
  // dialog, the caller MUST pass the selected practitioner explicitly —
  // otherwise the query asks for the secrétaire's own slots and returns none.
  const selfId = useAuthStore((s) => s.user?.id);
  const effectiveId = practitionerId ?? selfId;
  const from = new Date(year, month, 1, 0, 0, 0).toISOString();
  const to   = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['availability-month', effectiveId, year, month, durationMinutes],
    queryFn: () =>
      api
        .get<SlotApi[]>(
          `/availability?practitionerId=${effectiveId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&durationMinutes=${durationMinutes}`,
        )
        .then((r) => r.data),
    enabled: !!effectiveId,
    staleTime: 5 * 60_000,
  });

  const availableDates = new Set<string>((data ?? []).map((s) => s.startAt.slice(0, 10)));
  return { availableDates, isLoading };
}
