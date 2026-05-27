/**
 * Modèles de courrier confrère — hooks de gestion (ADMIN) + lecture (MEDECIN).
 *
 * Miroir du module modèles de consentement (useConsentTemplates) :
 *   GET    /confrere-letter-templates           MEDECIN ne voit que les actifs, ADMIN voit tout
 *   POST   /confrere-letter-templates            (ADMIN)
 *   PUT    /confrere-letter-templates/{id}       (ADMIN)
 *   DELETE /confrere-letter-templates/{id}       (ADMIN, soft-delete)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { LetterTemplateView, LetterTemplateWriteRequest } from '../types';

const TEMPLATES_QK = ['confrere-letter-templates'] as const;
const EMPTY: LetterTemplateView[] = [];

/** GET /confrere-letter-templates — MEDECIN ne voit que les actifs, ADMIN voit tout. */
export function useLetterTemplates() {
  const { data, isLoading, error } = useQuery({
    queryKey: TEMPLATES_QK,
    queryFn: () =>
      api.get<LetterTemplateView[]>('/confrere-letter-templates').then((r) => r.data),
    staleTime: 30_000,
  });
  return {
    templates: data ?? EMPTY,
    isLoading,
    error: error ? 'Impossible de charger les modèles de courrier.' : null,
  };
}

export function useCreateLetterTemplate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: LetterTemplateWriteRequest) =>
      api.post<LetterTemplateView>('/confrere-letter-templates', body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TEMPLATES_QK });
    },
  });
  return { create: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useUpdateLetterTemplate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: LetterTemplateWriteRequest }) =>
      api.put<LetterTemplateView>(`/confrere-letter-templates/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TEMPLATES_QK });
    },
  });
  return { update: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useDeleteLetterTemplate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/confrere-letter-templates/${id}`).then(() => undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TEMPLATES_QK });
    },
  });
  return { remove: mutation.mutateAsync, isPending: mutation.isPending };
}
