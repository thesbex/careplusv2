import { PATIENT_MOHAMED_ALAMI } from '../fixtures';
import type { PatientSummary } from '../types';

/**
 * Returns patient data for a given patient id.
 *
 * TODO(backend:J3): replace with TanStack Query hook hitting
 *   GET /api/patients/:id
 * and derive loading/error states from the query. For now returns static
 * fixture synchronously — matches the prototype exactly, per ADR-021
 * (never race ahead of backend). Shape is already close to the expected DTO
 * so the swap will be structural only.
 */
export function usePatient(_id?: string): {
  patient: PatientSummary;
  isLoading: false;
  error: null;
} {
  return {
    patient: PATIENT_MOHAMED_ALAMI,
    isLoading: false,
    error: null,
  };
}
