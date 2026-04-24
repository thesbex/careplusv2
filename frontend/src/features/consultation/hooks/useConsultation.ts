import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface ConsultationApi {
  id: string;
  patientId: string;
  practitionerId: string;
  appointmentId: string | null;
  versionNumber: number;
  status: 'BROUILLON' | 'SIGNEE';
  motif: string | null;
  examination: string | null;
  diagnosis: string | null;
  notes: string | null;
  startedAt: string;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateConsultationPayload {
  motif?: string;
  examination?: string;
  diagnosis?: string;
  notes?: string;
}

export interface UseConsultationResult {
  consultation: ConsultationApi | null;
  isLoading: boolean;
  error: string | null;
  update: (payload: UpdateConsultationPayload) => Promise<ConsultationApi>;
  isSaving: boolean;
  saveError: string | null;
  lastSavedAt: Date | null;
}

export function useConsultation(id?: string): UseConsultationResult {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['consultation', id],
    queryFn: () => api.get<ConsultationApi>(`/consultations/${id}`).then((r) => r.data),
    enabled: !!id,
    staleTime: 10_000,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateConsultationPayload) =>
      api.put<ConsultationApi>(`/consultations/${id}`, payload).then((r) => r.data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['consultation', id], updated);
    },
  });

  async function update(payload: UpdateConsultationPayload): Promise<ConsultationApi> {
    if (!id) throw new Error('consultation id required');
    return updateMutation.mutateAsync(payload);
  }

  return {
    consultation: data ?? null,
    isLoading,
    error: error ? 'Impossible de charger la consultation.' : null,
    update,
    isSaving: updateMutation.isPending,
    saveError: updateMutation.error ? 'Échec de la sauvegarde.' : null,
    lastSavedAt: data ? new Date(data.updatedAt) : null,
  };
}
