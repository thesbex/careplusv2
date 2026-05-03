import { APPOINTMENTS, ARRIVALS, WEEK_DAYS } from '../fixtures';
import type { Appointment, Arrival, WeekDay } from '../types';

/**
 * Appointments for a given week + current arrivals.
 *
 * TODO(backend:J4): replace with TanStack Query hooks hitting
 *   GET /api/appointments?from=<mondayISO>&to=<sundayISO>
 *   GET /api/queue (for arrivals)
 * and derive loading/error states from them. For now returns static fixtures
 * synchronously — matches the prototype exactly, per ADR-021 (never race ahead
 * of backend). Shape is already close to the expected DTO so the swap is
 * structural only.
 */
export function useWeekAppointments(): {
  days: WeekDay[];
  appointments: Appointment[];
  arrivals: Arrival[];
  isLoading: false;
  error: null;
} {
  return {
    days: WEEK_DAYS,
    appointments: APPOINTMENTS,
    arrivals: ARRIVALS,
    isLoading: false,
    error: null,
  };
}
