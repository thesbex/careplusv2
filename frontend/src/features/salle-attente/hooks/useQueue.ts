import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';
import type { QueueEntry, QueueKpi, UpcomingPatient } from '../types';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

interface QueueEntryApi {
  appointmentId: string;
  patientId: string;
  patientFullName: string;
  scheduledAt: string;
  status: string;
  arrivedAt: string | null;
  hasAllergies: boolean;
  age: number | null;
  reasonLabel: string | null;
  practitionerId: string | null;
  practitionerName: string | null;
  durationMinutes: number | null;
  isPremium: boolean;
  roomId: string | null;
  roomName: string | null;
}

const STATUS_MAP: Record<string, QueueEntry['status']> = {
  ARRIVE: 'arrived',
  CONSTANTES_PRISES: 'vitals',
  EN_CONSULTATION: 'consult',
  TERMINE: 'done',
};

function toHHMM(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' });
}

function toWaited(arrivedAt: string | null): string {
  if (!arrivedAt) return '—';
  const ms = Date.now() - new Date(arrivedAt).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}min`;
}

function adapt(e: QueueEntryApi, t: Translate): QueueEntry {
  const entry: QueueEntry = {
    appointmentId: e.appointmentId,
    patientId: e.patientId,
    name: e.patientFullName,
    apt: toHHMM(e.scheduledAt),
    arrived: toHHMM(e.arrivedAt),
    status: STATUS_MAP[e.status] ?? 'arrived',
    waited: toWaited(e.arrivedAt),
    room: e.roomName ?? '—',
    roomId: e.roomId ?? null,
    roomName: e.roomName ?? null,
    age: e.age ?? 0,
    reason: e.reasonLabel ?? '',
    practitionerId: e.practitionerId ?? null,
    practitionerName: e.practitionerName ?? null,
    durationMinutes: e.durationMinutes ?? null,
    isPremium: e.isPremium,
  };
  if (e.hasAllergies) entry.allergy = t('salle.allergy');
  return entry;
}

function buildKpis(queue: QueueEntryApi[], t: Translate): QueueKpi[] {
  const total = queue.length;
  const waitMs = queue
    .filter((e) => e.arrivedAt)
    .map((e) => Date.now() - new Date(e.arrivedAt!).getTime());
  const avgMin = waitMs.length
    ? Math.round(waitMs.reduce((a, b) => a + b, 0) / waitMs.length / 60_000)
    : 0;
  return [
    { label: t('salle.kpi.waiting'), value: String(total), sub: t('salle.kpi.waitingSub') },
    {
      label: t('salle.kpi.avgWait'),
      value: String(avgMin),
      unit: t('salle.kpi.min'),
      sub: t('salle.kpi.avgWaitSub'),
    },
  ];
}

export interface UseQueueResult {
  queue: QueueEntry[];
  kpis: QueueKpi[];
  upcoming: UpcomingPatient[];
  isLoading: boolean;
  error: string | null;
}

export function useQueue(): UseQueueResult {
  const { t } = useT();
  const { data, isLoading, error } = useQuery({
    queryKey: ['queue'],
    queryFn: () => api.get<QueueEntryApi[]>('/queue').then((r) => r.data),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const raw = data ?? [];
  return {
    queue: raw.map((e) => adapt(e, t)),
    kpis: buildKpis(raw, t),
    upcoming: [],
    isLoading,
    error: error ? t('salle.loadError') : null,
  };
}
