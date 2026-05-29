/**
 * Modèles de consultation SOAP, privés au médecin (V068).
 *   GET/POST/PUT/DELETE /api/soap-templates
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface SoapTemplate {
  id: string;
  name: string;
  subjectif: string | null;
  objectif: string | null;
  analyse: string | null;
  plan: string | null;
  updatedAt: string;
}

export interface SoapTemplateWriteRequest {
  name: string;
  subjectif?: string | null;
  objectif?: string | null;
  analyse?: string | null;
  plan?: string | null;
}

export function useSoapTemplates() {
  const query = useQuery({
    queryKey: ['soap-templates'],
    queryFn: () => api.get<SoapTemplate[]>('/soap-templates').then((r) => r.data),
    staleTime: 60_000,
  });
  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? 'Impossible de charger les modèles de consultation.' : null,
  };
}

export function useCreateSoapTemplate() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (body: SoapTemplateWriteRequest) =>
      api.post<SoapTemplate>('/soap-templates', body).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['soap-templates'] }),
  });
  return { create: m.mutateAsync, isPending: m.isPending };
}

export function useUpdateSoapTemplate() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, body }: { id: string; body: SoapTemplateWriteRequest }) =>
      api.put<SoapTemplate>(`/soap-templates/${id}`, body).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['soap-templates'] }),
  });
  return { update: m.mutateAsync, isPending: m.isPending };
}

export function useDeleteSoapTemplate() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (id: string) => api.delete(`/soap-templates/${id}`).then(() => undefined),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['soap-templates'] }),
  });
  return { remove: m.mutateAsync, isPending: m.isPending };
}
