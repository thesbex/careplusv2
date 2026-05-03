/**
 * Patient search as-you-type hook.
 *
 * TODO(backend:J3): the patient endpoint exists (aaf5242) — wiring deferred
 * until J4 when the full RDV flow is wired end-to-end. Swap this mock for a
 * TanStack Query hitting GET /api/patients?q=<query> with debounce.
 *
 * For now returns the prototype fixture candidates when query is non-empty.
 */
import { PATIENT_SUGGESTIONS } from '../fixtures';
import type { PatientCandidate } from '../types';

export function usePatientSearch(query: string): {
  candidates: PatientCandidate[];
  isLoading: false;
  error: null;
} {
  // Simulate filtering: return all fixtures when there is a query, empty otherwise.
  const candidates = query.trim().length > 0 ? PATIENT_SUGGESTIONS : [];
  return {
    candidates,
    isLoading: false,
    error: null,
  };
}
