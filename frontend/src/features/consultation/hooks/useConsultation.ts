import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { CONSULTATION_PATIENT, CONSULTATION_SESSION } from '../fixtures';
import type { ConsultationPatient, ConsultationSession } from '../types';

interface ConsultationApi {
  id: string;
  patientId: string;
  practitionerId: string;
  appointmentId: string;
  versionNumber: number;
  status: string;
  motif: string | null;
  examination: string | null;
  diagnosis: string | null;
  notes: string | null;
  startedAt: string;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function adapt(c: ConsultationApi): ConsultationSession {
  const startedAt = new Date(c.startedAt);
  const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 60_000);

  return {
    ...CONSULTATION_SESSION,
    patientName: CONSULTATION_SESSION.patientName,
    startedAt: startedAt.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' }),
    timer: `${elapsed} min`,
    status: c.status === 'SIGNEE' ? 'Signée' : 'Brouillon',
    autoSavedAt: new Date(c.updatedAt).toLocaleTimeString('fr-MA', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    soap: {
      subjectif: c.motif ?? '',
      objectif: c.examination ?? '',
      analyse: c.diagnosis ?? '',
      plan: c.notes ?? '',
    },
  };
}

export function useConsultation(id?: string): {
  patient: ConsultationPatient;
  session: ConsultationSession;
  isLoading: boolean;
  error: string | null;
  updateDraft: (data: Partial<ConsultationApi>) => Promise<void>;
} {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['consultation', id],
    queryFn: () => api.get<ConsultationApi>(`/consultations/${id}`).then((r) => r.data),
    enabled: !!id,
    staleTime: 10_000,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<ConsultationApi>) =>
      api.put<ConsultationApi>(`/consultations/${id}`, updates).then((r) => r.data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['consultation', id], updated);
    },
  });

  async function updateDraft(updates: Partial<ConsultationApi>): Promise<void> {
    if (!id) return;
    await updateMutation.mutateAsync(updates);
  }

  return {
    patient: CONSULTATION_PATIENT,
    session: data ? adapt(data) : CONSULTATION_SESSION,
    isLoading,
    error: error ? 'Impossible de charger la consultation.' : null,
    updateDraft,
  };
}
