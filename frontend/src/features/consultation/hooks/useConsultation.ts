import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';

export interface ConsultationApi {
  id: string;
  patientId: string;
  practitionerId: string;
  appointmentId: string | null;
  versionNumber: number;
  status: 'BROUILLON' | 'SUSPENDUE' | 'SIGNEE' | 'AMENDEE';
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
  const { t } = useT();

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
    error: error ? t('consult.loadError') : null,
    update,
    isSaving: updateMutation.isPending,
    saveError: updateMutation.error ? t('common.saveError') : null,
    lastSavedAt: data ? new Date(data.updatedAt) : null,
  };
}
