/**
 * useQueue — waiting-room queue + KPIs.
 *
 * TODO(backend:J5): swap to TanStack Query hitting GET /api/queue with
 *   refetchInterval: 15_000 once the check-in + queue module ships.
 *   Shape is already close to the expected DTO so the swap will be structural only.
 *
 * Currently returns static fixtures synchronously (no network call).
 * Per ADR-021: frontend never races ahead of the backend; fixtures bridge the gap.
 */
import { KPIS, QUEUE, UPCOMING } from '../fixtures';
import type { QueueEntry, QueueKpi, UpcomingPatient } from '../types';

export interface UseQueueResult {
  queue: QueueEntry[];
  kpis: QueueKpi[];
  upcoming: UpcomingPatient[];
  isLoading: false;
  error: null;
}

export function useQueue(): UseQueueResult {
  return {
    queue: QUEUE,
    kpis: KPIS,
    upcoming: UPCOMING,
    isLoading: false,
    error: null,
  };
}
