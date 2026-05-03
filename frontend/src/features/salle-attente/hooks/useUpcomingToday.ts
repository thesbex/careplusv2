import { useWeekAppointments } from '@/features/agenda/hooks/useAppointments';

export interface UpcomingTodayEntry {
  appointmentId: string;
  patientId: string;
  patientName: string;
  /** "HH:MM" — scheduled time. */
  time: string;
  /** Human-readable ETA, e.g. "dans 23 min" or "à 14:00". */
  eta: string;
  /** Visit reason / motif, may be empty string. */
  reason: string;
}

const RAW_NOT_ARRIVED = new Set(['PLANIFIE', 'CONFIRME']);

function fmtHHMM(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-MA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function fmtEta(iso: string): string {
  const start = new Date(iso);
  const diffMs = start.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 0) return `en retard ${Math.abs(diffMin)} min`;
  if (diffMin < 60) return `dans ${diffMin} min`;
  return `à ${fmtHHMM(iso)}`;
}

/**
 * Today's not-yet-arrived appointments. Derived from the agenda hook so we
 * don't open a second backend query — the same payload feeds /agenda mobile.
 *
 * The /queue endpoint only returns patients who are physically present, hence
 * the need for this complementary source on the salle d'attente screen.
 */
export function useUpcomingToday(): {
  upcoming: UpcomingTodayEntry[];
  isLoading: boolean;
  error: string | null;
} {
  const { rawAppointments, isLoading, error } = useWeekAppointments(0);
  const today = new Date();
  const yyyymmdd = today.toISOString().slice(0, 10);

  const upcoming = rawAppointments
    .filter((a) => {
      if (!RAW_NOT_ARRIVED.has(a.status)) return false;
      // Only TODAY (compare ISO date prefix in local time).
      const day = new Date(a.startAt);
      const localIso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      return localIso === yyyymmdd;
    })
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .map<UpcomingTodayEntry>((a) => ({
      appointmentId: a.id,
      patientId: a.patientId,
      patientName: a.patientFullName ?? '—',
      time: fmtHHMM(a.startAt),
      eta: fmtEta(a.startAt),
      reason: a.reasonLabel ?? '',
    }));

  return { upcoming, isLoading, error };
}
