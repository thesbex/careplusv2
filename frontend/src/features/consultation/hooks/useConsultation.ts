/**
 * Hook for reading and autosaving a consultation draft.
 *
 * Currently returns static fixture data synchronously.
 * TODO(backend:J5): replace with:
 *   useQuery({ queryKey: ['consultation', id], queryFn: () => api.get(`/api/consultations/${id}`) })
 *   useMutation({ mutationFn: (data) => api.put(`/api/consultations/${id}`, data) }) for autosave
 */
import { CONSULTATION_PATIENT, CONSULTATION_SESSION } from '../fixtures';
import type { ConsultationPatient, ConsultationSession } from '../types';

export function useConsultation(_id?: string): {
  patient: ConsultationPatient;
  session: ConsultationSession;
  isLoading: false;
  error: null;
} {
  return {
    patient: CONSULTATION_PATIENT,
    session: CONSULTATION_SESSION,
    isLoading: false,
    error: null,
  };
}
