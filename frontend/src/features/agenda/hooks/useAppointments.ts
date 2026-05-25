import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import { usePractitioners } from './usePractitioners';
import { WEEK_DAYS as FIXTURE_DAYS } from '../fixtures';
import type { Appointment, Arrival, WeekDay, DayKey, AppointmentStatus } from '../types';

export interface AppointmentApi {
  id: string;
  patientId: string;
  patientFullName: string | null;
  practitionerId?: string;
  reasonId?: string | null;
  reasonLabel: string | null;
  startAt: string;
  endAt: string;
  status: string;
  roomId?: string | null;
  roomName?: string | null;
}

/**
 * Special sentinel — "view ALL practitioners' agendas merged together".
 * Resolved into a fan-out of N parallel /appointments?practitionerId=…
 * calls (one per active practitioner) by useWeekAppointments because the
 * Wave 1 backend requires a single practitionerId per request.
 */
export const ALL_PRACTITIONERS = 'ALL' as const;
export type PractitionerIdFilter = string | typeof ALL_PRACTITIONERS;

const DAY_KEYS: DayKey[] = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

const STATUS_MAP: Record<string, AppointmentStatus> = {
  PLANIFIE: 'confirmed',
  CONFIRME: 'confirmed',
  ARRIVE: 'arrived',
  EN_ATTENTE_CONSTANTES: 'arrived',
  CONSTANTES_PRISES: 'vitals',
  EN_CONSULTATION: 'consult',
  TERMINE: 'done',
  CLOS: 'done',
};

const MONTH_FR = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];

function weekWindow(offset = 0): { from: string; to: string; days: WeekDay[]; weekLabel: string; todayKey: DayKey | null } {
  const now = new Date();
  const dow = now.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon + offset * 7);
  monday.setHours(0, 0, 0, 0);

  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const days: WeekDay[] = DAY_KEYS.map((key, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { key, label: FIXTURE_DAYS[i]?.label ?? key, date: String(d.getDate()) };
  });

  const monMonth = MONTH_FR[monday.getMonth()] ?? '';
  const satMonth = MONTH_FR[saturday.getMonth()] ?? '';
  const weekLabel = monday.getMonth() === saturday.getMonth()
    ? `${monday.getDate()} – ${saturday.getDate()} ${monMonth} ${monday.getFullYear()}`
    : `${monday.getDate()} ${monMonth} – ${saturday.getDate()} ${satMonth} ${monday.getFullYear()}`;

  const todayDow = now.getDay();
  const todayKey: DayKey | null = todayDow === 0 ? null : (DAY_KEYS[todayDow - 1] ?? null);
  const isCurrentWeek = offset === 0;

  return { from: monday.toISOString(), to: sunday.toISOString(), days, weekLabel, todayKey: isCurrentWeek ? todayKey : null };
}

function adapt(a: AppointmentApi, days: WeekDay[]): Appointment {
  const start = new Date(a.startAt);
  const end = new Date(a.endAt);
  const dow = start.getDay(); // 0=Sun,1=Mon…
  const dayIndex = dow === 0 ? 6 : dow - 1; // Mon=0…Sat=5
  const key = DAY_KEYS[dayIndex] ?? 'lun';
  const hh = String(start.getHours()).padStart(2, '0');
  const mm = String(start.getMinutes()).padStart(2, '0');
  const dur = Math.round((end.getTime() - start.getTime()) / 60_000);

  void days; // days array used for WeekDay shape above

  return {
    id: a.id,
    patientId: a.patientId,
    startAt: a.startAt,
    durationMinutes: dur,
    day: key,
    start: `${hh}:${mm}`,
    dur,
    patient: a.patientFullName ?? '—',
    reason: a.reasonLabel ?? '—',
    status: STATUS_MAP[a.status] ?? 'confirmed',
    rawStatus: a.status,
    ...(a.practitionerId ? { practitionerId: a.practitionerId } : {}),
    ...(a.reasonId ? { reasonId: a.reasonId } : {}),
    ...(a.roomId ? { roomId: a.roomId } : {}),
    ...(a.roomName ? { roomName: a.roomName } : {}),
  };
}

interface UseWeekAppointmentsOptions {
  /**
   * - undefined → behave as before: fetch the connected user's own week
   *   (auto-fill from authStore). Backward-compat with all existing
   *   callers that just pass a weekOffset.
   * - "ALL"     → fan out and merge across every active practitioner.
   * - <UUID>    → filter to that specific practitioner.
   */
  practitionerIdFilter?: PractitionerIdFilter;
}

