/**
 * Available time slots for a given date.
 *
 * TODO(backend:J4): replace with TanStack Query hitting
 *   GET /api/availability?date=<YYYY-MM-DD>
 * and derive loading/error states. For now returns static fixtures
 * synchronously — matches the prototype exactly per ADR-021.
 */
import { MOBILE_SLOTS, AVAILABLE_SLOTS_HINT } from '../fixtures';
import type { SlotOption } from '../types';

export function useAvailability(_date?: string): {
  slots: SlotOption[];
  hintText: string;
  isLoading: false;
  error: null;
} {
  return {
    slots: MOBILE_SLOTS,
    hintText: AVAILABLE_SLOTS_HINT,
    isLoading: false,
    error: null,
  };
}
