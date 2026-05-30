/**
 * usePatientPhoto — upload / suppression de la photo patient (QA5-3).
 *
 * Backend :
 *   PUT    /api/patients/{id}/photo   (multipart, file)  → remplace
 *   DELETE /api/patients/{id}/photo                       → retire
 *
 * Au succès, on invalide les caches `patient` et `patients` pour que la
 * dénormalisation `photoDocumentId` soit rechargée.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';

export interface UploadedPhoto {
  id: string;
  patientId: string;
  type: string;
  mimeType: string;
  sizeBytes: number;
}

export function usePatientPhoto(patientId: string | undefined) {
  const queryClient = useQueryClient();
  const { t } = useT();

  const upload = useMutation({
    mutationFn: async (file: File): Promise<UploadedPhoto> => {
      if (!patientId) throw new Error(t('dossier.hook.notFound'));
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.put<UploadedPhoto>(
        `/patients/${patientId}/photo`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!patientId) throw new Error(t('dossier.hook.notFound'));
      await api.delete(`/patients/${patientId}/photo`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  return {
    upload: upload.mutateAsync,
    isUploading: upload.isPending,
    uploadError: upload.error
      ? extractMessage(upload.error, {
          tooBig: t('dossier.photo.tooBig'),
          badFormat: t('dossier.photo.uploadBadFormat'),
          fallback: t('dossier.photo.uploadFailed'),
        })
      : null,
    remove: remove.mutateAsync,
    isRemoving: remove.isPending,
  };
}

function extractMessage(
  err: unknown,
  labels: { tooBig: string; badFormat: string; fallback: string },
): string {
  const e = err as { response?: { status?: number; data?: { detail?: string; message?: string } } };
  if (e?.response?.status === 413) return labels.tooBig;
  if (e?.response?.status === 415) return labels.badFormat;
  return e?.response?.data?.detail ?? e?.response?.data?.message ?? labels.fallback;
}
