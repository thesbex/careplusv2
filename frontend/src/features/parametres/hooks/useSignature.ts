/**
 * F16 + V035 — gestion de la signature scannée par MÉDECIN (per-praticien
 * depuis 2026-05-08). Sans argument, opère sur l'utilisateur connecté ; avec
 * un argument, sur le médecin ciblé (ADMIN peut éditer celle de tout le monde).
 *
 * - GET  /api/practitioners/{id}/signature/meta : métadonnées (mime + date + taille)
 * - GET  /api/practitioners/{id}/signature       : bytes bruts (pour aperçu)
 * - PUT  /api/practitioners/{id}/signature       : upload multipart (self ou ADMIN)
 * - DELETE /api/practitioners/{id}/signature     : suppression (self ou ADMIN)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';

export interface SignatureMeta {
  mime: string;
  uploadedAt: string;
  sizeBytes: number;
}

const META_KEY = 'practitioner-signature-meta';
const PREVIEW_KEY = 'practitioner-signature-preview';

export function useSignatureMeta(targetPractitionerId?: string) {
  const fallbackId = useAuthStore((s) => s.user?.id);
  const id = targetPractitionerId ?? fallbackId;

  const { data, isLoading } = useQuery({
    queryKey: [META_KEY, id],
    enabled: !!id,
    queryFn: () =>
      api
        .get<SignatureMeta>(`/practitioners/${id}/signature/meta`)
        .then((r) => (r.status === 204 ? null : r.data))
        .catch(() => null),
    staleTime: 30_000,
  });
  return { meta: data ?? null, isLoading };
}

/**
 * Récupère les bytes en blob et renvoie un object URL utilisable dans `<img src>`.
 * Re-fetch à chaque changement de meta (cache-busting via uploadedAt).
 */
export function useSignaturePreviewUrl(meta: SignatureMeta | null, targetPractitionerId?: string) {
  const fallbackId = useAuthStore((s) => s.user?.id);
  const id = targetPractitionerId ?? fallbackId;

  const { data } = useQuery({
    queryKey: [PREVIEW_KEY, id, meta?.uploadedAt ?? null],
    enabled: !!meta && !!id,
    queryFn: async () => {
      const res = await api.get<Blob>(`/practitioners/${id}/signature`, {
        responseType: 'blob',
      });
      if (res.status === 204) return null;
      return URL.createObjectURL(res.data);
    },
    staleTime: Infinity,
  });
  return data ?? null;
}

export function useUploadSignature(targetPractitionerId?: string) {
  const fallbackId = useAuthStore((s) => s.user?.id);
  const id = targetPractitionerId ?? fallbackId;
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.put<SignatureMeta>(`/practitioners/${id}/signature`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return r.data;
    },
    onSuccess: (meta) => {
      qc.setQueryData([META_KEY, id], meta);
      void qc.invalidateQueries({ queryKey: [PREVIEW_KEY, id] });
    },
  });
  return { upload: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useDeleteSignature(targetPractitionerId?: string) {
  const fallbackId = useAuthStore((s) => s.user?.id);
  const id = targetPractitionerId ?? fallbackId;
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api.delete(`/practitioners/${id}/signature`).then(() => undefined),
    onSuccess: () => {
      qc.setQueryData([META_KEY, id], null);
      void qc.invalidateQueries({ queryKey: [PREVIEW_KEY, id] });
    },
  });
  return { remove: mutation.mutateAsync, isPending: mutation.isPending };
}
