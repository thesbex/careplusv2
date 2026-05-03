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

export type DocumentType =
  | 'PRESCRIPTION_HISTORIQUE'
  | 'ANALYSE'
  | 'IMAGERIE'
  | 'COMPTE_RENDU'
  | 'AUTRE';

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  PRESCRIPTION_HISTORIQUE: 'Ancienne prescription',
  ANALYSE: "Résultat d'analyse",
  IMAGERIE: 'Imagerie / radio',
  COMPTE_RENDU: 'Compte rendu',
  AUTRE: 'Autre',
};

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

function extractMessage(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string; message?: string } } };
  return (
    e?.response?.data?.detail ??
    e?.response?.data?.message ??
    "Échec du transfert. Vérifie le format (PDF, JPEG, PNG) et la taille (< 10 Mo)."
  );
}

export function usePatientDocuments(patientId: string | undefined) {
  const queryClient = useQueryClient();

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
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/documents/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patient-documents', patientId] });
    },
  });

  return {
    documents: list.data ?? [],
    isLoading: list.isLoading,
    error: list.error ? 'Impossible de charger les documents.' : null,
    upload: upload.mutateAsync,
    isUploading: upload.isPending,
    uploadError: upload.error ? extractMessage(upload.error) : null,
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
