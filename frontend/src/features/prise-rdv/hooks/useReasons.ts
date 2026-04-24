/**
 * Consultation reason options.
 *
 * TODO(backend:J4): replace with TanStack Query hitting GET /api/reasons
 * and derive loading/error states. For now returns static fixtures
 * synchronously — matches the prototype exactly per ADR-021.
 */
import { REASON_OPTIONS } from '../fixtures';
import type { ReasonOption } from '../types';

export function useReasons(): {
  reasons: ReasonOption[];
  isLoading: false;
  error: null;
} {
  return {
    reasons: REASON_OPTIONS,
    isLoading: false,
    error: null,
  };
}