export function useWeekAppointments(
  weekOffset: number = 0,
  options: UseWeekAppointmentsOptions = {},
): {
  days: WeekDay[];
  appointments: Appointment[];
  rawAppointments: AppointmentApi[];
  arrivals: Arrival[];
  weekLabel: string;
  todayKey: DayKey | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const userId = useAuthStore((s) => s.user?.id);
  const { from, to, days, weekLabel, todayKey } = weekWindow(weekOffset);
  const { practitionerIdFilter } = options;

  // Resolve the effective filter: explicit option wins, else fall back to
  // the connected user (legacy behaviour every other caller relies on).
  const effectiveFilter: PractitionerIdFilter | undefined =
    practitionerIdFilter ?? userId ?? undefined;

  // ── ALL mode ──────────────────────────────────────────────────────
  // The Wave 1 backend requires a single practitionerId per request. We
  // fan out one query per active practitioner and merge. Practitioners
  // are tiny (≤ a handful in v1), so the cost is bounded.
  const { data: practitioners } = usePractitioners();
  const allMode = effectiveFilter === ALL_PRACTITIONERS;

  const fanOutQueries = useQueries({
    queries: allMode
      ? practitioners.map((p) => ({
          queryKey: ['appointments', p.id, from] as const,
          queryFn: () =>
            api
              .get<AppointmentApi[]>(
                `/appointments?practitionerId=${p.id}&from=${encodeURIComponent(
                  from,
                )}&to=${encodeURIComponent(to)}`,
              )
              .then((r) => r.data),
          staleTime: 60_000,
        }))
      : [],
  });

  // ── Single-practitioner mode ─────────────────────────────────────
  const singlePractitionerId =
    !allMode && typeof effectiveFilter === 'string' ? effectiveFilter : null;

  const single = useQuery({
    queryKey: ['appointments', singlePractitionerId, from],
    queryFn: () =>
      api
        .get<AppointmentApi[]>(
          `/appointments?practitionerId=${singlePractitionerId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        )
        .then((r) => r.data),
    enabled: !!singlePractitionerId,
    staleTime: 60_000,
  });

  const merged: AppointmentApi[] = allMode
    ? fanOutQueries.flatMap((q) => q.data ?? [])
    : (single.data ?? []);

  const isLoading = allMode
    ? fanOutQueries.some((q) => q.isLoading)
    : single.isLoading;

  const error = allMode
    ? fanOutQueries.some((q) => q.error)
    : !!single.error;

  function refetchAll(): void {
    if (allMode) {
      fanOutQueries.forEach((q) => {
        void q.refetch();
      });
    } else {
      void single.refetch();
    }
  }

  return {
    days,
    appointments: merged.map((a) => adapt(a, days)),
    rawAppointments: merged,
    arrivals: [],
    weekLabel,
    todayKey,
    isLoading,
    error: error ? "Impossible de charger l'agenda." : null,
    refetch: refetchAll,
  };
}

/**
 * Fetches all appointments for a given calendar month (1st 00:00 → next month
 * 1st 00:00). Used by the agenda month view.
 *
 * Honours the same practitioner filter as {@link useWeekAppointments} :
 * - undefined → connected user's own month (legacy default).
 * - "ALL"     → fan out and merge across every active practitioner.
 * - <UUID>    → that specific practitioner only.
 *
 * Without this the month view always queried `practitionerId=<connected user>`,
 * which returned 0 for non-MEDECIN roles (a secretary isn't a practitioner)
 * and ignored the toolbar selector for everyone else.
 */
export function useMonthAppointments(
  year: number,
  month: number,
  options: UseWeekAppointmentsOptions = {},
): {
  appointments: AppointmentApi[];
  isLoading: boolean;
} {
  const userId = useAuthStore((s) => s.user?.id);
  const from = new Date(year, month, 1).toISOString();
  const to = new Date(year, month + 1, 1).toISOString();
  const { practitionerIdFilter } = options;

  const effectiveFilter: PractitionerIdFilter | undefined =
    practitionerIdFilter ?? userId ?? undefined;

  const { data: practitioners } = usePractitioners();
  const allMode = effectiveFilter === ALL_PRACTITIONERS;

  const fanOutQueries = useQueries({
    queries: allMode
      ? practitioners.map((p) => ({
          queryKey: ['appointments-month', p.id, from] as const,
          queryFn: () =>
            api
              .get<AppointmentApi[]>(
                `/appointments?practitionerId=${p.id}&from=${encodeURIComponent(
                  from,
                )}&to=${encodeURIComponent(to)}`,
              )
              .then((r) => r.data),
          staleTime: 60_000,
        }))
      : [],
  });

  const singlePractitionerId =
    !allMode && typeof effectiveFilter === 'string' ? effectiveFilter : null;

  const single = useQuery({
    queryKey: ['appointments-month', singlePractitionerId, from],
    queryFn: () =>
      api
        .get<AppointmentApi[]>(
          `/appointments?practitionerId=${singlePractitionerId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        )
        .then((r) => r.data),
    enabled: !!singlePractitionerId,
    staleTime: 60_000,
  });

  const appointments: AppointmentApi[] = allMode
    ? fanOutQueries.flatMap((q) => q.data ?? [])
    : (single.data ?? []);

  const isLoading = allMode
    ? fanOutQueries.some((q) => q.isLoading)
    : single.isLoading;

  return { appointments, isLoading };
}
