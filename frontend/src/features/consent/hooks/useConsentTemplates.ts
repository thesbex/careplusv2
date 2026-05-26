/**
 * QA9-13 — Hooks pour les modèles de consentement (gestion ADMIN) et la
 * génération d'un consentement depuis le dossier patient.
 *
 * Endpoints (base axios = /api) :
 *   GET    /consent-templates
 *   POST   /consent-templates                  (ADMIN)
 *   PUT    /consent-templates/{id}             (ADMIN)
 *   DELETE /consent-templates/{id}             (ADMIN, soft-delete)
 *   POST   /patients/{patientId}/consents      (MEDECIN + ADMIN)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type {
  ConsentTemplateView,
  ConsentTemplateWriteRequest,
  ConsentGenerateRequest,
  ConsentGenerateResponse,
} from '../types';

const TEMPLATES_QK = ['consent-templates'] as const;

/** GET /consent-templates — MEDECIN ne voit que les actifs, ADMIN voit tout. */
export function useConsentTemplates() {
  const { data, isLoading, error } = useQuery({
    queryKey: TEMPLATES_QK,
    queryFn: () =>
      api.get<ConsentTemplateView[]>('/consent-templates').then((r) => r.data),
    staleTime: 30_000,
  });
  return {
    templates: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger les modèles de consentement.' : null,
  };
}

export function useCreateConsentTemplate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: ConsentTemplateWriteRequest) =>
      api.post<ConsentTemplateView>('/consent-templates', body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TEMPLATES_QK });
    },
  });
  return { create: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useUpdateConsentTemplate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ConsentTemplateWriteRequest }) =>
      api.put<ConsentTemplateView>(`/consent-templates/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TEMPLATES_QK });
    },
  });
  return { update: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useDeleteConsentTemplate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => api.delete(`/consent-templates/${id}`).then(() => undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TEMPLATES_QK });
    },
  });
  return { remove: mutation.mutateAsync, isPending: mutation.isPending };
}

/**
 * POST /patients/{patientId}/consents — génère le PDF du consentement et le
 * rattache au dossier patient (document type CONSENTEMENT). Renvoie le
 * documentId pour permettre le téléchargement immédiat.
 */
export function useGenerateConsent(patientId: string) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: ConsentGenerateRequest) =>
      api
        .post<ConsentGenerateResponse>(`/patients/${patientId}/consents`, body)
        .then((r) => r.data),
    onSuccess: () => {
      // Le PDF généré apparaît sous l'onglet Documents (type CONSENTEMENT).
      void qc.invalidateQueries({ queryKey: ['patient-documents', patientId] });
      void qc.invalidateQueries({ queryKey: ['patient-tab-counts', patientId] });
    },
  });
  return { generate: mutation.mutateAsync, isPending: mutation.isPending };
}
