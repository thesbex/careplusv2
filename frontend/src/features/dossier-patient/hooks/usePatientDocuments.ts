/**
 * usePatientDocuments — liste / upload / téléchargement / suppression
 * des documents historiques rattachés à un patient (QA2-2).
 *
 * - Liste : `GET /api/patients/{id}/documents` → cache TanStack Query.
 * - Upload : multipart sur `POST /api/patients/{id}/documents`.
 *   Force `Content-Type: multipart/form-data` (axios default JSON sinon).
 * - Téléchargement : on récupère le blob via axios pour l'attacher
 *   à un `<a href="blob:...">` (le JWT est en mémoire, pas en cookie,
 *   donc on ne peut pas faire un simple `window.open`).
 * - Suppression : `DELETE /api/documents/{id}`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';

export type DocumentType =
  | 'PRESCRIPTION_HISTORIQUE'
  | 'ANALYSE'
  | 'IMAGERIE'
  | 'COMPTE_RENDU'
  | 'CONSENTEMENT'
  | 'AUTRE';

/**
 * Libellés FR de secours (utilisés hors contexte i18n). Pour l'affichage,
 * préférer `t(documentTypeKey(type))` dans les composants.
 */
export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  PRESCRIPTION_HISTORIQUE: 'Ancienne prescription',
  ANALYSE: "Résultat d'analyse",
  IMAGERIE: 'Imagerie / radio',
  COMPTE_RENDU: 'Compte rendu',
  CONSENTEMENT: 'Consentement signé',
  AUTRE: 'Autre',
};

/** Clé i18n (`dossier.docType.*`) pour un type de document. */
export function documentTypeKey(type: DocumentType): string {
  return `dossier.docType.${type}`;
}

export interface PatientDocument {
  id: string;
  patientId: string;
  type: DocumentType;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  notes?: string | null;
  uploadedBy: string;
  uploadedAt: string;
}

export interface UploadDocumentInput {
  file: File;
  type: DocumentType;
  notes?: string;
}

function extractMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { detail?: string; message?: string } } };
  return e?.response?.data?.detail ?? e?.response?.data?.message ?? fallback;
}

export function usePatientDocuments(patientId: string | undefined) {
  const queryClient = useQueryClient();
  const { t } = useT();

  const list = useQuery({
    queryKey: ['patient-documents', patientId],
    queryFn: async () => {
      const { data } = await api.get<PatientDocument[]>(
        `/patients/${patientId}/documents`,
      );
      return data;
    },
    enabled: !!patientId,
  });

  const upload = useMutation({
    mutationFn: async (input: UploadDocumentInput): Promise<PatientDocument> => {
      const fd = new FormData();
      fd.append('file', input.file);
      fd.append('type', input.type);
      if (input.notes && input.notes.trim()) {
        fd.append('notes', input.notes.trim());
      }
      const { data } = await api.post<PatientDocument>(
        `/patients/${patientId}/documents`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patient-documents', patientId] });
      // B6 — refresh dossier patient tab badges (Documents/Analyses/Imagerie).
      void queryClient.invalidateQueries({ queryKey: ['patient-tab-counts', patientId] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/documents/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patient-documents', patientId] });
      // B6 — refresh dossier patient tab badges (count decremented after soft-delete).
      void queryClient.invalidateQueries({ queryKey: ['patient-tab-counts', patientId] });
    },
  });

  return {
    documents: list.data ?? [],
    isLoading: list.isLoading,
    error: list.error ? t('dossier.docs.loadError') : null,
    upload: upload.mutateAsync,
    isUploading: upload.isPending,
    uploadError: upload.error ? extractMessage(upload.error, t('dossier.docs.uploadError')) : null,
    remove: remove.mutateAsync,
    isRemoving: remove.isPending,
  };
}

/**
 * Télécharge le binaire d'un document via le JWT en mémoire et déclenche
 * un download navigateur sans recharger la page.
 */
export async function downloadDocument(doc: PatientDocument): Promise<void> {
  const res = await api.get<Blob>(`/documents/${doc.id}/content`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.originalFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revoke: Safari needs the URL to remain live until the click is processed.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
