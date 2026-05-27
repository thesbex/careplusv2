/**
 * Hooks CRUD des modèles de notification (ADMIN) + préférences patient.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type {
  NotificationTemplateView,
  NotificationTemplateWriteRequest,
  PatientNotificationPrefs,
} from '../types';

const TEMPLATES_QK = ['notification-templates'] as const;
const EMPTY: NotificationTemplateView[] = [];

export function useNotificationTemplates() {
  const { data, isLoading, error } = useQuery({
    queryKey: TEMPLATES_QK,
    queryFn: () =>
      api.get<NotificationTemplateView[]>('/notification-templates').then((r) => r.data),
    staleTime: 30_000,
  });
  return {
    templates: data ?? EMPTY,
    isLoading,
    error: error ? 'Impossible de charger les modèles de notification.' : null,
  };
}

export function useCreateNotificationTemplate() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (body: NotificationTemplateWriteRequest) =>
      api.post<NotificationTemplateView>('/notification-templates', body).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: TEMPLATES_QK }),
  });
  return { create: m.mutateAsync, isPending: m.isPending };
}

export function useUpdateNotificationTemplate() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, body }: { id: string; body: NotificationTemplateWriteRequest }) =>
      api.put<NotificationTemplateView>(`/notification-templates/${id}`, body).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: TEMPLATES_QK }),
  });
  return { update: m.mutateAsync, isPending: m.isPending };
}

export function useDeleteNotificationTemplate() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/notification-templates/${id}`).then(() => undefined),
    onSuccess: () => void qc.invalidateQueries({ queryKey: TEMPLATES_QK }),
  });
  return { remove: m.mutateAsync, isPending: m.isPending };
}

/** Préférences notification d'un patient (consentement + canal). */
export function usePatientNotificationPrefs(patientId: string | undefined) {
  const qc = useQueryClient();
  const qk = ['patient-notif-prefs', patientId] as const;
  const { data, isLoading } = useQuery({
    queryKey: qk,
    queryFn: () =>
      api
        .get<PatientNotificationPrefs>(`/patients/${patientId}/notification-preferences`)
        .then((r) => r.data),
    enabled: !!patientId,
    staleTime: 30_000,
  });
  const m = useMutation({
    mutationFn: (prefs: PatientNotificationPrefs) =>
      api
        .put<PatientNotificationPrefs>(`/patients/${patientId}/notification-preferences`, prefs)
        .then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk }),
  });
  return {
    prefs: data ?? null,
    isLoading,
    save: m.mutateAsync,
    isSaving: m.isPending,
  };
}
