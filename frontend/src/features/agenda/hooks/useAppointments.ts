import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import { WEEK_DAYS as FIXTURE_DAYS } from '../fixtures';
import type { Appointment, Arrival, WeekDay, DayKey, AppointmentStatus } from '../types';

interface AppointmentApi {
  id: string;
  patientFullName: string | null;
  reasonLabel: string | null;
  startAt: string;
  endAt: string;
  status: string;
}

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
    day: key,
    start: `${hh}:${mm}`,
    dur,
    patient: a.patientFullName ?? '—',
    reason: a.reasonLabel ?? '—',
    status: STATUS_MAP[a.status] ?? 'confirmed',
  };
}

export function useWeekAppointments(weekOffset = 0): {
  days: WeekDay[];
  appointments: Appointment[];
  arrivals: Arrival[];
  weekLabel: string;
  todayKey: DayKey | null;
  isLoading: boolean;
  error: string | null;
} {
  const userId = useAuthStore((s) => s.user?.id);
  const { from, to, days, weekLabel, todayKey } = weekWindow(weekOffset);

  const { data, isLoading, error } = useQuery({
    queryKey: ['appointments', userId, from],
    queryFn: () =>
      api
        .get<AppointmentApi[]>(
          `/appointments?practitionerId=${userId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        )
        .then((r) => r.data),
    enabled: !!userId,
    staleTime: 60_000,
  });

  return {
    days,
    appointments: (data ?? []).map((a) => adapt(a, days)),
    arrivals: [],
    weekLabel,
    todayKey,
    isLoading,
    error: error ? 'Impossible de charger l\'agenda.' : null,
  };
}
