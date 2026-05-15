import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import type { SlotOption } from '../types';

interface SlotApi {
  startAt: string;
  endAt: string;
  durationMinutes: number;
}

function toHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toIsoDate(date: string): string {
  // Accept JJ/MM/AAAA or YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
    const [dd, mm, yyyy] = date.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return date;
}

export function useAvailability(
  date?: string,
  durationMinutes = 30,
  practitionerId?: string | null,
): {
  slots: SlotOption[];
  hintText: string;
  isLoading: boolean;
  error: string | null;
} {
  // Fall back to the logged-in user for medecin self-booking. Secrétaire flows
  // MUST pass the selected practitioner explicitly — see useMonthAvailability.
  const selfId = useAuthStore((s) => s.user?.id);
  const effectiveId = practitionerId ?? selfId;
  const isoDate = date ? toIsoDate(date) : undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ['availability', effectiveId, isoDate, durationMinutes],
    queryFn: () => {
      const from = new Date(`${isoDate}T00:00:00`).toISOString();
      const to = new Date(`${isoDate}T23:59:59`).toISOString();
      return api
        .get<SlotApi[]>(
          `/availability?practitionerId=${effectiveId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&durationMinutes=${durationMinutes}`,
        )
        .then((r) => r.data);
    },
    enabled: !!effectiveId && !!isoDate,
    staleTime: 60_000,
  });

  const slots: SlotOption[] = (data ?? []).map((s) => ({
    time: toHHMM(s.startAt),
    available: true,
  }));

  const count = slots.length;
  const hintText = count > 0
    ? `${count} créneau${count > 1 ? 'x' : ''} disponible${count > 1 ? 's' : ''}`
    : date ? 'Aucun créneau disponible' : 'Sélectionnez une date';

  return { slots, hintText, isLoading, error: error ? 'Créneaux indisponibles.' : null };
}
