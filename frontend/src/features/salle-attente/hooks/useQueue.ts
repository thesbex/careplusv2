import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { QueueEntry, QueueKpi, UpcomingPatient } from '../types';

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
  practitionerName: string | null;
  durationMinutes: number | null;
  isPremium: boolean;
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

function adapt(e: QueueEntryApi): QueueEntry {
  const entry: QueueEntry = {
    appointmentId: e.appointmentId,
    patientId: e.patientId,
    name: e.patientFullName,
    apt: toHHMM(e.scheduledAt),
    arrived: toHHMM(e.arrivedAt),
    status: STATUS_MAP[e.status] ?? 'arrived',
    waited: toWaited(e.arrivedAt),
    room: '—',
    age: e.age ?? 0,
    reason: e.reasonLabel ?? '',
    practitionerName: e.practitionerName ?? null,
    durationMinutes: e.durationMinutes ?? null,
    isPremium: e.isPremium,
  };
  if (e.hasAllergies) entry.allergy = 'Allergie';
  return entry;
}

function buildKpis(queue: QueueEntryApi[]): QueueKpi[] {
  const total = queue.length;
  const waitMs = queue
    .filter((e) => e.arrivedAt)
    .map((e) => Date.now() - new Date(e.arrivedAt!).getTime());
  const avgMin = waitMs.length
    ? Math.round(waitMs.reduce((a, b) => a + b, 0) / waitMs.length / 60_000)
    : 0;
  return [
    { label: 'En attente', value: String(total), sub: 'patients aujourd\'hui' },
    { label: 'Attente moy.', value: String(avgMin), unit: 'min', sub: 'depuis arrivée' },
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
  const { data, isLoading, error } = useQuery({
    queryKey: ['queue'],
    queryFn: () => api.get<QueueEntryApi[]>('/queue').then((r) => r.data),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const raw = data ?? [];
  return {
    queue: raw.map(adapt),
    kpis: buildKpis(raw),
    upcoming: [],
    isLoading,
    error: error ? 'Impossible de charger la salle d\'attente.' : null,
  };
}
