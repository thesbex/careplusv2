/**
 * Hooks pour gérer les modèles de prescription privés au médecin (QA6-2 + QA6-3).
 * Endpoints : GET/POST/PUT/DELETE /api/prescription-templates.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export type TemplateType = 'DRUG' | 'LAB' | 'IMAGING';

/** Forme JSONB selon le type — discriminé côté frontend par TemplateType. */
export interface DrugTemplateLine {
  medicationId: string;
  medicationCode: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  quantity?: number | null;
  instructions?: string;
}
export interface LabTemplateLine {
  labTestId: string;
  labTestCode: string;
  instructions?: string;
}
export interface ImagingTemplateLine {
  imagingExamId: string;
  imagingExamCode: string;
  instructions?: string;
}
export type TemplateLine = DrugTemplateLine | LabTemplateLine | ImagingTemplateLine;

export interface PrescriptionTemplate {
  id: string;
  name: string;
  type: TemplateType;
  lines: TemplateLine[];
  lineCount: number;
  updatedAt: string;
}

export interface TemplateWriteBody {
  name: string;
  type: TemplateType;
  lines: TemplateLine[];
}

const QK = (type: TemplateType) => ['prescription-templates', type] as const;

export function usePrescriptionTemplates(type: TemplateType) {
  const { data, isLoading, error } = useQuery({
    queryKey: QK(type),
    queryFn: () =>
      api
        .get<PrescriptionTemplate[]>('/prescription-templates', { params: { type } })
        .then((r) => r.data),
    staleTime: 30_000,
  });
  return {
    templates: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger les modèles.' : null,
  };
}

export function useCreatePrescriptionTemplate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: TemplateWriteBody) =>
      api.post<PrescriptionTemplate>('/prescription-templates', body).then((r) => r.data),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: QK(created.type) });
    },
  });
  return {
    create: (body: TemplateWriteBody) => mutation.mutateAsync(body),
    isPending: mutation.isPending,
  };
}

export function useUpdatePrescriptionTemplate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: TemplateWriteBody }) =>
      api.put<PrescriptionTemplate>(`/prescription-templates/${id}`, body).then((r) => r.data),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: QK(updated.type) });
    },
  });
  return {
    update: (id: string, body: TemplateWriteBody) => mutation.mutateAsync({ id, body }),
    isPending: mutation.isPending,
  };
}

export function useDeletePrescriptionTemplate() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => api.delete(`/prescription-templates/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['prescription-templates'] });
    },
  });
  return {
    remove: (id: string) => mutation.mutateAsync(id),
    isPending: mutation.isPending,
  };
}
